import type { Severity } from "@webaudit/core";
import { getRule } from "@webaudit/modules";
import type { ReportData } from "./model";

/**
 * Deterministic executive summary and developer backlog (RP-05). Template-driven so
 * the AI-off report is complete; every statement cites group signatures or rule ids.
 */

export interface SummaryBullet {
  text: string;
  /** Group signatures / rule ids that support this statement. */
  refs: string[];
}

export interface ExecutiveSummary {
  headline: string;
  scope: string;
  coverageNote: string;
  topIssues: SummaryBullet[];
  martech: SummaryBullet[];
  limitations: string[];
}

/** Brand terminology for confidence tiers (branding guidelines §7). */
export const CONFIDENCE_TERM: Record<string, string> = {
  verified: "confirmed",
  heuristic: "potential",
  manual_review: "manual review",
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function isPartial(d: ReportData): boolean {
  return (
    d.audit.status === "completed_partial" ||
    d.audit.status === "cancelled_partial" ||
    d.audit.status === "cancelling"
  );
}

export function buildExecutiveSummary(d: ReportData): ExecutiveSummary {
  const c = d.coverage;
  const bySev = (s: Severity[]) => d.groups.filter((g) => s.includes(g.severity));
  const urgent = bySev(["critical", "high"]);
  const host = d.audit.host;

  const headline = d.groups.length
    ? `${plural(d.groups.length, "issue group")} found on ${host} across ${plural(new Set(d.failures.map((f) => f.url)).size, "page")}; ${urgent.length} rated high or critical.`
    : c.checked === 0
      ? `No checks could be evaluated on ${host}; this is not evidence that the site is free of issues.`
      : `No failing checks were found on ${host} within the tested scope.`;

  const scope = `${d.audit.mode[0]!.toUpperCase()}${d.audit.mode.slice(1)} audit of ${d.audit.url} — ${c.checked} URLs checked out of ${c.discovered} discovered (${c.blockedRobots} blocked by robots.txt, ${c.skipped} skipped, ${c.failed} failed to fetch). Browser checks ran on ${c.sampled} sampled page(s).`;

  const coverageNote =
    c.sampled < c.checked
      ? `Browser-based findings (performance, accessibility, analytics, pixels, forms, UX, consent) reflect ${c.sampled} sampled page(s), not all ${c.checked}. Each finding shows its exact tested denominator.`
      : `All checked HTML pages received browser checks.`;

  const topIssues: SummaryBullet[] = d.groups.slice(0, 5).map((g) => ({
    text: `${g.title} — ${plural(g.affectedPages, "page")} (${g.templateHint}, inferred template), ${g.severity} severity, ${CONFIDENCE_TERM[g.confidence] ?? g.confidence}.`,
    refs: [g.signature, g.ruleId],
  }));

  const martech: SummaryBullet[] = [];
  const has = (rule: string) => d.groups.filter((g) => g.ruleId === rule);
  const ga4Missing = has("M04-GA4-NOT-OBSERVED");
  if (ga4Missing.length) {
    const n = ga4Missing.reduce((a, g) => a + g.affectedPages, 0);
    martech.push({
      text: `GA4 was not observed on ${plural(n, "tested page")} — visits there may be missing from analytics (not observed in the tested flow).`,
      refs: ga4Missing.map((g) => g.signature),
    });
  }
  for (const rule of ["M04-GA4-DUPLICATE-PAGEVIEW", "M05-PIXEL-DUPLICATE"]) {
    const gs = has(rule);
    if (gs.length)
      martech.push({
        text: `${getRule(rule)?.title}: ${plural(
          gs.reduce((a, g) => a + g.affectedPages, 0),
          "page",
        )} — reported numbers may be inflated.`,
        refs: gs.map((g) => g.signature),
      });
  }
  const consent = has("M08-TRACKING-BEFORE-CONSENT");
  if (consent.length)
    martech.push({
      text: `Trackers fired before any consent choice on ${plural(
        consent.reduce((a, g) => a + g.affectedPages, 0),
        "page",
      )} (indicator, not a legal determination).`,
      refs: consent.map((g) => g.signature),
    });
  if (d.tagInventory.length) {
    martech.push({
      text: `Tags observed on sampled pages: ${d.tagInventory.map((t) => `${t.vendor} (${t.pages}/${t.sampledPages})`).join(", ")}.`,
      refs: [],
    });
  }
  const forms = d.groups.filter((g) => g.module === "M06");
  if (forms.length)
    martech.push({
      text: `${plural(forms.length, "lead-form issue group")} may add friction to conversions — treat as hypotheses to test.`,
      refs: forms.map((g) => g.signature),
    });

  const limitations = [
    "Automated checks cannot establish legal compliance (privacy, consent, accessibility) or guarantee ranking, traffic or conversion outcomes.",
    "Performance numbers are Lighthouse lab measurements, not real-user field data.",
    "Tags gated behind consent, logins, ad blockers or later user actions may not be observed.",
  ];
  if (isPartial(d))
    limitations.unshift(
      `This audit is PARTIAL (${d.audit.status.replace("_", " ")}). Results cover only the URLs that were checked before it stopped.`,
    );
  if (c.blockedRobots)
    limitations.push(`${c.blockedRobots} URL(s) were excluded by robots.txt and not audited.`);

  return { headline, scope, coverageNote, topIssues, martech, limitations };
}

export interface BacklogItem {
  rank: number;
  signature: string;
  ruleId: string;
  module: string;
  title: string;
  severity: Severity;
  confidence: string;
  priority: number;
  affectedPages: number;
  testedPages: number;
  templateHint: string;
  fixScope: "single page" | "template" | "site-wide";
  action: string;
  sampleUrls: string[];
  enoughEvidence: boolean;
}

export function buildBacklog(d: ReportData): BacklogItem[] {
  return d.groups.map((g, i) => ({
    rank: i + 1,
    signature: g.signature,
    ruleId: g.ruleId,
    module: g.module,
    title: g.title,
    severity: g.severity,
    confidence: g.confidence,
    priority: g.priority,
    affectedPages: g.affectedPages,
    testedPages: g.testedPages,
    templateHint: g.templateHint ?? "",
    fixScope:
      g.affectedPages === 1
        ? "single page"
        : g.affectedPages >= d.coverage.checked * 0.5
          ? "site-wide"
          : "template",
    action: g.recommendedAction,
    sampleUrls: g.sampleUrls,
    enoughEvidence: g.enoughEvidence,
  }));
}
