import { aiStatus } from "@webaudit/ai";
import { isDemo } from "@/lib/server";

export const dynamic = "force-dynamic";

export function GET() {
  const s = aiStatus();
  return Response.json(isDemo() ? { enabled: false, reason: "AI is disabled in the public demo." } : s);
}
