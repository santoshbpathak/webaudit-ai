import { AiBudgetError, AiError, runTask } from "@webaudit/ai";
import { aiContext } from "@/lib/ai";
import { json, problem } from "@/lib/server";

export const maxDuration = 300;

/** POST {task, question?, confirm: true} — explicit opt-in per request (AI-06). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await aiContext(req, id);
  if ("error" in ctx) return ctx.error;
  if (!ctx.confirm)
    return problem(400, "Review the transmission preview and confirm before sending data to an AI provider");
  try {
    const { payload: _p, ...row } = await runTask(ctx.db, id, ctx.task, ctx.provider, ctx.question);
    return json({ analysis: row }, { status: row.status === "ok" ? 200 : 502 });
  } catch (e) {
    if (e instanceof AiBudgetError) return problem(429, e.message);
    if (e instanceof AiError) return problem(400, e.message);
    throw e;
  }
}
