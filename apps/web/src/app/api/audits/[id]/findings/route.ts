import type { FindingStatus, ModuleId, Severity } from "@webaudit/core";
import { listFindings } from "@webaudit/db";
import { json, services } from "@/lib/server";

export const dynamic = "force-dynamic";

/** GET /api/audits/:id/findings?status=fail&severity=high&module=M01&rule=&url=&group= */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const list = <T extends string>(k: string) => sp.get(k)?.split(",").filter(Boolean) as T[] | undefined;
  return json({
    findings: listFindings(services().db, id, {
      status: list<FindingStatus>("status") ?? ["fail"],
      severity: list<Severity>("severity"),
      module: list<ModuleId>("module"),
      ruleId: sp.get("rule") ?? undefined,
      url: sp.get("url") ?? undefined,
      groupSignature: sp.get("group") ?? undefined,
      limit: Math.min(Number(sp.get("limit") ?? 1000), 50_000),
      offset: Number(sp.get("offset") ?? 0),
    }),
  });
}
