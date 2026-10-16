import type { Confidence, Finding, ModuleId, Severity } from "@webaudit/core";
import { SEVERITY_ORDER, stableHash } from "@webaudit/core";
import { pathPattern } from "@webaudit/crawler";
import { getRule } from "@webaudit/modules";

/** Documented in docs/scoring.md. Product-defined weights, not an industry standard. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  high: 6,
  medium: 3,
  low: 1,
  info: 0.25,
};
export const CONFIDENCE_FACTOR: Record<Confidence, number> = {
  verified: 1,
  heuristic: 0.7,
  manual_review: 0.4,
};
export const PRIORITY_PATH_FACTOR = 1.5;
export const START_URL_FACTOR = 1.25;
/** log2 page factor is capped so one huge template cannot dominate everything. */
export const PAGE_FACTOR_CAP = 8;
export const MIN_TESTED_FOR_EVIDENCE = 3;

/** Drop page-specific "{placeholder}" clauses from a remediation template for group-level text. */
export function genericAction(template: string): string {
  const PH = /\{\w+\}/;
  const noParens = template.replace(/\s*\([^()]*\{\w+\}[^()]*\)/g, "");
  // Split on sentence ends, not abbreviations like "e.g." (3 dot-free chars before the period).
  const sentences = noParens.split(/(?<=[^.\s]{3}\.)\s+(?=[A-Z])/);
  const kept = sentences.flatMap((sentence) => {
    const idx = sentence.search(PH);
    if (idx < 0) return [sentence];
    const colon = sentence.lastIndexOf(":", idx);
    // "Do X: {list}." → "Do X."  ·  a sentence that only describes the instance is dropped.
    const prefix = colon > 0 ? sentence.slice(0, colon).trimEnd() : "";
    if (prefix.split(/\s+/).length < 4) return [];
    // "Increase size or spacing of: {targets}" → "…of the affected items."
    return [
      /\b(of|to|for|in|on|with|from|at)$/i.test(prefix) ? `${prefix} the affected items.` : prefix + ".",
    ];
  });
  return kept.join(" ").trim() || template.replace(/\{\w+\}/g, "…");
}

export interface IssueGroup {
  signature: string;
  ruleId: string;
  module: ModuleId;
  title: string;
  severity: Severity;
  confidence: Confidence;
  /** Inferred template: generalized path pattern (e.g. /blog/*). Labelled as inferred. */
  templateHint: string;
  affectedPages: number;
  /** Pages in this template where the rule was actually evaluated (pass + fail). */
  testedPages: number;
  priority: number;
  priorityComponents: {
    severityWeight: number;
    pageFactor: number;
    confidenceFactor: number;
    importanceFactor: number;
  };
  enoughEvidence: boolean;
  sampleUrls: string[];
  recommendedAction: string;
  findingIds: string[];
}

export interface GroupingInput {
  findings: Finding[];
  startUrl: string;
  priorityPaths?: string[];
}

/**
 * Stable group signature (AU-06): rule + generalized path pattern. Survives re-scans
 * (no volatile ids) so audits can be diffed group-by-group.
 */
export function groupSignature(ruleId: string, url: string): string {
  return stableHash(ruleId, pathPattern(url));
}

export function priorityIndex(
  severity: Severity,
  affected: number,
  confidence: Confidence,
  importance: number,
): IssueGroup["priorityComponents"] & { priority: number } {
  const severityWeight = SEVERITY_WEIGHT[severity];
  const pageFactor = Math.min(PAGE_FACTOR_CAP, 1 + Math.log2(Math.max(1, affected)));
  const confidenceFactor = CONFIDENCE_FACTOR[confidence];
  const priority = Math.round(severityWeight * pageFactor * confidenceFactor * importance * 100) / 100;
  return {
    severityWeight,
    pageFactor: Math.round(pageFactor * 100) / 100,
    confidenceFactor,
    importanceFactor: importance,
    priority,
  };
}

function matchesPriorityPath(url: string, paths: string[]): boolean {
  const p = new URL(url).pathname;
  return paths.some((x) =>
    x.endsWith("*") ? p.startsWith(x.slice(0, -1)) : p === x || p.startsWith(x.endsWith("/") ? x : x + "/"),
  );
}

/**
 * Consolidate URL-level failures into fixable issue groups with a transparent
 * priority index (PRD §5.4). Unobserved pages are never assumed to fail.
 */
export function groupFindings(input: GroupingInput): {
  groups: IssueGroup[];
  assignments: { findingId: string; signature: string }[];
} {
  const tested = new Map<string, number>(); // signature → pass+fail count
  const ruleTested = new Map<string, number>(); // ruleId → pass+fail count
  const fails = new Map<string, Finding[]>();
  const assignments: { findingId: string; signature: string }[] = [];

  for (const f of input.findings) {
    if (f.status !== "pass" && f.status !== "fail") continue;
    const sig = groupSignature(f.ruleId, f.url);
    tested.set(sig, (tested.get(sig) ?? 0) + 1);
    ruleTested.set(f.ruleId, (ruleTested.get(f.ruleId) ?? 0) + 1);
    if (f.status === "fail") {
      fails.set(sig, [...(fails.get(sig) ?? []), f]);
      assignments.push({ findingId: f.findingId, signature: sig });
    }
  }

  const groups: IssueGroup[] = [];
  for (const [sig, fs] of fails) {
    const first = fs[0]!;
    const rule = getRule(first.ruleId);
    // Group severity = worst instance severity (axe impacts / LH metrics vary per page).
    const severity = fs.map((f) => f.severity).sort((a, b) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b])[0]!;
    const urls = [...new Set(fs.map((f) => f.url))].sort();
    const importance = urls.some((u) => matchesPriorityPath(u, input.priorityPaths ?? []))
      ? PRIORITY_PATH_FACTOR
      : urls.includes(input.startUrl)
        ? START_URL_FACTOR
        : 1;
    const pi = priorityIndex(severity, urls.length, first.confidence, importance);
    const layer = rule?.layer ?? "http";
    const enoughEvidence =
      layer !== "browser" ||
      (ruleTested.get(first.ruleId) ?? 0) >= MIN_TESTED_FOR_EVIDENCE ||
      urls.length >= MIN_TESTED_FOR_EVIDENCE;
    groups.push({
      signature: sig,
      ruleId: first.ruleId,
      module: first.module,
      title: rule?.title ?? first.ruleId,
      severity,
      confidence: first.confidence,
      templateHint: pathPattern(first.url),
      affectedPages: urls.length,
      testedPages: tested.get(sig) ?? urls.length,
      priority: pi.priority,
      priorityComponents: {
        severityWeight: pi.severityWeight,
        pageFactor: pi.pageFactor,
        confidenceFactor: pi.confidenceFactor,
        importanceFactor: pi.importanceFactor,
      },
      enoughEvidence,
      sampleUrls: urls.slice(0, 10),
      recommendedAction: urls.length > 1 && rule ? genericAction(rule.remediation) : first.recommendedAction,
      findingIds: fs.map((f) => f.findingId),
    });
  }
  groups.sort(
    (a, b) =>
      b.priority - a.priority ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.templateHint.localeCompare(b.templateHint),
  );
  return { groups, assignments };
}

/** Per-rule coverage with exact denominators (T07). */
export interface RuleCoverage {
  ruleId: string;
  tested: number;
  failed: number;
  notTested: number;
  inconclusive: number;
  notApplicable: number;
}

export function ruleCoverageFrom(findings: Finding[]): RuleCoverage[] {
  const m = new Map<string, RuleCoverage>();
  for (const f of findings) {
    const c = m.get(f.ruleId) ?? {
      ruleId: f.ruleId,
      tested: 0,
      failed: 0,
      notTested: 0,
      inconclusive: 0,
      notApplicable: 0,
    };
    if (f.status === "pass" || f.status === "fail") c.tested++;
    if (f.status === "fail") c.failed++;
    if (f.status === "not_tested") c.notTested++;
    if (f.status === "inconclusive") c.inconclusive++;
    if (f.status === "not_applicable") c.notApplicable++;
    m.set(f.ruleId, c);
  }
  return [...m.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

export type EffortLevel = "small" | "medium" | "large";

/** What kind of change a rule's fix usually needs; drives the effort heuristic. */
const FIX_KIND: {
  match: RegExp;
  kind: "content" | "markup" | "config" | "engineering" | "design" | "legal";
}[] = [
  { match: /^M01-(TITLE|META-DESC)|^M09-(THIN|EXACT|NEAR)/, kind: "content" },
  { match: /^M04-|^M05-/, kind: "config" },
  { match: /^M08-/, kind: "legal" },
  { match: /^M02-/, kind: "engineering" },
  { match: /^M07-|^M10-/, kind: "design" },
];

/**
 * Heuristic effort estimate for a fix. It is labelled "estimated" in the UI and is a
 * planning aid, not a measurement: template-level fixes are one change for many pages,
 * content fixes scale with page count, performance and IA work are inherently larger.
 */
export function estimateEffort(
  ruleId: string,
  affectedPages: number,
  templates = 1,
): { level: EffortLevel; basis: string } {
  const kind = FIX_KIND.find((k) => k.match.test(ruleId))?.kind ?? "markup";
  switch (kind) {
    case "content":
      return affectedPages <= 3
        ? { level: "small", basis: "Copy edits on a few pages" }
        : affectedPages <= 25
          ? { level: "medium", basis: `Copy edits on ${affectedPages} pages, or one template default` }
          : {
              level: "large",
              basis: `Copy edits on ${affectedPages} pages — consider a template-driven default`,
            };
    case "config":
      return { level: templates > 3 ? "medium" : "small", basis: "Tag manager / tag configuration change" };
    case "legal":
      return { level: "medium", basis: "Consent configuration plus privacy review" };
    case "engineering":
      return { level: "large", basis: "Performance engineering (assets, scripts, rendering)" };
    case "design":
      return { level: templates > 2 ? "large" : "medium", basis: "Layout / information-architecture change" };
    default:
      return templates <= 1
        ? {
            level: "small",
            basis: affectedPages > 1 ? "One template or component fix" : "Single-page markup fix",
          }
        : { level: templates > 5 ? "large" : "medium", basis: `Markup fixes across ${templates} templates` };
  }
}
