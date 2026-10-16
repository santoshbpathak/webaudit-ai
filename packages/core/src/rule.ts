import type { Confidence, Evidence, FindingStatus, ModuleId, Severity } from "./finding";
import type { PageContext } from "./page";

/** Which layer of data a rule needs. Determines denominators (T07). */
export type RuleLayer = "http" | "browser" | "site";

/** AU-03 versioned rule metadata. Also the source for docs/rules.md. */
export interface RuleDefinition {
  id: string;
  module: ModuleId;
  title: string;
  severity: Severity;
  confidence: Confidence;
  layer: RuleLayer;
  /** Why this matters, in marketing terms. */
  rationale: string;
  /** Default fix. May include {placeholders} filled from evidence.observed. */
  remediation: string;
  /** What this rule cannot tell you (PRD caveats column). */
  caveat?: string;
  /** Which pages the rule applies to, human-readable. */
  applicability: string;
}

/**
 * What a module returns for one rule on one URL. The engine turns this into a stored
 * Finding by adding ids, audit id, timestamps and engine version.
 */
export interface RuleResult {
  ruleId: string;
  url: string;
  status: FindingStatus;
  evidence?: Partial<Evidence>;
  /** Override the rule's default severity for this instance (e.g. axe impact). */
  severity?: Severity;
  reason?: string;
  /** Optional instance-specific remediation; defaults to rule.remediation. */
  recommendedAction?: string;
}

export interface SiteContext {
  auditId: string;
  startUrl: string;
  pages: PageContext[];
  /** URLs listed in sitemaps (normalized). */
  sitemapUrls: Set<string>;
  /** Internal link edges: from → to (normalized). */
  links: { from: string; to: string }[];
  /** Outcome of every attempted URL, including failures. */
  statusByUrl: Map<string, number | "failed" | "blocked" | "skipped">;
}

export interface AuditModule {
  id: ModuleId;
  name: string;
  version: string;
  rules: RuleDefinition[];
  /** Per-page checks. Must not throw for expected data shapes; the engine catches the rest. */
  runPage?(ctx: PageContext): RuleResult[] | Promise<RuleResult[]>;
  /** Cross-page checks (duplicates, link graph, sitemap comparison). */
  runSite?(ctx: SiteContext): RuleResult[] | Promise<RuleResult[]>;
  /** Plain-language description of a rule. */
  explain(ruleId: string): string;
}

/** Helper so modules share the same explain() behavior. */
export function explainFrom(rules: RuleDefinition[]) {
  return (ruleId: string): string => {
    const r = rules.find((x) => x.id === ruleId);
    if (!r) return `Unknown rule ${ruleId}`;
    return [r.title, r.rationale, r.caveat ? `Caveat: ${r.caveat}` : ""].filter(Boolean).join("\n\n");
  };
}

/** Fill {placeholders} in a remediation template from evidence.observed. */
export function renderTemplate(template: string, values: Record<string, unknown> | undefined): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    values[key] === undefined ? m : String(values[key]),
  );
}
