import { computeCoverage, deleteAudit, getAudit } from "@webaudit/db";
import { isDemo, json, problem, services } from "@/lib/server";

export const dynamic = "force-dynamic";

/** GET /api/audits/:id — status, config and coverage (ledger-derived). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = services();
  const audit = getAudit(db, id);
  if (!audit) return problem(404, "Audit not found");
  return json({ audit, coverage: computeCoverage(db, id) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isDemo()) return problem(403, "Read-only demo");
  const { id } = await params;
  const { db, artifacts } = services();
  if (!getAudit(db, id)) return problem(404, "Audit not found");
  deleteAudit(db, id);
  // Screenshots and reports hold page content; deleting an audit removes them too.
  await artifacts.removeAudit(id);
  return json({ deleted: id });
}
