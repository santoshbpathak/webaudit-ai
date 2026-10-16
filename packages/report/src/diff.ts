import { SEVERITY_ORDER, type Severity } from "@webaudit/core";
import { getRule } from "@webaudit/modules";
import type { ReportData } from "./model";

export interface DiffEntry {
  signature: string;
  ruleId: string;
  title: string;
  templateHint: string;
  severity: string;
  before: number;
  after: number;
}

export interface AuditDiff {
  baseId: string;
  headId: string;
  comparable: boolean;
  scopeNotes: string[];
  newIssues: DiffEntry[];
  resolved: DiffEntry[];
  /** Group absent in head, but its rule was not re-tested on those pages — not a fix. */
  notRetested: DiffEntry[];
  persisting: DiffEntry[];
}

/**
 * Compare two audits group-by-group using stable signatures (RP-04, T16). Differences
 * in scope are surfaced instead of being reported as regressions or fixes.
 */
export function diffAudits(base: ReportData, head: ReportData): AuditDiff {
  const notes: string[] = [];
  const bc = base.audit.config;
  const hc = head.audit.config;
  if (base.audit.host !== head.audit.host)
    notes.push(`Different hosts: ${base.audit.host} vs ${head.audit.host}.`);
  if (bc.mode !== hc.mode) notes.push(`Different modes: ${bc.mode} vs ${hc.mode}.`);
  if (bc.maxUrls !== hc.maxUrls) notes.push(`Different URL caps: ${bc.maxUrls} vs ${hc.maxUrls}.`);
  const modsB = [...bc.modules].sort().join(",");
  const modsH = [...hc.modules].sort().join(",");
  if (modsB !== modsH) notes.push(`Different module selection: ${modsB} vs ${modsH}.`);
  if (bc.device !== hc.device) notes.push(`Different device: ${bc.device} vs ${hc.device}.`);
  const ratio = (a: number, b: number) => (Math.max(a, b) === 0 ? 1 : Math.min(a, b) / Math.max(a, b));
  if (ratio(base.coverage.checked, head.coverage.checked) < 0.8) {
    notes.push(
      `Checked URL counts differ substantially (${base.coverage.checked} vs ${head.coverage.checked}); some differences reflect coverage, not site changes.`,
    );
  }
  if (ratio(base.coverage.sampled, head.coverage.sampled) < 0.8) {
    notes.push(`Browser sample sizes differ (${base.coverage.sampled} vs ${head.coverage.sampled}).`);
  }

  const hb = new Map(base.groups.map((g) => [g.signature, g]));
  const hh = new Map(head.groups.map((g) => [g.signature, g]));
  // Which (rule, url) pairs were actually tested in head?
  const headTested = new Set<string>();
  for (const rc of head.ruleCoverage) if (rc.tested > 0) headTested.add(rc.ruleId);
  const headPages = new Set(head.pages.filter((p) => p.state === "checked").map((p) => p.url));
  const headSampled = new Set(head.pages.filter((p) => p.sampled).map((p) => p.url));

  const entry = (g: (typeof base.groups)[number], before: number, after: number): DiffEntry => ({
    signature: g.signature,
    ruleId: g.ruleId,
    title: g.title,
    templateHint: g.templateHint ?? "",
    severity: g.severity,
    before,
    after,
  });

  const newIssues: DiffEntry[] = [];
  const persisting: DiffEntry[] = [];
  const resolved: DiffEntry[] = [];
  const notRetested: DiffEntry[] = [];
  for (const [sig, g] of hh) {
    const b = hb.get(sig);
    if (b) persisting.push(entry(g, b.affectedPages, g.affectedPages));
    else newIssues.push(entry(g, 0, g.affectedPages));
  }
  for (const [sig, g] of hb) {
    if (hh.has(sig)) continue;
    const browserRule = getRule(g.ruleId)?.layer === "browser";
    const pool = browserRule ? headSampled : headPages;
    const retested = headTested.has(g.ruleId) && g.sampleUrls.some((u) => pool.has(u));
    (retested ? resolved : notRetested).push(entry(g, g.affectedPages, 0));
  }
  const bySev = (a: DiffEntry, b: DiffEntry) =>
    SEVERITY_ORDER[a.severity as Severity] - SEVERITY_ORDER[b.severity as Severity] ||
    b.after + b.before - (a.after + a.before) ||
    a.ruleId.localeCompare(b.ruleId);
  return {
    baseId: base.audit.id,
    headId: head.audit.id,
    comparable: notes.length === 0,
    scopeNotes: notes,
    newIssues: newIssues.sort(bySev),
    resolved: resolved.sort(bySev),
    notRetested: notRetested.sort(bySev),
    persisting: persisting.sort(bySev),
  };
}
