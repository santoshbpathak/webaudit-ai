import type { AuditModule, PageContext, RuleResult } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { check, na, naAll, notHtmlReason, repro, rules } from "./helpers";
import { observeTrackers } from "./trackers";

const R = rules([
  {
    id: "M05-PIXEL-DUPLICATE",
    module: "M05",
    title: "Ad pixel library loaded more than once",
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale:
      "Loading the same pixel twice commonly double-counts conversions, inflating reported ROAS and confusing bidding algorithms.",
    remediation: "Keep a single installation (prefer the tag manager) for: {vendors}.",
    caveat: "Observed in a single page load; event-level duplication may need a test conversion to confirm.",
    applicability: "Pages with ad pixels observed",
  },
  {
    id: "M05-PIXEL-LOAD-FAILED",
    module: "M05",
    title: "Ad pixel library failed to load",
    severity: "low",
    confidence: "heuristic",
    layer: "browser",
    rationale: "A pixel that errors on load records nothing — campaigns optimise blind.",
    remediation: "Check the tag configuration and CSP for: {vendors}.",
    caveat: "Live audits through the safety proxy may block some requests; confirm in a normal browser.",
    applicability: "Pages with ad pixels observed",
  },
]);

function runPage(ctx: PageContext): RuleResult[] {
  const url = ctx.url;
  const reason = notHtmlReason(ctx);
  if (reason)
    return naAll(
      R.map((r) => r.id),
      url,
      reason,
    );
  if (!ctx.browser) return [];
  const ads = observeTrackers(ctx.browser.requests).filter((o) => o.tracker.category === "advertising");
  if (!ads.length) return R.map((r) => na(r.id, url, "No ad pixels observed"));

  // Count both network loads and <script> elements: a second identical script tag is
  // usually served from memory cache and never shows up as a network request.
  const scripts = ctx.browser.scripts ?? [];
  const dup = ads
    .map((o) => {
      const net = new Map<string, number>();
      for (const l of o.libraryLoads) net.set(l.url, (net.get(l.url) ?? 0) + 1);
      const dom = new Map<string, number>();
      for (const src of scripts)
        if (o.tracker.library.some((re) => re.test(src))) dom.set(src, (dom.get(src) ?? 0) + 1);
      const max = Math.max(0, ...net.values(), ...dom.values());
      return { vendor: o.tracker.vendor, max, url: [...net.keys(), ...dom.keys()][0] };
    })
    .filter((d) => d.max > 1);
  const failed = ads.filter((o) =>
    o.libraryLoads.some((l) => (l.status ?? 0) >= 400 || (l.blocked && !/blockedbyclient/i.test(l.blocked))),
  );

  return [
    check(dup.length > 0, "M05-PIXEL-DUPLICATE", url, {
      requestUrl: dup[0]?.url,
      observed: {
        vendors: dup.map((d) => `${d.vendor} ×${d.max}`).join(", "),
        inventory: ads.map((a) => a.tracker.vendor),
      },
      reproSteps: repro.devtoolsNetwork(url, dup[0]?.url ? new URL(dup[0].url).hostname : "pixel"),
    }),
    check(failed.length > 0, "M05-PIXEL-LOAD-FAILED", url, {
      observed: { vendors: failed.map((f) => f.tracker.vendor).join(", ") },
      reproSteps: repro.devtoolsNetwork(url, "pixel"),
    }),
  ];
}

export const m05Pixels: AuditModule = {
  id: "M05",
  name: "Ad tracking",
  version: "1.0.0",
  rules: R,
  runPage,
  explain: explainFrom(R),
};
