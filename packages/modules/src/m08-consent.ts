import type { AuditModule, PageContext, RuleResult } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { check, na, naAll, notHtmlReason, repro, rules } from "./helpers";
import { isConsentModeDeniedPing, isTrackingCookie, observeTrackers } from "./trackers";

const CAVEAT =
  "Privacy indicator, not a legal or compliance determination. Requirements differ by jurisdiction (GDPR, ePrivacy, DPDP, CCPA); consult a privacy specialist.";

const R = rules([
  {
    id: "M08-TRACKING-BEFORE-CONSENT",
    module: "M08",
    title: "Marketing/analytics requests fire before consent",
    severity: "high",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "A consent banner is shown, but trackers send data before the visitor chooses — the banner is not actually controlling tags.",
    remediation:
      "Gate these tags on consent (e.g. GTM consent settings or Consent Mode with default 'denied'): {vendors}.",
    caveat: CAVEAT,
    applicability: "Pages with a detected consent banner",
  },
  {
    id: "M08-NO-CONSENT-BANNER",
    module: "M08",
    title: "Trackers present but no consent banner detected",
    severity: "medium",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "Where consent is required, loading marketing tags with no visible choice is a common compliance risk.",
    remediation:
      "Review whether a consent mechanism is required for your audiences; trackers observed: {vendors}.",
    caveat: `${CAVEAT} Custom banners may not be recognised.`,
    applicability: "Pages with trackers and no detected banner",
  },
  {
    id: "M08-COOKIES-BEFORE-CONSENT",
    module: "M08",
    title: "Tracking cookies set before consent",
    severity: "medium",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "Analytics/advertising cookies written on first load, before any choice, undermine the consent banner.",
    remediation: "Delay these cookies until consent: {cookies}.",
    caveat: CAVEAT,
    applicability: "Pages with a detected consent banner",
  },
  {
    id: "M08-PRECHECKED-OPTIONS",
    module: "M08",
    title: "Consent banner has pre-checked optional categories",
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale: "Pre-ticked boxes are not considered freely given consent in many regimes.",
    remediation: "Leave optional categories unticked by default: {options}.",
    caveat: CAVEAT,
    applicability: "Pages with a detected consent banner",
  },
  {
    id: "M08-NO-REJECT-OPTION",
    module: "M08",
    title: "No reject option on the first banner layer",
    severity: "low",
    confidence: "heuristic",
    layer: "browser",
    rationale: "Making 'reject' harder than 'accept' is a dark pattern regulators increasingly act on.",
    remediation: "Add a 'Reject all' button with equal prominence to 'Accept all'.",
    caveat: CAVEAT,
    applicability: "Pages with a detected consent banner",
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
  const b = ctx.browser;
  const c = b.consent;
  const before = b.requests.filter((r) => r.beforeConsent && !isConsentModeDeniedPing(r.url));
  const tracking = observeTrackers(before).filter(
    (o) => o.tracker.category !== "tag_manager" && (o.hits.length || o.libraryLoads.length),
  );
  const firing = tracking.filter((o) => o.hits.length > 0);
  const vendors = (os: typeof tracking) => os.map((o) => o.tracker.vendor).join(", ");
  const net = repro.devtoolsNetwork(url, "collect|tr|pixel");

  if (!c.bannerDetected) {
    return [
      na("M08-TRACKING-BEFORE-CONSENT", url, "No consent banner detected"),
      tracking.length
        ? check(true, "M08-NO-CONSENT-BANNER", url, {
            observed: { vendors: vendors(tracking) },
            reproSteps: net,
          })
        : na("M08-NO-CONSENT-BANNER", url, "No trackers observed"),
      na("M08-COOKIES-BEFORE-CONSENT", url, "No consent banner detected"),
      na("M08-PRECHECKED-OPTIONS", url, "No consent banner detected"),
      na("M08-NO-REJECT-OPTION", url, "No consent banner detected"),
    ];
  }

  const cookies = c.cookiesBeforeConsent.filter((k) => isTrackingCookie(k.name));
  return [
    check(firing.length > 0, "M08-TRACKING-BEFORE-CONSENT", url, {
      requestUrl: firing[0]?.hits[0]?.url,
      selector: c.bannerSelector,
      observed: { vendors: vendors(firing), cmp: c.cmp, consentState: "no interaction (pre-consent)" },
      reproSteps: [...net, "Requests appear before clicking any banner button"],
    }),
    na("M08-NO-CONSENT-BANNER", url, `Banner detected (${c.cmp ?? "generic"})`),
    check(cookies.length > 0, "M08-COOKIES-BEFORE-CONSENT", url, {
      observed: { cookies: cookies.map((k) => k.name).join(", ") },
      reproSteps: [
        `Open ${url} in a private window`,
        "DevTools → Application → Cookies, before interacting with the banner",
      ],
    }),
    check(c.preCheckedOptions.length > 0, "M08-PRECHECKED-OPTIONS", url, {
      selector: c.bannerSelector,
      observed: { options: c.preCheckedOptions.join(", ") },
      reproSteps: repro.inspect(url, `${c.bannerSelector ?? "[role=dialog]"} input[type=checkbox]`),
    }),
    check(!!c.acceptSelector && !c.rejectSelector, "M08-NO-REJECT-OPTION", url, {
      selector: c.bannerSelector,
      observed: { accept: c.acceptSelector },
      reproSteps: [`Open ${url} in a private window`, "Inspect the first layer of the consent banner"],
    }),
  ];
}

export const m08Consent: AuditModule = {
  id: "M08",
  name: "Privacy / consent",
  version: "1.0.0",
  rules: R,
  runPage,
  explain: explainFrom(R),
};
