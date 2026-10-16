import { resolveConfig, type AuditConfigInput } from "@webaudit/core";
import { createAudit, type AuditRow, type Db } from "@webaudit/db";
import { AUDIT_JOB, type JobQueue } from "@webaudit/queue";
import { assertSafeUrlShape, type SafetyPolicy } from "@webaudit/safety";

// Lightweight entry (no Playwright/Lighthouse imports) so the web app can enqueue audits.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Validate input, create the audit row and enqueue it. Shared by API, CLI and tests. */
export function createAndQueueAudit(
  db: Db,
  queue: JobQueue,
  policy: SafetyPolicy,
  input: AuditConfigInput,
  label?: string,
): AuditRow {
  let config;
  try {
    const raw = input.url.trim();
    config = resolveConfig({ ...input, url: /^https?:\/\//i.test(raw) ? raw : `https://${raw}` });
  } catch (e) {
    throw new ValidationError(`Invalid audit configuration: ${(e as Error).message}`);
  }
  try {
    assertSafeUrlShape(config.url, policy);
  } catch (e) {
    throw new ValidationError((e as Error).message);
  }
  const audit = createAudit(db, config, label);
  queue.enqueue(AUDIT_JOB, { auditId: audit.id }, { maxAttempts: 2 });
  return audit;
}
