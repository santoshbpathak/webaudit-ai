import { AiError, previewTask } from "@webaudit/ai";
import { aiContext } from "@/lib/ai";
import { json, problem } from "@/lib/server";

/** POST — returns exactly what would be sent, without sending it (AI-06). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await aiContext(req, id);
  if ("error" in ctx) return ctx.error;
  try {
    return json(previewTask(ctx.db, id, ctx.task, ctx.provider, ctx.question));
  } catch (e) {
    return problem(400, e instanceof AiError ? e.message : "Could not build preview");
  }
}
