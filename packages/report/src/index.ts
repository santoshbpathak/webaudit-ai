export * from "./model";
export * from "./summary";
export * from "./csv";
export * from "./markdown";
export * from "./html";
export * from "./diff";

import { buildBacklog, buildExecutiveSummary } from "./summary";
import type { ReportData } from "./model";

/** Machine-readable export (RP-03). Stable top-level keys; versioned. */
export function renderJson(d: ReportData): string {
  return JSON.stringify(
    {
      format: "webaudit-report",
      formatVersion: 1,
      generatedAt: d.generatedAt,
      audit: {
        id: d.audit.id,
        url: d.audit.url,
        host: d.audit.host,
        mode: d.audit.mode,
        status: d.audit.status,
        createdAt: d.audit.createdAt,
        startedAt: d.audit.startedAt,
        finishedAt: d.audit.finishedAt,
        config: d.audit.config,
        engineVersions: d.audit.engineVersions,
        samplingPolicy: d.audit.samplingPolicy,
      },
      coverage: d.coverage,
      outcomeCounts: d.outcomeCounts,
      summary: buildExecutiveSummary(d),
      backlog: buildBacklog(d),
      ruleCoverage: d.ruleCoverage,
      modules: d.modules,
      tagInventory: d.tagInventory,
      lighthouse: d.lighthouse,
      findings: d.failures,
      pages: d.pages,
    },
    null,
    2,
  );
}
export * from "./budgets";
