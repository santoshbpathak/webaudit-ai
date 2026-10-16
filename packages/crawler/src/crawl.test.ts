import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveConfig, type AuditConfigInput } from "@webaudit/core";
import { policyFromEnv } from "@webaudit/safety";
import { startFixtureServer, type FixtureServer } from "@webaudit/fixture-site";
import { crawl, type CrawlLedger, type FetchedPage, type LedgerEntry, type LedgerPatch } from "./crawl";

class MemoryLedger implements CrawlLedger {
  rows = new Map<string, LedgerEntry & LedgerPatch>();
  add(entries: LedgerEntry[]) {
    let n = 0;
    for (const e of entries) {
      if (!this.rows.has(e.url)) {
        this.rows.set(e.url, { ...e });
        n++;
      }
    }
    return n;
  }
  update(url: string, patch: LedgerPatch) {
    const r = this.rows.get(url);
    if (!r) throw new Error(`update of unknown url ${url}`);
    Object.assign(r, patch);
  }
  byState() {
    const out: Record<string, number> = {};
    for (const r of this.rows.values()) out[r.state] = (out[r.state] ?? 0) + 1;
    return out;
  }
}

const policy = { ...policyFromEnv({}), allowHosts: ["127.0.0.1"] };

async function run(origin: string, over: Partial<AuditConfigInput> = {}) {
  const ledger = new MemoryLedger();
  const pages: FetchedPage[] = [];
  const config = resolveConfig({ url: origin + "/", perHostDelayMs: 0, httpConcurrency: 4, ...over });
  const result = await crawl(config, policy, ledger, {
    onPage: async (p) => void pages.push(p),
    isCancelled: () => false,
    log: () => {},
  });
  return { ledger, pages, result };
}

describe("crawl against the fixture site", () => {
  let fx: FixtureServer;
  beforeAll(async () => {
    fx = await startFixtureServer({ largePages: 500 });
  });
  afterAll(() => fx.close());

  it("T05: robots-disallowed URL is blocked, recorded and never requested", async () => {
    fx.requests.length = 0;
    const { ledger } = await run(fx.origin, { maxUrls: 40 });
    const row = ledger.rows.get(`${fx.origin}/private/partner-rates`);
    expect(row?.state).toBe("blocked_robots");
    expect(row?.reason).toMatch(/robots\.txt line/);
    expect(fx.requests).not.toContain("/private/partner-rates");
  });

  it("T03: a page found only via internal link enters the ledger with provenance", async () => {
    const { ledger } = await run(fx.origin, { maxUrls: 40 });
    const row = ledger.rows.get(`${fx.origin}/blog/missing-post`);
    expect(row).toMatchObject({
      source: "link",
      sourceUrl: `${fx.origin}/blog/`,
      inSitemap: false,
      httpStatus: 404,
    });
    const fromSitemap = ledger.rows.get(`${fx.origin}/landing/offer`);
    expect(fromSitemap?.inSitemap).toBe(true);
  });

  it("T04: infinite parameter links are capped, not looped", async () => {
    const { ledger, result } = await run(fx.origin, { maxUrls: 600, maxQueryVariantsPerPath: 5 });
    const trap = [...ledger.rows.values()].filter((r) => r.url.includes("/trap/calendar"));
    const fetched = trap.filter((r) => r.state === "checked");
    expect(fetched.length).toBeLessThanOrEqual(5);
    expect(trap.some((r) => r.reason === "query_variant_cap")).toBe(true);
    expect(result.deadlineHit).toBe(false);
  });

  it("T02: 500-page sitemap with duplicate variants reconciles exactly", async () => {
    const { ledger, result } = await run(fx.origin, { maxUrls: 600 });
    const large = [...ledger.rows.values()].filter((r) => r.url.includes("/large/"));
    const urls = large.map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
    // utm/fragment variants collapse onto the canonical URL; trailing slash stays distinct.
    expect(urls.some((u) => /utm_|#/.test(u))).toBe(false);
    expect(urls.filter((u) => u === `${fx.origin}/large/2`)).toHaveLength(1);
    expect(urls.filter((u) => u === `${fx.origin}/large/4`)).toHaveLength(1);
    expect(urls).toContain(`${fx.origin}/large/1/`);
    // Every discovered URL is in exactly one terminal state; counts reconcile with stats.
    const states = ledger.byState();
    const total = Object.values(states).reduce((a, b) => a + b, 0);
    expect(total).toBe(ledger.rows.size);
    expect(states.queued ?? 0).toBe(0);
    expect(states.attempted ?? 0).toBe(0);
    expect(result.stats.checked).toBe(states.checked);
  });

  it("caps fetched URLs and labels the rest instead of dropping them", async () => {
    const { ledger, result } = await run(fx.origin, { maxUrls: 20 });
    const states = ledger.byState();
    expect(states.checked).toBeLessThanOrEqual(22); // + redirect targets attributed from fetched pages
    expect([...ledger.rows.values()].filter((r) => r.reason === "max_urls_cap").length).toBeGreaterThan(400);
    expect(result.stats.discovered).toBe(ledger.rows.size);
  });

  it("records redirect chains and attributes content to the final URL", async () => {
    const { ledger, pages } = await run(fx.origin, { maxUrls: 40 });
    const old = ledger.rows.get(`${fx.origin}/old-offer`);
    expect(old?.redirectChain).toHaveLength(2);
    expect(pages.find((p) => p.url === `${fx.origin}/old-offer`)?.isRedirect).toBe(true);
  });

  it("T06: a start URL redirecting into metadata space fails safely", async () => {
    const { ledger } = await run(fx.origin, { url: `${fx.origin}/redirect-private`, mode: "quick" });
    const row = ledger.rows.get(`${fx.origin}/redirect-private`);
    expect(row?.state).toBe("failed");
    expect(row?.reason).toMatch(/safety policy/i);
  });

  it("quick mode fetches only the entered URL", async () => {
    fx.requests.length = 0;
    const { pages } = await run(fx.origin, { mode: "quick" });
    expect(pages.filter((p) => !p.isRedirect)).toHaveLength(1);
    expect(fx.requests.filter((r) => !r.startsWith("/robots.txt"))).toEqual(["/"]);
  });
});
