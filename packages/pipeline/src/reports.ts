import { addArtifact, listFindings, type Db } from "@webaudit/db";
import { findingsToCsv, loadReportData, renderHtml, renderJson, renderMarkdown } from "@webaudit/report";
import { newId } from "@webaudit/core";
import type { ArtifactStore } from "./artifacts";

/** Generate HTML / JSON / CSV / Markdown exports and register them as artifacts. */
export async function writeReports(
  db: Db,
  artifacts: ArtifactStore,
  auditId: string,
): Promise<Record<string, string>> {
  const data = loadReportData(db, auditId);
  const outputs: [string, string, string, "html" | "json" | "csv" | "md"][] = [
    ["report.html", renderHtml(data), "text/html", "html"],
    ["report.json", renderJson(data), "application/json", "json"],
    ["findings.csv", findingsToCsv(data.failures), "text/csv", "csv"],
    ["findings-all.csv", findingsToCsv(listFindings(db, auditId)), "text/csv", "csv"],
    ["summary.md", renderMarkdown(data), "text/markdown", "md"],
  ];
  const paths: Record<string, string> = {};
  for (const [name, body, contentType, format] of outputs) {
    const put = await artifacts.put(auditId, name, body);
    const art = addArtifact(db, {
      auditId,
      url: null,
      kind: "report",
      path: put.path,
      contentType,
      bytes: put.bytes,
    });
    db.$client
      .prepare(`INSERT INTO exports (id, audit_id, format, artifact_id, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(newId("exp"), auditId, format, art.id, new Date().toISOString());
    paths[name] = put.path;
  }
  return paths;
}
