import { getAudit, requestCancel } from "@webaudit/db";
import { isDemo, json, problem, services } from "@/lib/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isDemo()) return problem(403, "Read-only demo");
  const { id } = await params;
  const { db } = services();
  if (!getAudit(db, id)) return problem(404, "Audit not found");
  const ok = requestCancel(db, id);
  return ok
    ? json({ cancelling: true, audit: getAudit(db, id) })
    : problem(409, "Audit is not running or queued");
}
