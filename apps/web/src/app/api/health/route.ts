import { ENGINE_VERSION } from "@webaudit/core";
import { isDemo, services } from "@/lib/server";

export const dynamic = "force-dynamic";

export function GET() {
  const { queue } = services();
  return Response.json({ ok: true, version: ENGINE_VERSION, demo: isDemo(), queue: queue.stats() });
}
