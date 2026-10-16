import { and, asc, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import type {
  AuditConfig,
  AuditStatus,
  Finding,
  FindingStatus,
  ModuleId,
  Severity,
  UrlState,
} from "@webaudit/core";
import { newId } from "@webaudit/core";
import type { Db } from "./connection";
import {
  SCHEMA_VERSION,
  auditEvents,
  audits,
  discoveredUrls,
  evidenceArtifacts,
  findingGroups,
  findings,
  llmAnalyses,
  pageSnapshots,
  type CoverageSummary,
} from "./schema";

export type AuditRow = typeof audits.$inferSelect;
export type UrlRow = typeof discoveredUrls.$inferSelect;
export type UrlInsert = typeof discoveredUrls.$inferInsert;
export type SnapshotRow = typeof pageSnapshots.$inferSelect;
export type SnapshotInsert = typeof pageSnapshots.$inferInsert;
export type GroupRow = typeof findingGroups.$inferSelect;
export type GroupInsert = typeof findingGroups.$inferInsert;
export type ArtifactRow = typeof evidenceArtifacts.$inferSelect;
export type EventRow = typeof auditEvents.$inferSelect;
export type AnalysisRow = typeof llmAnalyses.$inferSelect;
export type AnalysisInsert = typeof llmAnalyses.$inferInsert;

const now = () => new Date().toISOString();
const CHUNK = 200;

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------- audits ----------

export function createAudit(db: Db, config: AuditConfig, label?: string): AuditRow {
  const row = {
    id: newId("aud"),
    url: config.url,
    host: new URL(config.url).hostname,
    mode: config.mode,
    status: "queued" as AuditStatus,
    config,
    createdAt: now(),
    schemaVersion: SCHEMA_VERSION,
    cancelRequested: false,
    label: label ?? null,
  };
  db.insert(audits).values(row).run();
  return getAudit(db, row.id)!;
}

export function getAudit(db: Db, id: string): AuditRow | undefined {
  return db.select().from(audits).where(eq(audits.id, id)).get();
}

export function listAudits(db: Db, opts: { host?: string; limit?: number } = {}): AuditRow[] {
  const q = db.select().from(audits);
  const filtered = opts.host ? q.where(eq(audits.host, opts.host)) : q;
  return filtered
    .orderBy(desc(audits.createdAt))
    .limit(opts.limit ?? 100)
    .all();
}

export function updateAudit(db: Db, id: string, patch: Partial<Omit<AuditRow, "id">>): void {
  db.update(audits).set(patch).where(eq(audits.id, id)).run();
}

export function requestCancel(db: Db, id: string): boolean {
  const a = getAudit(db, id);
  if (!a) return false;
  if (a.status === "queued") {
    updateAudit(db, id, { cancelRequested: true, status: "cancelled_partial", finishedAt: now() });
  } else if (a.status === "running") {
    updateAudit(db, id, { cancelRequested: true, status: "cancelling" });
  } else {
    return false;
  }
  return true;
}

export function isCancelRequested(db: Db, id: string): boolean {
  const r = db.select({ c: audits.cancelRequested }).from(audits).where(eq(audits.id, id)).get();
  return r?.c ?? false;
}

export function deleteAudit(db: Db, id: string): void {
  db.delete(audits).where(eq(audits.id, id)).run();
}

// ---------- URL ledger ----------

/** Insert URLs that are not already known for this audit. Returns rows actually inserted. */
export function insertDiscovered(db: Db, rows: UrlInsert[]): number {
  let inserted = 0;
  db.transaction((tx) => {
    for (const c of chunks(rows)) {
      const res = tx.insert(discoveredUrls).values(c).onConflictDoNothing().run();
      inserted += res.changes;
    }
  });
  return inserted;
}

export function updateUrl(db: Db, auditId: string, url: string, patch: Partial<UrlInsert>): void {
  db.update(discoveredUrls)
    .set(patch)
    .where(and(eq(discoveredUrls.auditId, auditId), eq(discoveredUrls.url, url)))
    .run();
}

export function getUrl(db: Db, auditId: string, url: string): UrlRow | undefined {
  return db
    .select()
    .from(discoveredUrls)
    .where(and(eq(discoveredUrls.auditId, auditId), eq(discoveredUrls.url, url)))
    .get();
}

export function listUrls(
  db: Db,
  auditId: string,
  opts: { state?: UrlState[]; sampled?: boolean; limit?: number; offset?: number } = {},
): UrlRow[] {
  const conds: SQL[] = [eq(discoveredUrls.auditId, auditId)];
  if (opts.state?.length) conds.push(inArray(discoveredUrls.state, opts.state));
  if (opts.sampled !== undefined) conds.push(eq(discoveredUrls.sampled, opts.sampled));
  return db
    .select()
    .from(discoveredUrls)
    .where(and(...conds))
    .orderBy(asc(discoveredUrls.discoveredAt), asc(discoveredUrls.url))
    .limit(opts.limit ?? 10_000)
    .offset(opts.offset ?? 0)
    .all();
}

export function countUrlsByState(db: Db, auditId: string): Record<UrlState, number> {
  const rows = db
    .select({ state: discoveredUrls.state, n: sql<number>`count(*)` })
    .from(discoveredUrls)
    .where(eq(discoveredUrls.auditId, auditId))
    .groupBy(discoveredUrls.state)
    .all();
  const out = {
    discovered: 0,
    queued: 0,
    attempted: 0,
    checked: 0,
    blocked_robots: 0,
    skipped: 0,
    failed: 0,
  } as Record<UrlState, number>;
  for (const r of rows) out[r.state] = Number(r.n);
  return out;
}

/** Coverage summary computed from the ledger — never from in-memory counters. */
export function computeCoverage(db: Db, auditId: string): CoverageSummary {
  const s = countUrlsByState(db, auditId);
  const extra = db
    .select({
      total: sql<number>`count(*)`,
      sampled: sql<number>`sum(case when ${discoveredUrls.sampled} then 1 else 0 end)`,
      sitemap: sql<number>`sum(case when ${discoveredUrls.inSitemap} then 1 else 0 end)`,
    })
    .from(discoveredUrls)
    .where(eq(discoveredUrls.auditId, auditId))
    .get();
  return {
    discovered: Number(extra?.total ?? 0),
    queued: s.queued + s.discovered,
    attempted: s.attempted,
    checked: s.checked,
    blockedRobots: s.blocked_robots,
    skipped: s.skipped,
    failed: s.failed,
    sampled: Number(extra?.sampled ?? 0),
    sitemapUrls: Number(extra?.sitemap ?? 0),
  };
}

// ---------- snapshots ----------

export function saveSnapshot(db: Db, row: SnapshotInsert): void {
  db.insert(pageSnapshots)
    .values(row)
    .onConflictDoUpdate({
      target: [pageSnapshots.auditId, pageSnapshots.url],
      set: {
        status: row.status,
        finalUrl: row.finalUrl,
        contentType: row.contentType,
        bytes: row.bytes,
        elapsedMs: row.elapsedMs,
        fetchedAt: row.fetchedAt,
        features: row.features,
        ...(row.browser ? { browser: row.browser } : {}),
      },
    })
    .run();
}

export function getSnapshot(db: Db, auditId: string, url: string): SnapshotRow | undefined {
  return db
    .select()
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.auditId, auditId), eq(pageSnapshots.url, url)))
    .get();
}

export function listSnapshots(db: Db, auditId: string): SnapshotRow[] {
  return db.select().from(pageSnapshots).where(eq(pageSnapshots.auditId, auditId)).all();
}

// ---------- findings ----------

export function insertFindings(db: Db, rows: (Finding & { groupSignature?: string })[]): void {
  if (!rows.length) return;
  db.transaction((tx) => {
    for (const c of chunks(rows)) {
      tx.insert(findings)
        .values(c.map((f) => ({ ...f, reason: f.reason ?? null, groupSignature: f.groupSignature ?? null })))
        .run();
    }
  });
}

export interface FindingFilter {
  status?: FindingStatus[];
  severity?: Severity[];
  module?: ModuleId[];
  ruleId?: string;
  url?: string;
  groupSignature?: string;
  limit?: number;
  offset?: number;
}

export function listFindings(db: Db, auditId: string, f: FindingFilter = {}): Finding[] {
  const conds: SQL[] = [eq(findings.auditId, auditId)];
  if (f.status?.length) conds.push(inArray(findings.status, f.status));
  if (f.severity?.length) conds.push(inArray(findings.severity, f.severity));
  if (f.module?.length) conds.push(inArray(findings.module, f.module));
  if (f.ruleId) conds.push(eq(findings.ruleId, f.ruleId));
  if (f.url) conds.push(eq(findings.url, f.url));
  if (f.groupSignature) conds.push(eq(findings.groupSignature, f.groupSignature));
  const rows = db
    .select()
    .from(findings)
    .where(and(...conds))
    .orderBy(asc(findings.ruleId), asc(findings.url))
    .limit(f.limit ?? 50_000)
    .offset(f.offset ?? 0)
    .all();
  return rows.map(({ groupSignature: _g, reason, ...r }) => ({ ...r, reason: reason ?? undefined }));
}

export function setGroupSignatures(db: Db, assignments: { findingId: string; signature: string }[]): void {
  const stmt = db.$client.prepare("UPDATE findings SET group_signature = ? WHERE finding_id = ?");
  db.$client.transaction(() => {
    for (const a of assignments) stmt.run(a.signature, a.findingId);
  })();
}

/** Per-rule tested/failed counts — the denominator source for T07. */
export function ruleCoverage(
  db: Db,
  auditId: string,
): { ruleId: string; tested: number; failed: number; notTested: number; inconclusive: number }[] {
  return db
    .select({
      ruleId: findings.ruleId,
      tested: sql<number>`sum(case when ${findings.status} in ('pass','fail') then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${findings.status} = 'fail' then 1 else 0 end)`,
      notTested: sql<number>`sum(case when ${findings.status} = 'not_tested' then 1 else 0 end)`,
      inconclusive: sql<number>`sum(case when ${findings.status} = 'inconclusive' then 1 else 0 end)`,
    })
    .from(findings)
    .where(eq(findings.auditId, auditId))
    .groupBy(findings.ruleId)
    .all()
    .map((r) => ({
      ruleId: r.ruleId,
      tested: Number(r.tested),
      failed: Number(r.failed),
      notTested: Number(r.notTested),
      inconclusive: Number(r.inconclusive),
    }));
}

// ---------- groups ----------

export function replaceGroups(db: Db, auditId: string, rows: GroupInsert[]): void {
  db.transaction((tx) => {
    tx.delete(findingGroups).where(eq(findingGroups.auditId, auditId)).run();
    for (const c of chunks(rows)) tx.insert(findingGroups).values(c).run();
  });
}

export function listGroups(db: Db, auditId: string): GroupRow[] {
  return db
    .select()
    .from(findingGroups)
    .where(eq(findingGroups.auditId, auditId))
    .orderBy(desc(findingGroups.priority))
    .all();
}

// ---------- artifacts ----------

export function addArtifact(db: Db, row: Omit<ArtifactRow, "id" | "createdAt">): ArtifactRow {
  const full = { ...row, id: newId("art"), createdAt: now() };
  db.insert(evidenceArtifacts).values(full).run();
  return full;
}

export function getArtifact(db: Db, id: string): ArtifactRow | undefined {
  return db.select().from(evidenceArtifacts).where(eq(evidenceArtifacts.id, id)).get();
}

export function listArtifacts(db: Db, auditId: string): ArtifactRow[] {
  return db.select().from(evidenceArtifacts).where(eq(evidenceArtifacts.auditId, auditId)).all();
}

// ---------- events ----------

export function logEvent(
  db: Db,
  auditId: string,
  level: EventRow["level"],
  message: string,
  phase?: string,
  data?: Record<string, unknown>,
): void {
  db.insert(auditEvents)
    .values({ auditId, at: now(), level, message, phase: phase ?? null, data: data ?? null })
    .run();
}

export function listEvents(db: Db, auditId: string, afterId = 0, limit = 500): EventRow[] {
  return db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.auditId, auditId), gt(auditEvents.id, afterId)))
    .orderBy(asc(auditEvents.id))
    .limit(limit)
    .all();
}

// ---------- LLM analyses (append-only; see AnalysisSink) ----------

export function insertAnalysis(db: Db, row: Omit<AnalysisInsert, "id" | "createdAt">): AnalysisRow {
  const full = { ...row, id: newId("llm"), createdAt: now() };
  db.insert(llmAnalyses).values(full).run();
  return db.select().from(llmAnalyses).where(eq(llmAnalyses.id, full.id)).get()!;
}

export function listAnalyses(db: Db, auditId: string): AnalysisRow[] {
  return db
    .select()
    .from(llmAnalyses)
    .where(eq(llmAnalyses.auditId, auditId))
    .orderBy(desc(llmAnalyses.createdAt))
    .all();
}
