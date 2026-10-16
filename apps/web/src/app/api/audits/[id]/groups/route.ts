import { listGroups } from "@webaudit/db";
import { json, services } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return json({ groups: listGroups(services().db, id) });
}
