import "server-only";
import { cache } from "react";
import { getAudit } from "@webaudit/db";
import { loadReportData } from "@webaudit/report";
import { services } from "./server";

/** Finished = analysis done and report data is meaningful (completed, partial or cancelled). */
export function isFinished(a: { phase: string | null; status: string }) {
  return a.phase === "done" && a.status !== "failed";
}

/** One audit row per request, shared by layout and page. */
export const getAuditRow = cache((id: string) => getAudit(services().db, id));

/** Full report model, computed once per request. */
export const getReport = cache((id: string) => loadReportData(services().db, id));
