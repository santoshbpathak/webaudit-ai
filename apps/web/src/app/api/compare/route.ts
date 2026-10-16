import { getAudit } from "@webaudit/db";
import { diffAudits, loadReportData } from "@webaudit/report";
import { json, problem, services } from "@/lib/server";

export const dynamic = "force-dynamic";

/** GET /api/compare?base=<id>&head=<id> — scope-aware diff (RP-04, T16). */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const base = sp.get("base");
  const head = sp.get("head");
  const { db } = services();
  if (!base || !head || !getAudit(db, base) || !getAudit(db, head))
    return problem(400, "base and head must be existing audit ids");
  return json(diffAudits(loadReportData(db, base), loadReportData(db, head)));
}
