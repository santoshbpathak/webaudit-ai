import type { AuditModule, LighthouseSummary, PageContext, RuleResult, Severity } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { check, fail, inconclusive, naAll, notHtmlReason, notTested, pass, rules } from "./helpers";

const LAB =
  "Lighthouse lab data (simulated throttling) — not field Core Web Vitals; scores vary between runs.";

const R = rules([
  {
    id: "M02-LH-PERFORMANCE",
    module: "M02",
    title: "Lighthouse lab performance score below 90",
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale: "Slow pages lose visitors before they see your offer, and paid clicks are wasted on bounces.",
    remediation: "Work through the specific metric findings below. Lighthouse lab score: {score}.",
    caveat: LAB,
    applicability: "Pages where Lighthouse ran",
  },
  {
    id: "M02-LCP",
    module: "M02",
    title: "Slow Largest Contentful Paint (lab)",
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale: "LCP is when the main content appears; above 2.5 s visitors perceive the page as slow.",
    remediation:
      "Optimise the LCP element (compress/size hero images, preload it, reduce server time). Lab LCP: {lcp} s.",
    caveat: LAB,
    applicability: "Pages where Lighthouse ran",
  },
  {
    id: "M02-CLS",
    module: "M02",
    title: "Layout shift above 0.1 (lab)",
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale: "Content jumping around causes mis-clicks and frustration.",
    remediation: "Reserve space for images, ads and embeds (width/height or aspect-ratio). Lab CLS: {cls}.",
    caveat: LAB,
    applicability: "Pages where Lighthouse ran",
  },
  {
    id: "M02-TBT",
    module: "M02",
    title: "High Total Blocking Time (lab)",
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale:
      "Long main-thread tasks make the page unresponsive to taps — often caused by heavy third-party tags.",
    remediation: "Defer or remove heavy scripts (tag audits, code-splitting). Lab TBT: {tbt} ms.",
    caveat: LAB,
    applicability: "Pages where Lighthouse ran",
  },
  {
    id: "M02-PAGE-WEIGHT",
    module: "M02",
    title: "Heavy page (over 3 MB transferred)",
    severity: "low",
    confidence: "verified",
    layer: "browser",
    rationale: "Large pages are slow on mobile networks and cost visitors data.",
    remediation:
      "Compress images (WebP/AVIF), lazy-load below-the-fold media, trim scripts. Transferred: {mb} MB.",
    caveat: LAB,
    applicability: "Pages where Lighthouse ran",
  },
  {
    id: "M02-RENDER-BLOCKING",
    module: "M02",
    title: "Render-blocking resources delay first paint",
    severity: "low",
    confidence: "verified",
    layer: "browser",
    rationale: "Scripts and styles that block rendering push back the moment anything appears.",
    remediation: "Defer/async non-critical scripts and inline critical CSS: {resources}.",
    caveat: LAB,
    applicability: "Pages where Lighthouse ran",
  },
]);

const IDS = R.map((r) => r.id);
const sev = (v: number, mid: number, high: number): Severity | undefined =>
  v > high ? "high" : v > mid ? "medium" : undefined;

function runPage(ctx: PageContext): RuleResult[] {
  const url = ctx.url;
  const reason = notHtmlReason(ctx);
  if (reason) return naAll(IDS, url, reason);
  if (!ctx.browser) return [];
  const lh = ctx.browser.lighthouse;
  if (!lh)
    return IDS.map((id) => notTested(id, url, "Lighthouse not run on this page (outside Lighthouse sample)"));
  if ("error" in lh) return IDS.map((id) => inconclusive(id, url, `Lighthouse failed: ${lh.error}`));
  const s: LighthouseSummary = lh;
  const m = s.metrics;
  const steps = [
    `Run Lighthouse (mobile, performance) on ${url}`,
    `Compare with field data in PageSpeed Insights / CrUX`,
  ];
  const ev = (observed: Record<string, unknown>) => ({
    traceRef: s.reportRef,
    observed: { ...observed, lighthouseVersion: s.version },
    reproSteps: steps,
  });
  const out: RuleResult[] = [];

  if (s.performanceScore === null)
    out.push(inconclusive("M02-LH-PERFORMANCE", url, "No performance score returned"));
  else {
    const score = Math.round(s.performanceScore * 100);
    out.push(
      score < 90
        ? fail("M02-LH-PERFORMANCE", url, ev({ score }), { severity: score < 50 ? "high" : "medium" })
        : pass("M02-LH-PERFORMANCE", url, ev({ score })),
    );
  }
  const metric = (
    id: string,
    v: number | undefined,
    mid: number,
    high: number,
    obs: Record<string, unknown>,
  ) => {
    if (v === undefined) return inconclusive(id, url, "Metric not reported");
    const sv = sev(v, mid, high);
    return sv ? fail(id, url, ev(obs), { severity: sv }) : pass(id, url, ev(obs));
  };
  out.push(
    metric("M02-LCP", m.lcpMs, 2500, 4000, { lcp: m.lcpMs ? (m.lcpMs / 1000).toFixed(1) : undefined }),
  );
  out.push(metric("M02-CLS", m.cls, 0.1, 0.25, { cls: m.cls?.toFixed(3) }));
  out.push(metric("M02-TBT", m.tbtMs, 200, 600, { tbt: m.tbtMs ? Math.round(m.tbtMs) : undefined }));
  out.push(
    m.totalByteWeight === undefined
      ? inconclusive("M02-PAGE-WEIGHT", url, "Byte weight not reported")
      : check(
          m.totalByteWeight > 3_000_000,
          "M02-PAGE-WEIGHT",
          url,
          ev({ mb: (m.totalByteWeight / 1_048_576).toFixed(2) }),
          {
            severity: m.totalByteWeight > 6_000_000 ? "medium" : "low",
          },
        ),
  );
  const rb = s.renderBlocking;
  out.push(
    check(
      rb.length > 0,
      "M02-RENDER-BLOCKING",
      url,
      ev({
        resources: rb
          .slice(0, 5)
          .map((r) => `${r.url}${r.wastedMs ? ` (~${r.wastedMs} ms)` : ""}`)
          .join(", "),
      }),
    ),
  );
  return out;
}

export const m02Performance: AuditModule = {
  id: "M02",
  name: "Performance",
  version: "1.0.0",
  rules: R,
  runPage,
  explain: explainFrom(R),
};
