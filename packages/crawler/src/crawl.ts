import type { AuditConfig, HttpSnapshot, ParsedHtml, UrlState } from "@webaudit/core";
import {
  assertPublicUrl,
  createSafeAgent,
  describeFetchError,
  redactUrl,
  safeFetch,
  type SafetyPolicy,
} from "@webaudit/safety";
import { parseHtml } from "./extract";
import { inScope, normalizeUrl, pathKey } from "./normalize";
import { loadRobots, type RobotsPolicy } from "./robots";
import { loadSitemaps, type SitemapResult } from "./sitemap";

export type UrlSource = "start" | "sitemap" | "link" | "redirect" | "render";

export interface LedgerEntry {
  url: string;
  originalUrl: string;
  source: UrlSource;
  sourceUrl: string | null;
  depth: number;
  state: UrlState;
  reason?: string | null;
  inSitemap: boolean;
}

export interface LedgerPatch {
  state?: UrlState;
  reason?: string | null;
  httpStatus?: number | null;
  contentType?: string | null;
  finalUrl?: string | null;
  redirectChain?: { url: string; status: number }[] | null;
  attemptedAt?: string | null;
  checkedAt?: string | null;
  inSitemap?: boolean;
}

/** Persistence boundary. The worker implements this over SQLite; tests use memory. */
export interface CrawlLedger {
  /** Insert unseen URLs; returns the number actually inserted. */
  add(entries: LedgerEntry[]): number;
  update(url: string, patch: LedgerPatch): void;
}

export interface FetchedPage {
  url: string;
  depth: number;
  http: HttpSnapshot;
  parsed?: ParsedHtml;
  inSitemap?: boolean;
  /** True when this snapshot is a redirect response (content belongs to finalUrl). */
  isRedirect: boolean;
}

export interface CrawlHooks {
  onPage(page: FetchedPage): Promise<void>;
  isCancelled(): boolean;
  log(level: "debug" | "info" | "warn" | "error", message: string, data?: Record<string, unknown>): void;
  /** Optional JS rendering for link discovery (CR-08). Returns rendered HTML. */
  render?(url: string): Promise<string | null>;
  /** Called every N checked URLs, for checkpoints and progress. */
  onProgress?(stats: CrawlStats): void;
}

export interface ResumeState {
  /** All normalized URLs already in the ledger. */
  known: string[];
  /** Entries still to fetch (state queued/discovered/attempted). */
  pending: { url: string; depth: number; source: UrlSource; sourceUrl: string | null }[];
  sitemapUrls: string[];
}

export interface CrawlStats {
  discovered: number;
  checked: number;
  failed: number;
  blocked: number;
  skipped: number;
  /** In-scope URLs seen after the ledger cap; counted but not individually recorded. */
  overflow: number;
  externalLinks: number;
}

export interface CrawlResult {
  stats: CrawlStats;
  robots?: RobotsPolicy;
  sitemaps?: SitemapResult;
  sitemapUrls: Set<string>;
  links: { from: string; to: string }[];
  deadlineHit: boolean;
  cancelled: boolean;
  startUrl: string;
}

interface QueueItem {
  url: string;
  depth: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

function isHtml(contentType: string): boolean {
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

export async function crawl(
  config: AuditConfig,
  policy: SafetyPolicy,
  ledger: CrawlLedger,
  hooks: CrawlHooks,
  resume?: ResumeState,
): Promise<CrawlResult> {
  const deadline = Date.now() + config.auditDeadlineMs;
  const agent = createSafeAgent(policy);
  const startUrl = normalizeUrl(config.url, undefined, config) ?? config.url;
  await assertPublicUrl(startUrl, policy);

  const scopeOpts = {
    includeSubdomains: config.includeSubdomains,
    allowPaths: config.allowPaths,
    denyPaths: config.denyPaths,
  };
  const fetchBase = {
    agent,
    policy,
    userAgent: config.userAgent,
    timeoutMs: config.pageTimeoutMs,
    allowRedirect: (t: URL) => inScope(t.toString(), startUrl, scopeOpts).ok,
  };

  const stats: CrawlStats = {
    discovered: 0,
    checked: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
    overflow: 0,
    externalLinks: 0,
  };
  const known = new Set<string>(resume?.known ?? []);
  const queryVariants = new Map<string, number>();
  // Link graph first (breadth-first), sitemap-only seeds after: under a URL cap the
  // pages users can actually navigate to are audited before orphaned sitemap entries.
  const linkQueue: QueueItem[] = [];
  const seedQueue: QueueItem[] = [];
  const seedPending = new Set<string>();
  const nextItem = (): QueueItem | undefined => {
    const fromLinks = linkQueue.shift();
    if (fromLinks) return fromLinks;
    for (let s = seedQueue.shift(); s; s = seedQueue.shift()) {
      if (seedPending.delete(s.url)) return s; // else it was promoted and already taken
    }
    return undefined;
  };
  const enqueue = (item: QueueItem, source: UrlSource) => {
    if (source === "sitemap") {
      seedQueue.push(item);
      seedPending.add(item.url);
    } else linkQueue.push(item);
  };
  const links: { from: string; to: string }[] = [];
  const ledgerCap = Math.max(2_000, config.maxUrls * 5);
  let fetchedCount = resume ? resume.known.length - resume.pending.length : 0;
  let deadlineHit = false;
  let cancelled = false;

  // ---- robots + sitemaps ----
  const origin = new URL(startUrl).origin;
  const robots = await loadRobots(origin, config.userAgent, fetchBase);
  hooks.log("info", `robots.txt: ${robots.interpretation} (HTTP ${robots.status})`, {
    sitemaps: robots.sitemaps.length,
  });
  const politeDelay = Math.max(config.perHostDelayMs, Math.min(robots.crawlDelaySec ?? 0, 10) * 1000);

  let sitemaps: SitemapResult | undefined;
  const sitemapUrls = new Set<string>(resume?.sitemapUrls ?? []);
  const loadSitemapsNow = config.mode !== "quick" && !resume;
  if (loadSitemapsNow) {
    const seeds = robots.sitemaps.length ? robots.sitemaps : [new URL("/sitemap.xml", origin).toString()];
    sitemaps = await loadSitemaps(seeds, fetchBase, (u) => {
      const n = normalizeUrl(u, undefined, config);
      return !!n && inScope(n, startUrl, scopeOpts).ok;
    });
    for (const { loc } of sitemaps.urls) {
      const n = normalizeUrl(loc, undefined, config);
      if (n) sitemapUrls.add(n);
    }
    hooks.log("info", `Sitemaps: ${sitemaps.sources.length} file(s), ${sitemapUrls.size} in-scope URL(s)`, {
      truncated: sitemaps.truncated,
    });
  }

  /** Decide the initial state of a newly discovered in-scope URL and record it. */
  const discover = (
    rawUrl: string,
    normalized: string,
    depth: number,
    source: UrlSource,
    sourceUrl: string | null,
  ): boolean => {
    if (known.has(normalized)) {
      // A sitemap seed that turns out to be linked is promoted into the link graph.
      if (source !== "sitemap" && seedPending.delete(normalized)) linkQueue.push({ url: normalized, depth });
      return false;
    }
    if (known.size >= ledgerCap) {
      stats.overflow++;
      return false;
    }
    known.add(normalized);
    let state: UrlState = "queued";
    let reason: string | null = null;
    const scope = inScope(normalized, startUrl, scopeOpts);
    const pk = pathKey(normalized);
    if (!scope.ok) {
      state = "skipped";
      reason = scope.reason;
    } else if (!robots.isAllowed(normalized)) {
      state = "blocked_robots";
      reason = `robots.txt line ${robots.matchingLine(normalized)}`;
    } else if (depth > config.maxDepth) {
      state = "skipped";
      reason = "max_depth";
    } else if (new URL(normalized).search && (queryVariants.get(pk) ?? 0) >= config.maxQueryVariantsPerPath) {
      state = "skipped";
      reason = "query_variant_cap";
    } else if (config.sitemapOnly && source === "link" && !sitemapUrls.has(normalized)) {
      state = "skipped";
      reason = "sitemap_only_mode";
    }
    if (state === "queued" && new URL(normalized).search)
      queryVariants.set(pk, (queryVariants.get(pk) ?? 0) + 1);
    ledger.add([
      {
        url: normalized,
        originalUrl: redactUrl(rawUrl),
        source,
        sourceUrl,
        depth,
        state,
        reason,
        inSitemap: sitemapUrls.has(normalized),
      },
    ]);
    stats.discovered++;
    if (state === "queued") enqueue({ url: normalized, depth }, source);
    else if (state === "blocked_robots") stats.blocked++;
    else stats.skipped++;
    return state === "queued";
  };

  if (resume) {
    for (const p of resume.pending) enqueue({ url: p.url, depth: p.depth }, p.source);
    stats.discovered = resume.known.length;
  } else {
    discover(config.url, startUrl, 0, "start", null);
    for (const u of sitemapUrls) discover(u, u, 1, "sitemap", null);
  }

  // ---- fetch loop ----
  let lastRequestAt = 0;
  const takeSlot = async () => {
    // Per-host politeness: space request starts by politeDelay.
    const wait = lastRequestAt + politeDelay - Date.now();
    lastRequestAt = Math.max(Date.now(), lastRequestAt + politeDelay);
    if (wait > 0) await sleep(wait);
  };

  const processOne = async (item: QueueItem): Promise<void> => {
    if (fetchedCount >= config.maxUrls) {
      ledger.update(item.url, { state: "skipped", reason: "max_urls_cap" });
      stats.skipped++;
      return;
    }
    fetchedCount++;
    await takeSlot();
    ledger.update(item.url, { state: "attempted", attemptedAt: nowIso() });
    let res;
    try {
      res = await safeFetch(item.url, { ...fetchBase, maxBytes: config.maxResponseBytes });
    } catch (e) {
      const { reason } = describeFetchError(e);
      ledger.update(item.url, { state: "failed", reason });
      stats.failed++;
      hooks.log("warn", `Fetch failed: ${redactUrl(item.url)} — ${reason}`);
      return;
    }

    const finalNorm = normalizeUrl(res.finalUrl, undefined, config) ?? res.finalUrl;
    const redirected = res.redirectChain.length > 0;
    const http: HttpSnapshot = {
      url: item.url,
      finalUrl: res.finalUrl,
      status: redirected ? res.redirectChain[0]!.status : res.status,
      headers: res.headers,
      contentType: res.contentType,
      redirectChain: res.redirectChain,
      bytes: res.bytes,
      truncated: res.truncated,
      fetchedAt: nowIso(),
      elapsedMs: res.elapsedMs,
    };
    ledger.update(item.url, {
      state: "checked",
      checkedAt: nowIso(),
      httpStatus: http.status,
      contentType: res.contentType,
      finalUrl: redactUrl(res.finalUrl),
      redirectChain: res.redirectChain,
      reason: res.redirectStopped ? `redirect_not_followed:${res.redirectStopped.reason}` : null,
    });
    stats.checked++;

    let contentUrl = item.url;
    if (redirected && finalNorm !== item.url) {
      await hooks.onPage({
        url: item.url,
        depth: item.depth,
        http,
        isRedirect: true,
        inSitemap: loadSitemapsNow || resume ? sitemapUrls.has(item.url) : undefined,
      });
      if (res.redirectStopped) return;
      // Attribute the content to the final URL if we have not seen it; otherwise it
      // will be (or was) fetched on its own.
      if (known.has(finalNorm)) return;
      if (!inScope(finalNorm, startUrl, scopeOpts).ok || !robots.isAllowed(finalNorm)) return;
      known.add(finalNorm);
      ledger.add([
        {
          url: finalNorm,
          originalUrl: redactUrl(res.finalUrl),
          source: "redirect",
          sourceUrl: item.url,
          depth: item.depth,
          state: "checked",
          inSitemap: sitemapUrls.has(finalNorm),
        },
      ]);
      ledger.update(finalNorm, {
        attemptedAt: nowIso(),
        checkedAt: nowIso(),
        httpStatus: res.status,
        contentType: res.contentType,
        finalUrl: redactUrl(res.finalUrl),
      });
      stats.discovered++;
      stats.checked++;
      contentUrl = finalNorm;
    }

    const contentHttp: HttpSnapshot =
      contentUrl === item.url && !redirected
        ? http
        : { ...http, url: contentUrl, status: res.status, redirectChain: [] };
    let parsed: ParsedHtml | undefined;
    if (isHtml(res.contentType) && res.status < 400 && res.body.length) {
      const html = res.body.toString("utf8");
      contentHttp.html = html;
      parsed = parseHtml(html, res.finalUrl, {
        stripParams: config.stripParams,
        xRobotsTag: res.headers["x-robots-tag"],
      });

      // Link discovery.
      const linkUrls = parsed.links.filter((l) => l.url).map((l) => ({ raw: l.raw, url: l.url! }));
      if (config.renderDiscovery && hooks.render) {
        const rendered = await hooks.render(res.finalUrl).catch(() => null);
        if (rendered) {
          const extra = parseHtml(rendered, res.finalUrl, { stripParams: config.stripParams }).links;
          const have = new Set(linkUrls.map((l) => l.url));
          for (const l of extra) if (l.url && !have.has(l.url)) linkUrls.push({ raw: l.raw, url: l.url });
        }
      }
      const nofollow = parsed.robotsMeta.some((r) => r.includes("nofollow"));
      for (const l of linkUrls) {
        const internal = inScope(l.url, startUrl, { ...scopeOpts, denyPaths: [], allowPaths: [] }).ok;
        if (!internal) {
          stats.externalLinks++;
          continue;
        }
        links.push({ from: contentUrl, to: l.url });
        if (!nofollow) discover(l.raw, l.url, item.depth + 1, "link", contentUrl);
      }
    }

    await hooks.onPage({
      url: contentUrl,
      depth: item.depth,
      http: contentHttp,
      parsed,
      isRedirect: false,
      inSitemap: loadSitemapsNow || resume ? sitemapUrls.has(contentUrl) : undefined,
    });
    if (stats.checked % 10 === 0) hooks.onProgress?.({ ...stats });
  };

  let inFlight = 0;
  const workers = Array.from({ length: config.httpConcurrency }, async () => {
    for (;;) {
      if (hooks.isCancelled()) {
        cancelled = true;
        return;
      }
      if (Date.now() > deadline) {
        deadlineHit = true;
        return;
      }
      const item = nextItem();
      if (!item) {
        // Another worker may still be discovering links; wait briefly for new items.
        if (inFlight === 0) return;
        await sleep(25);
        continue;
      }
      inFlight++;
      try {
        await processOne(item);
      } catch (e) {
        ledger.update(item.url, { state: "failed", reason: `internal_error: ${(e as Error).message}` });
        stats.failed++;
        hooks.log("error", `Unexpected error on ${redactUrl(item.url)}`, { error: String(e) });
      } finally {
        inFlight--;
      }
    }
  });
  await Promise.all(workers);

  // Anything left in the queue is labelled, never silently dropped.
  const leftoverReason = cancelled ? "cancelled" : deadlineHit ? "audit_deadline" : null;
  if (leftoverReason) {
    const leftovers = [...linkQueue.splice(0), ...seedQueue.splice(0).filter((s) => seedPending.has(s.url))];
    for (const item of leftovers) {
      ledger.update(item.url, { state: "skipped", reason: leftoverReason });
      stats.skipped++;
    }
  }
  hooks.onProgress?.({ ...stats });
  await agent.close();
  return { stats, robots, sitemaps, sitemapUrls, links, deadlineHit, cancelled, startUrl };
}
