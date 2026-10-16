import { listEvents } from "@webaudit/db";
import { json, services } from "@/lib/server";

export const dynamic = "force-dynamic";

/** GET /api/audits/:id/events?after=<id> — incremental live log. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  return json({ events: listEvents(services().db, id, after, 200) });
}
