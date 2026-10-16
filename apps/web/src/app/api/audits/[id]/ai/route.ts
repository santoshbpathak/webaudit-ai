import { listAnalyses } from "@webaudit/ai";
import { json, services } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return json({ analyses: listAnalyses(services().db, id).map(({ payload: _p, ...a }) => a) });
}
