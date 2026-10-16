// Client-safe issue types and constants (no server/engine imports — safe for "use client").
export type EffortLevel = "small" | "medium" | "large";

export interface IssueTemplate {
  signature: string;
  templateHint: string;
  affectedPages: number;
  testedPages: number;
  priority: number;
  severity: string;
  sampleUrls: string[];
}

/** One row per rule ("issue type"), rolled up from template-level groups. */
export interface IssueType {
  ruleId: string;
  module: string;
  title: string;
  severity: string;
  confidence: string;
  affectedPages: number;
  testedPages: number;
  /** Sum of group priorities — widespread patterns rank above isolated ones. */
  priority: number;
  enoughEvidence: boolean;
  recommendedAction: string;
  templates: IssueTemplate[];
  effort: { level: EffortLevel; basis: string };
}

export const EFFORT_LABEL: Record<EffortLevel, string> = { small: "S", medium: "M", large: "L" };
