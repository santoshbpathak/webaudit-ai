import { hostname } from "node:os";
import { getAudit, type Db } from "@webaudit/db";
import { AUDIT_JOB, type JobQueue } from "@webaudit/queue";
import { runAudit, type RunDeps } from "./run";

export interface WorkerOptions {
  workerId?: string;
  leaseMs?: number;
  pollMs?: number;
  signal?: AbortSignal;
  /** Stop after the queue is empty (CLI / tests). */
  exitWhenIdle?: boolean;
}

/**
 * Lease-based worker loop. Heartbeats keep the lease while an audit runs; if this
 * process dies, the lease expires and another worker resumes the audit.
 */
export async function runWorker(
  db: Db,
  queue: JobQueue,
  deps: Omit<RunDeps, "db">,
  opts: WorkerOptions = {},
): Promise<void> {
  const workerId = opts.workerId ?? `${hostname()}:${process.pid}`;
  const leaseMs = opts.leaseMs ?? 60_000;
  const pollMs = opts.pollMs ?? 1_000;
  while (!opts.signal?.aborted) {
    const job = queue.lease(workerId, [AUDIT_JOB], leaseMs);
    if (!job) {
      if (opts.exitWhenIdle) return;
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    const auditId = String(job.payload.auditId);
    const hb = setInterval(() => queue.heartbeat(job.id, workerId, leaseMs), Math.floor(leaseMs / 3));
    try {
      deps.onLog?.("info", `[worker ${workerId}] running audit ${auditId} (attempt ${job.attempts})`);
      if (!getAudit(db, auditId)) {
        queue.complete(job.id, workerId);
        continue;
      }
      await runAudit(auditId, { ...deps, db });
      queue.complete(job.id, workerId);
    } catch (e) {
      deps.onLog?.("error", `[worker ${workerId}] audit ${auditId} crashed: ${(e as Error).message}`);
      queue.fail(job.id, workerId, (e as Error).message);
    } finally {
      clearInterval(hb);
    }
  }
}
