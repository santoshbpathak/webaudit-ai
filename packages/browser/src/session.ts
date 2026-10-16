import AxeBuilder from "@axe-core/playwright";
import type { Page, Request, Route } from "playwright";
import type { AxeViolation, BrowserSnapshot, ObservedCookie, ObservedRequest } from "@webaudit/core";
import { isAllowlisted, redactBody, redactUrl, type SafetyPolicy } from "@webaudit/safety";
import { collectInPage } from "./inpage";
import type { BrowserPool } from "./pool";

export interface PageAuditOptions {
  /** Is a URL inside the audit scope? Used to block out-of-scope main-frame navigations. */
  inScope: (url: string) => boolean;
  timeoutMs: number;
  runAxe: boolean;
  /** Click the consent banner's accept button to observe post-consent tags (M04/M08). */
  observeAfterConsent: boolean;
  screenshot?: (buf: Buffer) => Promise<string>;
  /**
   * Tests/demo only: fulfil requests to non-allowlisted hosts with empty responses so
   * runs are deterministic and offline. Requests are still recorded.
   */
  offlineExternal?: { policy: SafetyPolicy };
  /** Hard wall-clock limit for the whole page session (default 4 × timeoutMs). */
  hardTimeoutMs?: number;
}

/**
 * Page JS can block the renderer (e.g. an infinite loop after load), and page.evaluate,
 * axe and page.content() then wait forever. Closing the context from the browser process
 * kills the renderer and rejects every pending call, so one hostile page cannot pin a
 * worker or the job lease.
 */
const HARD_LIMIT = "Page session exceeded its hard time limit and was terminated";

function watchdog(ctx: { close(): Promise<void> }, ms: number) {
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    ctx.close().catch(() => undefined);
  }, ms);
  return {
    clear: () => clearTimeout(timer),
    get fired() {
      return fired;
    },
  };
}

const BEACON_HOSTS =
  /google-analytics\.com|analytics\.google\.com|googletagmanager\.com|facebook\.com\/tr|doubleclick\.net|linkedin\.com|licdn\.com|tiktok\.com|bing\.com|clarity\.ms|hotjar|twitter\.com|t\.co|ads-twitter|snapchat|pinterest/i;

function emptyBodyFor(resourceType: string): { contentType: string; body: string } {
  if (resourceType === "script") return { contentType: "application/javascript", body: "/* offline stub */" };
  if (resourceType === "stylesheet") return { contentType: "text/css", body: "" };
  if (resourceType === "image") return { contentType: "image/gif", body: "" };
  return { contentType: "text/plain", body: "" };
}

export async function auditPage(
  pool: BrowserPool,
  url: string,
  opts: PageAuditOptions,
): Promise<BrowserSnapshot> {
  const ctx = await pool.newContext();
  const dog = watchdog(ctx, opts.hardTimeoutMs ?? opts.timeoutMs * 4);
  const stepErrors: Record<string, string> = {};
  const requests: ObservedRequest[] = [];
  const byRequest = new Map<Request, ObservedRequest>();
  let consentPhase: "before" | "after" = "before";
  let initialNavDone = false;

  try {
    const page = await ctx.newPage();
    page.setDefaultTimeout(opts.timeoutMs);

    await page.route("**/*", async (route: Route) => {
      const req = route.request();
      const isMainNav = req.isNavigationRequest() && req.frame() === page.mainFrame();
      // Never submit anything: block main-frame POST navigations (form submits). T11.
      if (isMainNav && req.method() !== "GET") return route.abort("blockedbyclient");
      // After the page loads, block navigations away from scope (popups, JS redirects).
      if (isMainNav && initialNavDone && !opts.inScope(req.url())) return route.abort("blockedbyclient");
      if (opts.offlineExternal) {
        const host = new URL(req.url()).hostname;
        if (!isAllowlisted(opts.offlineExternal.policy, host)) {
          const stub = emptyBodyFor(req.resourceType());
          return route.fulfill({
            status: req.method() === "POST" ? 204 : 200,
            contentType: stub.contentType,
            body: stub.body,
          });
        }
      }
      return route.continue();
    });

    page.on("request", (req) => {
      if (requests.length >= 1_500) return;
      const u = req.url();
      if (u.startsWith("data:") || u.startsWith("blob:")) return;
      const post = req.postData();
      const rec: ObservedRequest = {
        url: redactUrl(u),
        method: req.method(),
        resourceType: req.resourceType(),
        beforeConsent: consentPhase === "before",
        postDataExcerpt: post && BEACON_HOSTS.test(u) ? redactBody(post) : undefined,
      };
      requests.push(rec);
      byRequest.set(req, rec);
    });
    page.on("response", (res) => {
      const rec = byRequest.get(res.request());
      if (rec) rec.status = res.status();
    });
    page.on("requestfailed", (req) => {
      const rec = byRequest.get(req);
      if (rec) rec.blocked = req.failure()?.errorText ?? "failed";
    });
    page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
    page.on("popup", (p) => void p.close().catch(() => undefined));

    const response = await page.goto(url, { waitUntil: "load", timeout: opts.timeoutMs });
    initialNavDone = true;
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    const finalUrl = page.url();
    const deviceViewport = page.viewportSize();

    const inpage = await page.evaluate(collectInPage).catch((e: Error) => {
      stepErrors.inpage = e.message.split("\n")[0]!.slice(0, 200);
      return null;
    });
    const cookiesBefore = await readCookies(page, finalUrl);

    let screenshotRef: string | undefined;
    if (opts.screenshot) {
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 70, fullPage: false });
        screenshotRef = await opts.screenshot(buf);
      } catch (e) {
        stepErrors.screenshot = (e as Error).message.split("\n")[0]!.slice(0, 200);
      }
    }

    let axe: BrowserSnapshot["axe"];
    if (opts.runAxe) {
      try {
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
          .analyze();
        axe = {
          version: result.testEngine.version,
          violations: result.violations.map((v): AxeViolation => ({
            id: v.id,
            impact: (v.impact ?? null) as AxeViolation["impact"],
            help: v.help,
            helpUrl: v.helpUrl,
            tags: v.tags,
            nodes: v.nodes.slice(0, 10).map((n) => ({
              target: n.target.map(String).join(" "),
              html: n.html.slice(0, 300),
              failureSummary: n.failureSummary?.slice(0, 300),
            })),
          })),
          passes: result.passes.map((r) => r.id),
          inapplicable: result.inapplicable.map((r) => r.id),
          incomplete: result.incomplete.map((r) => ({
            id: r.id,
            impact: (r.impact ?? null) as AxeViolation["impact"],
            help: r.help,
            helpUrl: r.helpUrl,
          })),
        };
      } catch (e) {
        axe = { error: (e as Error).message.slice(0, 300) };
      }
    }

    const renderedHtml = await page.content().catch(() => "");

    // Post-consent observation: click "accept" (never a form submit) and record new requests.
    if (opts.observeAfterConsent && inpage?.consent.acceptSelector) {
      try {
        consentPhase = "after";
        // Fixed-position banners often fail Playwright's actionability checks under mobile
        // emulation; force the click, falling back to a DOM click. Never a form submit.
        const sel = inpage.consent.acceptSelector;
        await page
          .click(sel, { timeout: 3_000, noWaitAfter: true, force: true })
          .catch(() => page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel));
        await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
      } catch (e) {
        stepErrors.consent_accept = (e as Error).message.split("\n")[0]!.slice(0, 200);
      }
    }
    const cookiesAll = await readCookies(page, finalUrl);

    if (response && response.status() >= 400) stepErrors.navigation = `HTTP ${response.status()}`;

    // Steps catch their own errors; a terminated session must not pass as a partial success.
    if (dog.fired) throw new Error(HARD_LIMIT);
    return {
      finalUrl: redactUrl(finalUrl),
      title: inpage?.title ?? "",
      renderedHtml,
      requests,
      cookies: cookiesAll,
      dataLayer: inpage?.dataLayer ?? [],
      forms: inpage?.forms ?? [],
      ctas: inpage?.ctas ?? [],
      // Device viewport, not innerWidth: mobile Chrome widens the layout viewport to fit
      // overflowing content, which would hide the very overflow we want to detect.
      viewport: deviceViewport ?? inpage?.viewport ?? { width: 0, height: 0 },
      documentWidth: inpage?.documentWidth ?? 0,
      smallTapTargets: inpage?.smallTapTargets ?? [],
      brokenImages: (inpage?.brokenImages ?? []).map((b) => ({ ...b, src: redactUrl(b.src) })),
      scripts: (inpage?.scripts ?? []).map(redactUrl),
      consent: {
        bannerDetected: inpage?.consent.bannerDetected ?? false,
        cmp: inpage?.consent.cmp,
        bannerSelector: inpage?.consent.bannerSelector,
        acceptSelector: inpage?.consent.acceptSelector,
        rejectSelector: inpage?.consent.rejectSelector,
        preCheckedOptions: inpage?.consent.preCheckedOptions ?? [],
        cookiesBeforeConsent: cookiesBefore,
        storageKeysBeforeConsent: inpage?.storageKeys ?? [],
      },
      screenshotRef,
      axe,
      stepErrors,
    };
  } catch (e) {
    if (dog.fired) throw new Error(HARD_LIMIT, { cause: e });
    throw e;
  } finally {
    dog.clear();
    await ctx.close().catch(() => undefined);
  }
}

async function readCookies(page: Page, pageUrl: string): Promise<ObservedCookie[]> {
  const host = new URL(pageUrl).hostname.replace(/^www\./, "");
  const cookies = await page
    .context()
    .cookies()
    .catch(() => []);
  return cookies.slice(0, 200).map((c) => ({
    name: c.name,
    domain: c.domain,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    expires: c.expires,
    firstParty: c.domain
      .replace(/^\./, "")
      .replace(/^www\./, "")
      .endsWith(host),
  }));
}

/** Rendered HTML only — used for JS link discovery (CR-08). */
export async function renderHtml(pool: BrowserPool, url: string, timeoutMs: number): Promise<string | null> {
  const ctx = await pool.newContext();
  const dog = watchdog(ctx, timeoutMs * 2);
  try {
    const page = await ctx.newPage();
    await page.route("**/*", (route) => {
      const req = route.request();
      // Same no-side-effects rule as auditPage: never follow a form-style POST navigation.
      if (req.isNavigationRequest() && req.method() !== "GET") return route.abort("blockedbyclient");
      return ["image", "media", "font"].includes(req.resourceType()) ? route.abort() : route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
    return await page.content();
  } catch {
    return null;
  } finally {
    dog.clear();
    await ctx.close().catch(() => undefined);
  }
}
