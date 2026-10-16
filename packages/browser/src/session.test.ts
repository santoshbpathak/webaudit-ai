import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { policyFromEnv } from "@webaudit/safety";
import { startFixtureServer, type FixtureServer } from "@webaudit/fixture-site";
import { BrowserPool } from "./pool";
import { auditPage } from "./session";

const policy = { ...policyFromEnv({}), allowHosts: ["127.0.0.1"] };

describe("browser session against the fixture", () => {
  let fx: FixtureServer;
  let pool: BrowserPool;
  beforeAll(async () => {
    fx = await startFixtureServer();
    pool = new BrowserPool({ policy, device: "mobile", userAgent: "WebAuditAI-test" });
    await pool.start();
  }, 60_000);
  afterAll(async () => {
    await pool.close();
    await fx.close();
  });

  const audit = (path: string) =>
    auditPage(pool, fx.origin + path, {
      inScope: (u) => u.startsWith(fx.origin),
      timeoutMs: 20_000,
      runAxe: true,
      observeAfterConsent: true,
      offlineExternal: { policy },
    });

  it("observes trackers before consent, consent banner and pre-checked options", async () => {
    const s = await audit("/");
    const ga = s.requests.filter((r) => r.url.includes("google-analytics.com/g/collect"));
    expect(ga.length).toBeGreaterThan(0);
    expect(ga[0]!.beforeConsent).toBe(true);
    expect(ga[0]!.url).not.toContain("123.456"); // GA client id redacted (T15)
    expect(s.requests.filter((r) => r.url.includes("gtm.js")).length).toBe(2);
    expect(s.consent).toMatchObject({ bannerDetected: true, cmp: "generic" });
    expect(s.consent.acceptSelector).toBeTruthy();
    expect(s.consent.preCheckedOptions).toContain("marketing_cookies");
    expect(s.consent.cookiesBeforeConsent.map((c) => c.name)).toContain("_ga");
    expect(s.dataLayer.length).toBeGreaterThan(0);
    const axe = s.axe as { violations: { id: string }[] };
    expect(axe.violations.map((v) => v.id)).toContain("image-alt");
  }, 60_000);

  it("extracts forms without submitting them (T11)", async () => {
    fx.requests.length = 0;
    const s = await audit("/products/term-plan");
    const form = s.forms.find((f) => f.selector.includes("quote-form"))!;
    expect(form.method).toBe("post");
    const email = form.fields.find((f) => f.name === "email")!;
    expect(email).toMatchObject({ type: "text", hasLabel: false });
    expect(form.fields.find((f) => f.name === "marketing_optin")?.checkedByDefault).toBe(true);
    expect(fx.requests.some((r) => r.startsWith("/api/"))).toBe(false);
  }, 60_000);

  it("detects overflow, small tap targets and broken images", async () => {
    const s = await audit("/pricing");
    expect(s.documentWidth).toBeGreaterThan(s.viewport.width);
    expect(s.smallTapTargets.length).toBeGreaterThan(0);
    expect(s.brokenImages.some((b) => b.src.includes("broken.png"))).toBe(true);
  }, 60_000);

  it("blocks subresources pointing at non-allowlisted private hosts through the proxy", async () => {
    const strict = new BrowserPool({
      policy: { ...policy, allowHosts: [] },
      device: "desktop",
      userAgent: "t",
    });
    await strict.start();
    try {
      const snap = await auditPage(strict, fx.origin + "/", {
        inScope: () => true,
        timeoutMs: 8_000,
        runAxe: false,
        observeAfterConsent: false,
      });
      expect(snap.stepErrors.navigation).toBe("HTTP 403");
      expect(snap.renderedHtml).not.toContain("Fernhill");
      expect(strict.blockedCount()).toBeGreaterThan(0);
    } finally {
      await strict.close();
    }
  }, 60_000);

  it("terminates a page that blocks the renderer instead of hanging the worker", async () => {
    // Hostile page: spins the main thread forever shortly after load.
    const srv = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><title>spin</title><script>setTimeout(()=>{for(;;){}},50)</script>");
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const origin = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    const t = Date.now();
    try {
      await expect(
        auditPage(pool, origin + "/", {
          inScope: () => true,
          timeoutMs: 2_000,
          hardTimeoutMs: 6_000,
          runAxe: true,
          observeAfterConsent: false,
        }),
      ).rejects.toThrow(/hard time limit/);
      expect(Date.now() - t).toBeLessThan(20_000);
    } finally {
      srv.closeAllConnections();
      srv.close();
    }
  }, 60_000);
});
