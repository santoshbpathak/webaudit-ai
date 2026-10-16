import type { AuditModule, PageContext, RuleResult } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { check, fail, na, naAll, notHtmlReason, pass, repro, rules } from "./helpers";
import { extractIds, observeTrackers } from "./trackers";

const R = rules([
  {
    id: "M04-GA4-NOT-OBSERVED",
    module: "M04",
    title: "No GA4 tag or hit observed on this page",
    severity: "high",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "If GA4 does not load on a page, its visits and conversions are invisible in reporting — common on landing pages built outside the main template.",
    remediation:
      "Add the site's GA4 tag (directly or via GTM) to this template and verify a page_view in GA4 DebugView.",
    caveat:
      "Not observed in the tested page load without consent interaction; tags gated behind consent, ad blockers or later events may exist.",
    applicability: "Pages that received browser checks",
  },
  {
    id: "M04-GA4-PAGEVIEW-NOT-OBSERVED",
    module: "M04",
    title: "GA4 tag present but no page_view hit observed",
    severity: "medium",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "A loaded tag that never sends a page_view usually means a misconfigured config tag or a consent setup that suppresses all hits.",
    remediation:
      "Check the GA4 configuration tag fires on this page (GTM Preview / DebugView). Measurement IDs seen: {ids}.",
    caveat: "Not observed in the tested flow — consent mode may delay hits until consent is granted.",
    applicability: "Pages where a GA4 tag was observed",
  },
  {
    id: "M04-GA4-DUPLICATE-PAGEVIEW",
    module: "M04",
    title: "Duplicate GA4 page_view hits",
    severity: "high",
    confidence: "verified",
    layer: "browser",
    rationale:
      "Double-firing inflates sessions and page views and deflates engagement and conversion rates — decisions get made on wrong numbers.",
    remediation:
      "Remove the duplicate page_view source (often a hard-coded gtag plus a GTM GA4 tag) for {ids}.",
    applicability: "Pages with GA4 hits",
  },
  {
    id: "M04-GTM-MULTIPLE",
    module: "M04",
    title: "More than one GTM container",
    severity: "low",
    confidence: "manual_review",
    layer: "browser",
    rationale:
      "Multiple containers are sometimes intentional (agency + in-house) but often cause duplicate tags and conflicting triggers.",
    remediation: "Confirm each container's purpose and that tags are not duplicated across: {ids}.",
    applicability: "Pages where GTM was observed",
  },
  {
    id: "M04-GA4-MULTIPLE-IDS",
    module: "M04",
    title: "Multiple GA4 measurement IDs",
    severity: "low",
    confidence: "manual_review",
    layer: "browser",
    rationale:
      "Sending to several GA4 properties can be deliberate (roll-up property) or a leftover from migrations that splits data.",
    remediation: "Confirm each property is intended: {ids}.",
    applicability: "Pages where GA4 was observed",
  },
  {
    id: "M04-DATALAYER-MISSING",
    module: "M04",
    title: "GTM present but dataLayer is empty",
    severity: "medium",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "Without dataLayer pushes GTM can only scrape the DOM, which makes conversion and attribution tracking fragile.",
    remediation:
      "Push page and user context (page_type, content group, product data) to window.dataLayer before the GTM snippet.",
    applicability: "Pages where GTM was observed",
  },
  {
    id: "M04-UA-LEGACY",
    module: "M04",
    title: "Legacy Universal Analytics code still present",
    severity: "low",
    confidence: "verified",
    layer: "browser",
    rationale: "Universal Analytics stopped processing data; legacy code adds page weight and confusion.",
    remediation: "Remove analytics.js / UA- tags and related GTM tags.",
    applicability: "Pages that received browser checks",
  },
]);

const IDS = R.map((r) => r.id);

function runPage(ctx: PageContext): RuleResult[] {
  const url = ctx.url;
  const reason = notHtmlReason(ctx);
  if (reason) return naAll(IDS, url, reason);
  if (!ctx.browser) return []; // engine fills not_tested for browser rules
  const b = ctx.browser;
  const obs = observeTrackers(b.requests);
  const texts = [
    ...b.requests.map((r) => r.url),
    ctx.parsed?.inlineScripts ?? "",
    ...(ctx.parsed?.scriptSrcs ?? []),
  ];
  const gtmIds = extractIds(texts, "GTM");
  const ga4Ids = extractIds(texts, "G");
  const ga4 = obs.find((o) => o.tracker.id === "ga4");
  const ua = obs.find((o) => o.tracker.id === "ua");
  const ga4Present = !!ga4 || ga4Ids.length > 0;
  const pageViews = (ga4?.hits ?? []).filter(
    (h) => /[?&]en=page_view\b/.test(h.url) || /en=page_view/.test(h.postDataExcerpt ?? ""),
  );
  const net = repro.devtoolsNetwork(url, "collect");
  const out: RuleResult[] = [];

  out.push(
    check(!ga4Present, "M04-GA4-NOT-OBSERVED", url, {
      observed: { requestsObserved: b.requests.length },
      reproSteps: [
        ...repro.devtoolsNetwork(url, "gtag|collect"),
        "No GA4 library or /g/collect request appears",
      ],
    }),
  );
  if (ga4Present) {
    out.push(
      check(pageViews.length === 0, "M04-GA4-PAGEVIEW-NOT-OBSERVED", url, {
        observed: { ids: ga4Ids.join(", ") || "unknown", hits: ga4?.hits.length ?? 0 },
        reproSteps: net,
      }),
    );
    const perId = new Map<string, number>();
    for (const h of pageViews) {
      const tid = /[?&]tid=(G-[A-Z0-9]+)/.exec(h.url)?.[1] ?? "unknown";
      perId.set(tid, (perId.get(tid) ?? 0) + 1);
    }
    const dup = [...perId.entries()].filter(([, n]) => n > 1);
    out.push(
      pageViews.length
        ? check(dup.length > 0, "M04-GA4-DUPLICATE-PAGEVIEW", url, {
            requestUrl: pageViews[0]!.url,
            observed: { ids: dup.map(([id, n]) => `${id} ×${n}`).join(", ") },
            reproSteps: [...net, "Count page_view hits per measurement ID (tid)"],
          })
        : na("M04-GA4-DUPLICATE-PAGEVIEW", url, "No page_view hits observed"),
    );
    out.push(
      check(ga4Ids.length > 1, "M04-GA4-MULTIPLE-IDS", url, {
        observed: { ids: ga4Ids.join(", ") },
        reproSteps: net,
      }),
    );
  } else {
    out.push(na("M04-GA4-PAGEVIEW-NOT-OBSERVED", url, "No GA4 tag observed"));
    out.push(na("M04-GA4-DUPLICATE-PAGEVIEW", url, "No GA4 tag observed"));
    out.push(na("M04-GA4-MULTIPLE-IDS", url, "No GA4 tag observed"));
  }

  if (gtmIds.length || obs.some((o) => o.tracker.id === "gtm")) {
    out.push(
      check(gtmIds.length > 1, "M04-GTM-MULTIPLE", url, {
        observed: { ids: gtmIds.join(", ") },
        reproSteps: repro.devtoolsNetwork(url, "gtm.js"),
      }),
    );
    const meaningful = b.dataLayer.filter((e) => {
      if (!e || typeof e !== "object") return false;
      const ev = (e as Record<string, unknown>).event;
      return !(typeof ev === "string" && ev.startsWith("gtm."));
    });
    out.push(
      check(meaningful.length === 0, "M04-DATALAYER-MISSING", url, {
        observed: { entries: b.dataLayer.length },
        reproSteps: [`Open ${url}`, "In the console run: window.dataLayer"],
      }),
    );
  } else {
    out.push(na("M04-GTM-MULTIPLE", url, "No GTM container observed"));
    out.push(na("M04-DATALAYER-MISSING", url, "No GTM container observed"));
  }

  const uaIds = extractIds(texts, "UA");
  out.push(
    ua || uaIds.length
      ? fail("M04-UA-LEGACY", url, {
          observed: { ids: uaIds.join(", ") },
          reproSteps: repro.devtoolsNetwork(url, "analytics.js"),
        })
      : pass("M04-UA-LEGACY", url),
  );
  return out;
}

export const m04Analytics: AuditModule = {
  id: "M04",
  name: "GA4 / GTM",
  version: "1.0.0",
  rules: R,
  runPage,
  explain: explainFrom(R),
};
