import type { GroupRow } from "@webaudit/db";
import { estimateEffort } from "@webaudit/scoring";
import type { IssueTemplate, IssueType } from "./issues-shared";

export * from "./issues-shared";

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function issueTypes(groups: GroupRow[]): IssueType[] {
  const m = new Map<string, IssueType>();
  for (const g of groups) {
    const t: IssueTemplate = {
      signature: g.signature,
      templateHint: g.templateHint ?? "",
      affectedPages: g.affectedPages,
      testedPages: g.testedPages,
      priority: g.priority,
      severity: g.severity,
      sampleUrls: g.sampleUrls,
    };
    const cur = m.get(g.ruleId);
    if (!cur) {
      m.set(g.ruleId, {
        ruleId: g.ruleId,
        module: g.module,
        title: g.title,
        severity: g.severity,
        confidence: g.confidence,
        affectedPages: g.affectedPages,
        testedPages: g.testedPages,
        priority: g.priority,
        enoughEvidence: g.enoughEvidence,
        recommendedAction: g.recommendedAction,
        templates: [t],
        effort: { level: "small", basis: "" },
      });
      continue;
    }
    cur.templates.push(t);
    cur.affectedPages += g.affectedPages;
    cur.testedPages += g.testedPages;
    cur.priority = Math.round((cur.priority + g.priority) * 100) / 100;
    cur.enoughEvidence ||= g.enoughEvidence;
    if (SEV_RANK[g.severity]! < SEV_RANK[cur.severity]!) cur.severity = g.severity;
  }
  const out = [...m.values()];
  for (const it of out) {
    it.templates.sort((a, b) => b.priority - a.priority);
    it.effort = estimateEffort(it.ruleId, it.affectedPages, it.templates.length);
  }
  return out.sort(
    (a, b) =>
      b.priority - a.priority ||
      SEV_RANK[a.severity]! - SEV_RANK[b.severity]! ||
      a.ruleId.localeCompare(b.ruleId),
  );
}

export function severityCounts<T extends { severity: string }>(xs: T[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const x of xs) c[x.severity] = (c[x.severity] ?? 0) + 1;
  return c;
}
