import "server-only";
import { defaultDbPath, openDb, type Db } from "@webaudit/db";
import { LocalArtifactStore, defaultArtifactRoot } from "@webaudit/pipeline/artifacts";
import { SqliteJobQueue } from "@webaudit/queue";
import { policyFromEnv } from "@webaudit/safety";

/** Process-wide singletons (survive Next dev hot reloads via globalThis). */
const g = globalThis as unknown as {
  __webaudit?: { db: Db; queue: SqliteJobQueue; artifacts: LocalArtifactStore };
};

export function services() {
  if (!g.__webaudit) {
    const db = openDb(defaultDbPath());
    g.__webaudit = {
      db,
      queue: new SqliteJobQueue(db),
      artifacts: new LocalArtifactStore(defaultArtifactRoot()),
    };
  }
  return { ...g.__webaudit, policy: policyFromEnv() };
}

export const isDemo = () => process.env.WEBAUDIT_DEMO === "1";

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, init);
}

/** Mutating JSON routes require a JSON content type, so a cross-site "simple" request
 * (text/plain, no CORS preflight) can never reach them. */
export function isJson(req: Request): boolean {
  return (req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

export function problem(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
