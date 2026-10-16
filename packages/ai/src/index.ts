import { insertAnalysis, listAnalyses, type AnalysisRow, type Db } from "@webaudit/db";
import { loadReportData } from "@webaudit/report";
import { AiError, type AiProvider } from "./providers";
import {
  SCHEMAS,
  SYSTEM_PROMPT,
  allowedIds,
  buildPayload,
  citedIds,
  renderUserMessage,
  type AiPayload,
  type AiTask,
} from "./tasks";

export * from "./providers";
export * from "./tasks";

export interface TransmissionPreview {
  task: AiTask;
  provider: string;
  model: string;
  destination: string;
  /** Exactly what will be sent (AI-06). */
  system: string;
  user: string;
  payload: AiPayload;
  approxChars: number;
}

/** Build — but do not send — the request, so the user can review it first. */
export function previewTask(
  db: Db,
  auditId: string,
  task: AiTask,
  provider: AiProvider,
  question?: string,
): TransmissionPreview {
  if (task === "qa" && !question?.trim()) throw new AiError("A question is required", "config");
  const payload = buildPayload(loadReportData(db, auditId), task, question);
  const user = renderUserMessage(payload);
  return {
    task,
    provider: provider.name,
    model: provider.model,
    destination: provider.destination,
    system: SYSTEM_PROMPT,
    user,
    payload,
    approxChars: SYSTEM_PROMPT.length + user.length,
  };
}

/**
 * Run one optional AI task. The ONLY write is an append to llm_analyses: there is no
 * code path from AI output to findings, groups, severity or status (AI-04, T14).
 * Citations to ids not present in the payload are recorded as invalid (hallucination guard).
 */
export async function runTask(
  db: Db,
  auditId: string,
  task: AiTask,
  provider: AiProvider,
  question?: string,
): Promise<AnalysisRow> {
  const max = maxCallsPerAudit();
  if (listAnalyses(db, auditId).length >= max)
    throw new AiBudgetError(
      `This audit has reached the AI call limit (${max}). Raise WEBAUDIT_AI_MAX_CALLS_PER_AUDIT to allow more.`,
    );
  const preview = previewTask(db, auditId, task, provider, question);
  const allowed = allowedIds(preview.payload);
  try {
    const res = await provider.generate({
      system: preview.system,
      user: preview.user,
      schema: SCHEMAS[task] as never,
      schemaName: task,
    });
    const cited = citedIds(res.data);
    return insertAnalysis(db, {
      auditId,
      task,
      provider: provider.name,
      model: res.model,
      question: question ?? null,
      payload: preview.payload,
      output: res.data,
      citedFindingIds: cited.filter((id) => allowed.has(id)),
      invalidCitations: cited.filter((id) => !allowed.has(id)),
      status: "ok",
      error: null,
    });
  } catch (e) {
    return insertAnalysis(db, {
      auditId,
      task,
      provider: provider.name,
      model: provider.model,
      question: question ?? null,
      payload: preview.payload,
      output: null,
      citedFindingIds: [],
      invalidCitations: [],
      status: "error",
      error: e instanceof AiError ? e.message : `Unexpected error: ${(e as Error).message}`,
    });
  }
}

export { listAnalyses };

/** Spend guard: every provider call is stored in llm_analyses, so the count is the budget. */
export class AiBudgetError extends Error {}

export function maxCallsPerAudit(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.WEBAUDIT_AI_MAX_CALLS_PER_AUDIT ?? 20);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 20;
}
