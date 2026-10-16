import "server-only";
import { providerFromEnv, type AiError, type AiTask } from "@webaudit/ai";
import { getAudit } from "@webaudit/db";
import { isDemo, isJson, problem, services } from "./server";

const TASKS: AiTask[] = ["executive_summary", "roadmap", "qa"];

/** Shared validation for AI routes. Returns a Response on failure. */
export async function aiContext(req: Request, id: string) {
  if (isDemo()) return { error: problem(403, "AI is disabled in the public demo") };
  if (!isJson(req)) return { error: problem(415, "Content-Type must be application/json") };
  let provider;
  try {
    provider = providerFromEnv();
  } catch (e) {
    return { error: problem(400, (e as AiError).message) };
  }
  if (!provider) return { error: problem(400, "AI is off. Set WEBAUDIT_AI_PROVIDER to enable it.") };
  const { db } = services();
  const audit = getAudit(db, id);
  if (!audit) return { error: problem(404, "Audit not found") };
  if (audit.phase !== "done") return { error: problem(409, "Audit has not finished") };
  const body = (await req.json().catch(() => ({}))) as {
    task?: string;
    question?: string;
    confirm?: boolean;
  };
  if (!TASKS.includes(body.task as AiTask))
    return { error: problem(400, "task must be executive_summary, roadmap or qa") };
  return {
    db,
    provider,
    task: body.task as AiTask,
    question: body.question?.slice(0, 500),
    confirm: body.confirm === true,
  };
}
