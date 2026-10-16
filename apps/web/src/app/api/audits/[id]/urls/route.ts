import type { UrlState } from "@webaudit/core";
import { listUrls } from "@webaudit/db";
import { json, services } from "@/lib/server";

export const dynamic = "force-dynamic";

/** GET /api/audits/:id/urls?state=checked,failed&limit=&offset= — URL inventory and outcomes. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const state = sp.get("state")?.split(",").filter(Boolean) as UrlState[] | undefined;
  return json({
    urls: listUrls(services().db, id, {
      state,
      limit: Math.min(Number(sp.get("limit") ?? 1000), 10_000),
      offset: Number(sp.get("offset") ?? 0),
    }),
  });
}
