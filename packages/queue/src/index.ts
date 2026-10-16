import { newId } from "@webaudit/core";
import type { Db } from "@webaudit/db";

export interface Job<P = Record<string, unknown>> {
  id: string;
  type: string;
  payload: P;
  attempts: number;
  maxAttempts: number;
}

export interface EnqueueOptions {
  maxAttempts?: number;
  runAfter?: Date;
}

/**
 * Persistent job queue contract. The SQLite implementation serves a single machine;
 * a Postgres implementation (FOR UPDATE SKIP LOCKED) can satisfy the same contract for
 * multi-worker deployments without changing callers.
 */
export interface JobQueue {
  enqueue<P extends Record<string, unknown>>(type: string, payload: P, opts?: EnqueueOptions): string;
  /** Atomically claim the next ready job, or null. */
  lease(workerId: string, types: string[], leaseMs: number): Job | null;
  heartbeat(jobId: string, workerId: string, leaseMs: number): boolean;
  complete(jobId: string, workerId: string): void;
  /** Record failure; requeues if attempts remain. Returns true if it will retry. */
  fail(jobId: string, workerId: string, error: string, retryDelayMs?: number): boolean;
  stats(): Record<string, number>;
}

interface JobRecord {
  id: string;
  type: string;
  payload: string;
  attempts: number;
  max_attempts: number;
}

export class SqliteJobQueue implements JobQueue {
  constructor(private readonly db: Db) {}

  private get sql() {
    return this.db.$client;
  }

  enqueue<P extends Record<string, unknown>>(type: string, payload: P, opts: EnqueueOptions = {}): string {
    const id = newId("job");
    const ts = new Date().toISOString();
    this.sql
      .prepare(
        `INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, run_after, created_at, updated_at)
         VALUES (?, ?, ?, 'queued', 0, ?, ?, ?, ?)`,
      )
      .run(
        id,
        type,
        JSON.stringify(payload),
        opts.maxAttempts ?? 2,
        (opts.runAfter ?? new Date()).toISOString(),
        ts,
        ts,
      );
    return id;
  }

  lease(workerId: string, types: string[], leaseMs: number): Job | null {
    if (!types.length) return null;
    const nowIso = new Date().toISOString();
    const until = new Date(Date.now() + leaseMs).toISOString();
    const placeholders = types.map(() => "?").join(",");
    // Ready = queued and due, OR leased with an expired lease (crashed worker).
    const row = this.sql
      .prepare(
        `UPDATE jobs SET status = 'leased', lease_until = ?, worker_id = ?, attempts = attempts + 1, updated_at = ?
         WHERE id = (
           SELECT id FROM jobs
           WHERE type IN (${placeholders})
             AND ((status = 'queued' AND run_after <= ?) OR (status = 'leased' AND lease_until < ?))
             AND attempts < max_attempts
           ORDER BY run_after ASC, created_at ASC
           LIMIT 1
         )
         RETURNING id, type, payload, attempts, max_attempts`,
      )
      .get(until, workerId, nowIso, ...types, nowIso, nowIso) as JobRecord | undefined;
    if (!row) {
      this.failExhausted(nowIso);
      return null;
    }
    return {
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
    };
  }

  /** Leased jobs whose lease expired and have no attempts left become failed. */
  private failExhausted(nowIso: string): void {
    this.sql
      .prepare(
        `UPDATE jobs SET status = 'failed', last_error = coalesce(last_error, 'lease expired; attempts exhausted'), updated_at = ?
         WHERE status = 'leased' AND lease_until < ? AND attempts >= max_attempts`,
      )
      .run(nowIso, nowIso);
  }

  heartbeat(jobId: string, workerId: string, leaseMs: number): boolean {
    const until = new Date(Date.now() + leaseMs).toISOString();
    const res = this.sql
      .prepare(
        `UPDATE jobs SET lease_until = ?, updated_at = ? WHERE id = ? AND worker_id = ? AND status = 'leased'`,
      )
      .run(until, new Date().toISOString(), jobId, workerId);
    return res.changes === 1;
  }

  complete(jobId: string, workerId: string): void {
    this.sql
      .prepare(
        `UPDATE jobs SET status = 'done', lease_until = NULL, updated_at = ? WHERE id = ? AND worker_id = ?`,
      )
      .run(new Date().toISOString(), jobId, workerId);
  }

  fail(jobId: string, workerId: string, error: string, retryDelayMs = 5_000): boolean {
    const row = this.sql.prepare(`SELECT attempts, max_attempts FROM jobs WHERE id = ?`).get(jobId) as
      { attempts: number; max_attempts: number } | undefined;
    if (!row) return false;
    const retry = row.attempts < row.max_attempts;
    this.sql
      .prepare(
        `UPDATE jobs SET status = ?, last_error = ?, lease_until = NULL, run_after = ?, updated_at = ?
         WHERE id = ? AND worker_id = ?`,
      )
      .run(
        retry ? "queued" : "failed",
        error.slice(0, 2_000),
        new Date(Date.now() + retryDelayMs).toISOString(),
        new Date().toISOString(),
        jobId,
        workerId,
      );
    return retry;
  }

  stats(): Record<string, number> {
    const rows = this.sql.prepare(`SELECT status, count(*) AS n FROM jobs GROUP BY status`).all() as {
      status: string;
      n: number;
    }[];
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  }
}

export const AUDIT_JOB = "audit.run";
