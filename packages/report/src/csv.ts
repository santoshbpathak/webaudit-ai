import type { Finding } from "@webaudit/core";
import { getRule } from "@webaudit/modules";

const COLUMNS = [
  "finding_id",
  "rule_id",
  "rule_title",
  "module",
  "status",
  "severity",
  "confidence",
  "url",
  "selector",
  "http_status",
  "snippet",
  "recommended_action",
  "reason",
  "observed_at",
  "engine_version",
] as const;

/** RFC 4180 field; also neutralises spreadsheet formula injection (=, +, -, @). */
export function csvField(v: unknown): string {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function findingsToCsv(findings: Finding[]): string {
  const rows = [COLUMNS.join(",")];
  for (const f of findings) {
    rows.push(
      [
        f.findingId,
        f.ruleId,
        getRule(f.ruleId)?.title ?? "",
        f.module,
        f.status,
        f.severity,
        f.confidence,
        f.url,
        f.evidence.selector,
        f.evidence.httpStatus,
        f.evidence.snippet?.replace(/\s+/g, " ").slice(0, 300),
        f.recommendedAction,
        f.reason,
        f.observedAt,
        f.engineVersion,
      ]
        .map(csvField)
        .join(","),
    );
  }
  return rows.join("\r\n") + "\r\n";
}
