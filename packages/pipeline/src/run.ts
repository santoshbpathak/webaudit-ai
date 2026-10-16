import { createRequire } from "node:module";
import { chromium } from "playwright";
import type { AuditStatus, Finding, PageContext, SiteContext } from "@webaudit/core";
import { ENGINE_VERSION, sha1 } from "@webaudit/core";
import { BrowserPool, auditPage, renderHtml } from "@webaudit/browser";
import {
  clusterKey,
  crawl,
  inScope,
  selectSample,
  type CrawlResult,
  type FetchedPage,
} from "@webaudit/crawler";
import {
  SCHEMA_VERSION,
  addArtifact,
  computeCoverage,
  getAudit,
  insertDiscovered,
  insertFindings,
  isCancelRequested,
  listUrls,
  logEvent,
  replaceGroups,
  saveSnapshot,
  setGroupSignatures,
  updateAudit,
  updateUrl,
  type Db,
} from "@webaudit/db";
import { runLighthouse } from "@webaudit/engines";
import { evaluatePage, evaluateSite, selectModules } from "@webaudit/modules";
import { UnsafeUrlError, assertPublicUrl, redactUrl, type SafetyPolicy } from "@webaudit/safety";
import { groupFindings } from "@webaudit/scoring";
import type { ArtifactStore } from "./artifacts";
import { writeReports } from "./reports";

export interface RunDeps {
  db: Db;
  artifacts: ArtifactStore;
  policy: SafetyPolicy;
  /** Tests/demo only: stub third-party requests in the browser for deterministic runs. */
  offlineExternal?: boolean;
  headless?: boolean;
  /** Mirror of audit events to the process log. */
  onLog?: (level: string, message: string) => void;
}

const BROWSER_MODULES = new Set(["M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09"]);
const req = createRequire(import.meta.url);
const pkgVersion = (name: string) => {
  try {
    return (req(`${name}/package.json`) as { version: string }).version;
  } catch {
    return "unknown";
  }
};

/**
 * Execute one audit end to end. Never throws for expected failures: the audit row's
 * status and error describe the outcome. Safe to re-run after a crash (re-checks URLs,
 * keeps the discovery ledger).
 */
export async function runAudit(auditId: string, deps: RunDeps): Promise<AuditStatus> {
  const { db } = deps;
  const audit = getAudit(db, auditId);
  if (!audit) throw new Error(`Audit ${auditId} not found`);
  if (["completed", "completed_partial", "failed", "cancelled_partial"].includes(audit.status))
    return audit.status;

  const config = audit.config;
  const log = (
    level: "debug" | "info" | "warn" | "error",
    message: string,
    phase?: string,
    data?: Record<string, unknown>,
  ) => {
    logEvent(db, auditId, level, message, phase, data);
    deps.onLog?.(level, `[${auditId}] ${message}`);
  };
  const setPhase = (phase: string) =>
    updateAudit(db, auditId, { phase, coverage: computeCoverage(db, auditId) });

  const modules = selectModules(config.modules);
  const engineVersions: Record<string, string> = {
    webaudit: ENGINE_VERSION,
    schema: String(SCHEMA_VERSION),
    node: process.version,
    playwright: pkgVersion("playwright"),
  };

  // Cooperative cancellation: polled from the DB so the web UI / CLI can cancel.
  const abort = new AbortController();
  // The deadline covers the whole audit, not only discovery: browser and Lighthouse
  // phases stop when it passes and the audit is reported as partial.
  const auditDeadline = Date.now() + config.auditDeadlineMs;
  let lateDeadlineHit = false;
  let cancelled = false;
  let pool: BrowserPool | undefined;
  const checkCancel = () => {
    if (!cancelled && isCancelRequested(db, auditId)) {
      cancelled = true;
      abort.abort();
      log("warn", "Cancellation requested; stopping safely", "cancel");
      void pool?.close();
    }
    return cancelled;
  };
  const watch = setInterval(checkCancel, 750);

  try {
    const existing = listUrls(db, auditId, { limit: 1 });
    const resuming = existing.length > 0;
    updateAudit(db, auditId, {
      status: "running",
      startedAt: audit.startedAt ?? new Date().toISOString(),
      error: null,
      engineVersions,
    });
    if (resuming) {
      // Crash recovery: keep discovery provenance, re-check anything not terminally excluded.
      db.$client
        .prepare(
          `UPDATE discovered_urls SET state = 'queued', reason = NULL WHERE audit_id = ? AND state IN ('discovered','attempted','checked','failed')`,
        )
        .run(auditId);
      db.$client.prepare(`DELETE FROM findings WHERE audit_id = ?`).run(auditId);
      log("warn", "Resuming an interrupted audit: previously checked URLs will be re-checked", "resume");
    }

    // ---- preflight ----
    setPhase("preflight");
    try {
      await assertPublicUrl(config.url, deps.policy);
    } catch (e) {
      const msg = e instanceof UnsafeUrlError ? e.message : `Preflight failed: ${(e as Error).message}`;
      log("error", msg, "preflight");
      updateAudit(db, auditId, {
        status: "failed",
        error: msg,
        finishedAt: new Date().toISOString(),
        phase: "done",
      });
      return "failed";
    }

    const wantsBrowser = modules.some((m) => BROWSER_MODULES.has(m.id));
    if (wantsBrowser || config.renderDiscovery) {
      pool = new BrowserPool({
        policy: deps.policy,
        device: config.device,
        userAgent: config.userAgent,
        headless: deps.headless ?? true,
        onBlocked: (target, reason) => log("warn", `Safety proxy blocked ${target}: ${reason}`, "browser"),
      });
      await pool.start();
    }

    // ---- discovery + HTTP fetch ----
    setPhase("discovery");
    const contexts = new Map<string, PageContext>();
    const resumeState = resuming
      ? (() => {
          const rows = listUrls(db, auditId);
          return {
            known: rows.map((r) => r.url),
            pending: rows
              .filter((r) => r.state === "queued")
              .map((r) => ({ url: r.url, depth: r.depth, source: r.source, sourceUrl: r.sourceUrl })),
            sitemapUrls: rows.filter((r) => r.inSitemap).map((r) => r.url),
          };
        })()
      : undefined;

    let crawlResult: CrawlResult;
    try {
      crawlResult = await crawl(
        config,
        deps.policy,
        {
          add: (entries) =>
            insertDiscovered(
              db,
              entries.map((e) => ({
                ...e,
                auditId,
                reason: e.reason ?? null,
                discoveredAt: new Date().toISOString(),
              })),
            ),
          update: (url, patch) => updateUrl(db, auditId, url, patch),
        },
        {
          onPage: async (p: FetchedPage) => {
            const ctx: PageContext = {
              auditId,
              url: p.url,
              http: { ...p.http, html: undefined },
              parsed: p.parsed,
              inSitemap: p.inSitemap,
              depth: p.depth,
            };
            contexts.set(p.url, ctx);
            saveSnapshot(db, {
              auditId,
              url: p.url,
              status: p.http.status,
              finalUrl: redactUrl(p.http.finalUrl),
              contentType: p.http.contentType,
              bytes: p.http.bytes,
              elapsedMs: p.http.elapsedMs,
              fetchedAt: p.http.fetchedAt,
              features: p.parsed
                ? {
                    title: p.parsed.titles[0],
                    metaDescription: p.parsed.metaDescriptions[0],
                    h1: p.parsed.headings.filter((h) => h.level === 1).map((h) => h.text),
                    canonical: p.parsed.canonicals[0],
                    lang: p.parsed.lang,
                    wordCount: p.parsed.wordCount,
                    contentHash: p.parsed.textHash,
                    simhash: p.parsed.simhash,
                    domSignature: p.parsed.domSignature,
                    internalLinks: p.parsed.links
                      .filter((l) => l.internal && l.url)
                      .map((l) => l.url!)
                      .slice(0, 200),
                    externalLinkCount: p.parsed.links.filter((l) => !l.internal).length,
                  }
                : null,
            });
          },
          isCancelled: checkCancel,
          log: (level, message, data) => log(level, message, "discovery", data),
          render:
            config.renderDiscovery && pool ? (u) => renderHtml(pool!, u, config.pageTimeoutMs) : undefined,
          onProgress: () => setPhase("discovery"),
        },
        resumeState,
      );
    } catch (e) {
      const msg = e instanceof UnsafeUrlError ? e.message : `Discovery failed: ${(e as Error).message}`;
      log("error", msg, "discovery");
      updateAudit(db, auditId, {
        status: "failed",
        error: msg,
        finishedAt: new Date().toISOString(),
        phase: "done",
        coverage: computeCoverage(db, auditId),
      });
      return "failed";
    }
    log(
      "info",
      `Discovery finished: ${crawlResult.stats.checked} checked, ${crawlResult.stats.discovered} discovered`,
      "discovery",
      { ...crawlResult.stats },
    );

    // ---- sampling ----
    setPhase("sampling");
    const httpFailures = new Map<string, number>();
    for (const ctx of contexts.values()) {
      const fs = await evaluatePage(ctx, modules, { auditId });
      httpFailures.set(ctx.url, fs.filter((f) => f.status === "fail").length);
    }
    const pages = [...contexts.values()].filter(
      (c) => !c.http.redirectChain.length || c.http.url === c.http.finalUrl,
    );
    const sampleInput = pages.map((c) => ({
      url: c.url,
      domSignature: c.parsed?.domSignature,
      failures: httpFailures.get(c.url) ?? 0,
      isHtml: !!c.parsed && c.http.status < 400,
    }));
    const { choices, policy: samplingPolicy } = selectSample(
      sampleInput,
      crawlResult.startUrl,
      wantsBrowser ? config.sampleSize : 0,
      config.mode,
    );
    for (const c of pages) {
      if (c.parsed)
        updateUrl(db, auditId, c.url, { templateCluster: clusterKey(c.url, c.parsed.domSignature) });
    }
    for (const ch of choices) updateUrl(db, auditId, ch.url, { sampled: true, sampleReason: ch.reason });
    log("info", samplingPolicy.description, "sampling");

    // ---- browser checks ----
    let browserFailures = 0;
    if (pool && choices.length && !cancelled) {
      setPhase("browser");
      // The safety denylist (logout, delete, cart…) also applies to in-browser navigations.
      const scope = {
        includeSubdomains: config.includeSubdomains,
        allowPaths: [],
        denyPaths: config.denyPaths,
      };
      const queue = [...choices];
      let axeVersion: string | undefined;
      const worker = async () => {
        for (let ch = queue.shift(); ch && !cancelled; ch = queue.shift()) {
          const ctx = contexts.get(ch.url)!;
          if (Date.now() > auditDeadline) {
            lateDeadlineHit = true;
            ctx.browserError = "Audit deadline reached before browser checks ran";
            continue;
          }
          try {
            const snap = await auditPage(pool!, ch.url, {
              inScope: (u) => inScope(u, crawlResult.startUrl, scope).ok,
              timeoutMs: config.pageTimeoutMs,
              runAxe: config.modules.includes("M03"),
              observeAfterConsent: true,
              offlineExternal: deps.offlineExternal ? { policy: deps.policy } : undefined,
              screenshot: async (buf) => {
                const name = `shot-${sha1(ch!.url).slice(0, 12)}.jpg`;
                const put = await deps.artifacts.put(auditId, name, buf);
                addArtifact(db, {
                  auditId,
                  url: ch!.url,
                  kind: "screenshot",
                  path: put.path,
                  contentType: "image/jpeg",
                  bytes: put.bytes,
                });
                return put.path;
              },
            });
            ctx.browser = snap;
            if (snap.axe && !("error" in snap.axe)) axeVersion = snap.axe.version;
            for (const [step, err] of Object.entries(snap.stepErrors))
              log("warn", `Browser step "${step}" on ${redactUrl(ch.url)}: ${err}`, "browser");
          } catch (e) {
            if (cancelled) return;
            browserFailures++;
            ctx.browserError = (e as Error).message.split("\n")[0]!.slice(0, 200);
            log("warn", `Browser check failed for ${redactUrl(ch.url)}: ${ctx.browserError}`, "browser");
          }
        }
      };
      await Promise.all(Array.from({ length: config.browserConcurrency }, worker));
      if (axeVersion) engineVersions["axe-core"] = axeVersion;

      // ---- Lighthouse (serial, isolated processes) ----
      if (config.lighthouse && config.modules.includes("M02") && !cancelled) {
        setPhase("lighthouse");
        const lhTargets = choices
          .filter((c) => contexts.get(c.url)?.browser)
          .slice(0, config.lighthouseMaxPages);
        for (const ch of lhTargets) {
          if (checkCancel()) break;
          if (Date.now() > auditDeadline) {
            lateDeadlineHit = true;
            log("warn", "Audit deadline reached; remaining Lighthouse runs skipped", "lighthouse");
            break;
          }
          const ctx = contexts.get(ch.url)!;
          const name = `lh-${sha1(ch.url).slice(0, 12)}.json`;
          const reportPath = await deps.artifacts.localPath(auditId, name);
          const r = await runLighthouse({
            url: ch.url,
            chromePath: chromium.executablePath(),
            proxyUrl: pool.proxyUrl,
            formFactor: config.device,
            timeoutMs: Math.max(90_000, config.pageTimeoutMs * 3),
            reportPath,
            signal: abort.signal,
          });
          if ("error" in r)
            log("warn", `Lighthouse failed for ${redactUrl(ch.url)}: ${r.error}`, "lighthouse");
          else {
            engineVersions.lighthouse = r.version;
            addArtifact(db, {
              auditId,
              url: ch.url,
              kind: "lighthouse",
              path: `${auditId}/${name}`,
              contentType: "application/json",
              bytes: 0,
            });
            r.reportRef = `${auditId}/${name}`;
          }
          ctx.browser!.lighthouse = r;
        }
      }
      for (const ch of choices) {
        const ctx = contexts.get(ch.url)!;
        if (ctx.browser) {
          const { renderedHtml: _omit, ...browser } = ctx.browser;
          saveSnapshot(db, {
            auditId,
            url: ctx.url,
            status: ctx.http.status,
            finalUrl: redactUrl(ctx.http.finalUrl),
            contentType: ctx.http.contentType,
            bytes: ctx.http.bytes,
            elapsedMs: ctx.http.elapsedMs,
            fetchedAt: ctx.http.fetchedAt,
            browser,
          });
          ctx.browser.renderedHtml = "";
        }
      }
    }
    await pool?.close();
    pool = undefined;

    // ---- analysis ----
    setPhase("analysis");
    const findings: Finding[] = [];
    for (const ctx of contexts.values())
      findings.push(...(await evaluatePage(ctx, modules, { auditId, disabledRules: config.disabledRules })));
    const statusByUrl: SiteContext["statusByUrl"] = new Map();
    for (const r of listUrls(db, auditId)) {
      statusByUrl.set(
        r.url,
        r.state === "checked"
          ? (r.httpStatus ?? 0)
          : r.state === "failed"
            ? "failed"
            : r.state === "blocked_robots"
              ? "blocked"
              : "skipped",
      );
    }
    findings.push(
      ...(await evaluateSite(
        {
          auditId,
          startUrl: crawlResult.startUrl,
          pages: [...contexts.values()],
          sitemapUrls: crawlResult.sitemapUrls,
          links: crawlResult.links,
          statusByUrl,
        },
        modules,
        { auditId, disabledRules: config.disabledRules },
      )),
    );
    insertFindings(db, findings);
    const { groups, assignments } = groupFindings({
      findings,
      startUrl: crawlResult.startUrl,
      priorityPaths: config.priorityPaths,
    });
    replaceGroups(
      db,
      auditId,
      groups.map(({ findingIds: _f, ...g }) => ({ ...g, auditId })),
    );
    setGroupSignatures(db, assignments);

    const status: AuditStatus =
      cancelled || crawlResult.cancelled
        ? "cancelled_partial"
        : crawlResult.deadlineHit || lateDeadlineHit || browserFailures > 0
          ? "completed_partial"
          : "completed";
    updateAudit(db, auditId, {
      status,
      phase: "reporting",
      coverage: computeCoverage(db, auditId),
      engineVersions,
      samplingPolicy: {
        sampling: samplingPolicy,
        discovery: {
          robots: crawlResult.robots
            ? {
                status: crawlResult.robots.status,
                interpretation: crawlResult.robots.interpretation,
                sitemaps: crawlResult.robots.sitemaps,
              }
            : null,
          sitemaps: crawlResult.sitemaps
            ? { sources: crawlResult.sitemaps.sources, truncated: crawlResult.sitemaps.truncated }
            : null,
          overflow: crawlResult.stats.overflow,
          externalLinks: crawlResult.stats.externalLinks,
          deadlineHit: crawlResult.deadlineHit || lateDeadlineHit,
        },
        browserFailures,
      },
    });

    try {
      await writeReports(db, deps.artifacts, auditId);
    } catch (e) {
      log("error", `Report generation failed: ${(e as Error).message}`, "reporting");
    }
    updateAudit(db, auditId, { phase: "done", finishedAt: new Date().toISOString() });
    log(
      "info",
      `Audit ${status}: ${groups.length} issue groups from ${findings.filter((f) => f.status === "fail").length} failing checks`,
      "done",
    );
    return status;
  } catch (e) {
    const msg = `Unexpected error: ${(e as Error).message}`;
    log("error", msg, "error", { stack: (e as Error).stack?.split("\n").slice(0, 5).join("\n") });
    updateAudit(db, auditId, {
      status: cancelled ? "cancelled_partial" : "failed",
      error: msg,
      finishedAt: new Date().toISOString(),
      phase: "done",
      coverage: computeCoverage(db, auditId),
    });
    return cancelled ? "cancelled_partial" : "failed";
  } finally {
    clearInterval(watch);
    await pool?.close();
  }
}
