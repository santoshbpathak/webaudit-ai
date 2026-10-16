import { z } from "zod";

/** PRD §5.2 — the twelve audit modules. */
export const ModuleId = z.enum([
  "M01", // Technical SEO
  "M02", // Performance
  "M03", // Accessibility
  "M04", // GA4 / GTM
  "M05", // Ad tracking
  "M06", // Lead forms
  "M07", // CRO / UX
  "M08", // Privacy / consent
  "M09", // Content
  "M10", // Architecture
  "M11", // Scoring / prioritization
  "M12", // Reporting
]);
export type ModuleId = z.infer<typeof ModuleId>;

/**
 * A rule outcome on one URL. `fail` is the only status that represents an issue;
 * everything else exists so coverage can be reported honestly (PRD §5.2).
 */
export const FindingStatus = z.enum(["fail", "pass", "not_applicable", "not_tested", "inconclusive"]);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

/** AU-04: verified observation vs heuristic/potential issue vs manual review required. */
export const Confidence = z.enum(["verified", "heuristic", "manual_review"]);
export type Confidence = z.infer<typeof Confidence>;

/** AU-02 evidence payload. Every field optional; repro steps always present. */
export const Evidence = z.object({
  selector: z.string().optional(),
  snippet: z.string().max(2_000).optional(),
  httpStatus: z.number().int().optional(),
  requestUrl: z.string().optional(),
  screenshotRef: z.string().optional(),
  traceRef: z.string().optional(),
  observed: z.record(z.string(), z.unknown()).optional(),
  reproSteps: z.array(z.string()).default([]),
});
export type Evidence = z.infer<typeof Evidence>;

/** AU-01: the stored finding record. */
export const Finding = z.object({
  findingId: z.string(),
  ruleId: z.string(),
  auditId: z.string(),
  url: z.string(),
  module: ModuleId,
  status: FindingStatus,
  severity: Severity,
  confidence: Confidence,
  observedAt: z.string(),
  engineVersion: z.string(),
  evidence: Evidence,
  recommendedAction: z.string(),
  applicability: z.string(),
  /** Free-text reason for not_tested / inconclusive / not_applicable. */
  reason: z.string().optional(),
});
export type Finding = z.infer<typeof Finding>;

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function severityAtLeast(s: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[s] <= SEVERITY_ORDER[threshold];
}
