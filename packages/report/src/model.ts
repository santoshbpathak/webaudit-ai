import type { Finding, LighthouseSummary, ModuleId } from "@webaudit/core";
import {
  computeCoverage,
  getAudit,
  listEvents,
  listFindings,
  listGroups,
  listSnapshots,
  listUrls,
  type AuditRow,
  type CoverageSummary,
  type Db,
  type EventRow,
  type GroupRow,
} from "@webaudit/db";
import { ALL_MODULES, observeTrackers } from "@webaudit/modules";
import { ruleCoverageFrom, type RuleCoverage } from "@webaudit/scoring";

export interface PageSummary {
  url: string;
  status: number | null;
  state: string;
  reason: string | null;
  title?: string;
  sampled: boolean;
  inSitemap: boolean;
  depth: number;
  source: string;
  templateCluster: string | null;
  failures: number;
  screenshotRef?: string;
  lighthouseScore?: number | null;
  trackers: string[];
}

export interface ModuleSummary {
  id: ModuleId;
  name: string;
  rulesEvaluated: number;
  pagesTested: number;
  failures: number;
  groups: number;
  inconclusive: number;
  notTested: number;
  /** Rule evaluations with a verdict (pass + fail) — the denominator for "checks passed". */
  checksEvaluated: number;
  checksPassed: number;
}

export interface TagInventoryEntry {
  vendor: string;
  category: string;
  pages: number;
  sampledPages: number;
}

export interface ReportData {
  generatedAt: string;
  audit: AuditRow;
  coverage: CoverageSummary;
  ruleCoverage: RuleCoverage[];
  groups: GroupRow[];
  failures: Finding[];
  /** Counts of non-pass/fail outcomes, so readers see what was NOT verified. */
  outcomeCounts: Record<Finding["status"], number>;
  pages: PageSummary[];
  modules: ModuleSummary[];
  tagInventory: TagInventoryEntry[];
  lighthouse: { pages: number; medianScore: number | null; failures: number };
  warnings: EventRow[];
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function loadReportData(db: Db, auditId: string): ReportData {
  const audit = getAudit(db, auditId);
  if (!audit) throw new Error(`Audit ${auditId} not found`);
  const all = listFindings(db, auditId);
  const failures = all.filter((f) => f.status === "fail");
  const outcomeCounts = {
    fail: 0,
    pass: 0,
    not_applicable: 0,
    not_tested: 0,
    inconclusive: 0,
  } as ReportData["outcomeCounts"];
  for (const f of all) outcomeCounts[f.status]++;

  const snapshots = new Map(listSnapshots(db, auditId).map((s) => [s.url, s]));
  const failCount = new Map<string, number>();
  for (const f of failures) failCount.set(f.url, (failCount.get(f.url) ?? 0) + 1);

  const tagPages = new Map<string, { category: string; pages: Set<string> }>();
  const lhScores: number[] = [];
  let lhFailures = 0;
  const pages: PageSummary[] = listUrls(db, auditId).map((u) => {
    const snap = snapshots.get(u.url);
    const b = snap?.browser;
    const trackers = b ? observeTrackers(b.requests).map((o) => o.tracker.vendor) : [];
    if (b) {
      for (const o of observeTrackers(b.requests)) {
        const e = tagPages.get(o.tracker.vendor) ?? {
          category: o.tracker.category,
          pages: new Set<string>(),
        };
        e.pages.add(u.url);
        tagPages.set(o.tracker.vendor, e);
      }
    }
    const lh = b?.lighthouse;
    let lighthouseScore: number | null | undefined;
    if (lh && "error" in lh) lhFailures++;
    else if (lh) {
      lighthouseScore = (lh as LighthouseSummary).performanceScore;
      if (lighthouseScore !== null) lhScores.push(Math.round(lighthouseScore * 100));
    }
    return {
      url: u.url,
      status: u.httpStatus,
      state: u.state,
      reason: u.reason,
      title: snap?.features?.title,
      sampled: u.sampled,
      inSitemap: u.inSitemap,
      depth: u.depth,
      source: u.source,
      templateCluster: u.templateCluster,
      failures: failCount.get(u.url) ?? 0,
      screenshotRef: b?.screenshotRef,
      lighthouseScore,
      trackers,
    };
  });

  const ruleCoverage = ruleCoverageFrom(all);
  const groups = listGroups(db, auditId);
  const modules: ModuleSummary[] = ALL_MODULES.filter((m) => audit.config.modules.includes(m.id)).map((m) => {
    const mf = all.filter((f) => f.module === m.id);
    return {
      id: m.id,
      name: m.name,
      rulesEvaluated: new Set(
        mf.filter((f) => f.status === "pass" || f.status === "fail").map((f) => f.ruleId),
      ).size,
      pagesTested: new Set(mf.filter((f) => f.status === "pass" || f.status === "fail").map((f) => f.url))
        .size,
      failures: mf.filter((f) => f.status === "fail").length,
      groups: groups.filter((g) => g.module === m.id).length,
      inconclusive: mf.filter((f) => f.status === "inconclusive").length,
      notTested: mf.filter((f) => f.status === "not_tested").length,
      checksEvaluated: mf.filter((f) => f.status === "pass" || f.status === "fail").length,
      checksPassed: mf.filter((f) => f.status === "pass").length,
    };
  });

  const sampledPages = new Set(pages.filter((p) => p.sampled).map((p) => p.url));
  const tagInventory = [...tagPages.entries()]
    .map(([vendor, e]) => ({
      vendor,
      category: e.category,
      pages: e.pages.size,
      sampledPages: sampledPages.size,
    }))
    .sort((a, b) => b.pages - a.pages || a.vendor.localeCompare(b.vendor));

  return {
    generatedAt: new Date().toISOString(),
    audit,
    coverage: audit.coverage ?? computeCoverage(db, auditId),
    ruleCoverage,
    groups,
    failures,
    outcomeCounts,
    pages,
    modules,
    tagInventory,
    lighthouse: { pages: lhScores.length, medianScore: median(lhScores), failures: lhFailures },
    warnings: listEvents(db, auditId, 0, 5_000)
      .filter((e) => e.level === "warn" || e.level === "error")
      .slice(0, 200),
  };
}
