import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  AuditConfig,
  AuditMode,
  AuditStatus,
  BrowserSnapshot,
  Confidence,
  Evidence,
  FindingStatus,
  ModuleId,
  RedirectHop,
  Severity,
  UrlState,
} from "@webaudit/core";

/** Bumped whenever a migration changes stored shapes. Saved on each audit for provenance. */
export const SCHEMA_VERSION = 1;

export interface CoverageSummary {
  discovered: number;
  queued: number;
  attempted: number;
  checked: number;
  blockedRobots: number;
  skipped: number;
  failed: number;
  sampled: number;
  sitemapUrls: number;
}

export const audits = sqliteTable(
  "audits",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    host: text("host").notNull(),
    mode: text("mode").$type<AuditMode>().notNull(),
    status: text("status").$type<AuditStatus>().notNull(),
    config: text("config", { mode: "json" }).$type<AuditConfig>().notNull(),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    phase: text("phase"),
    schemaVersion: integer("schema_version").notNull(),
    engineVersions: text("engine_versions", { mode: "json" }).$type<Record<string, string>>(),
    coverage: text("coverage", { mode: "json" }).$type<CoverageSummary>(),
    samplingPolicy: text("sampling_policy", { mode: "json" }).$type<Record<string, unknown>>(),
    error: text("error"),
    cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull().default(false),
    label: text("label"),
  },
  (t) => [index("audits_host_idx").on(t.host, t.createdAt)],
);

export const discoveredUrls = sqliteTable(
  "discovered_urls",
  {
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    originalUrl: text("original_url").notNull(),
    source: text("source").$type<"start" | "sitemap" | "link" | "redirect" | "render">().notNull(),
    sourceUrl: text("source_url"),
    depth: integer("depth").notNull(),
    state: text("state").$type<UrlState>().notNull(),
    reason: text("reason"),
    httpStatus: integer("http_status"),
    contentType: text("content_type"),
    finalUrl: text("final_url"),
    redirectChain: text("redirect_chain", { mode: "json" }).$type<RedirectHop[]>(),
    inSitemap: integer("in_sitemap", { mode: "boolean" }).notNull().default(false),
    sampled: integer("sampled", { mode: "boolean" }).notNull().default(false),
    sampleReason: text("sample_reason"),
    templateCluster: text("template_cluster"),
    discoveredAt: text("discovered_at").notNull(),
    attemptedAt: text("attempted_at"),
    checkedAt: text("checked_at"),
  },
  (t) => [primaryKey({ columns: [t.auditId, t.url] }), index("urls_state_idx").on(t.auditId, t.state)],
);

/** Derived page features kept after the raw HTML is discarded. */
export interface PageFeatures {
  title?: string;
  metaDescription?: string;
  h1: string[];
  canonical?: string;
  lang?: string;
  wordCount: number;
  contentHash: string;
  simhash: string;
  domSignature: string;
  internalLinks: string[];
  externalLinkCount: number;
}

export const pageSnapshots = sqliteTable(
  "page_snapshots",
  {
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    status: integer("status").notNull(),
    finalUrl: text("final_url").notNull(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    elapsedMs: integer("elapsed_ms").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    features: text("features", { mode: "json" }).$type<PageFeatures>(),
    /** Browser observations minus rendered HTML. */
    browser: text("browser", { mode: "json" }).$type<Omit<BrowserSnapshot, "renderedHtml">>(),
  },
  (t) => [primaryKey({ columns: [t.auditId, t.url] })],
);

export const findings = sqliteTable(
  "findings",
  {
    findingId: text("finding_id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(),
    url: text("url").notNull(),
    module: text("module").$type<ModuleId>().notNull(),
    status: text("status").$type<FindingStatus>().notNull(),
    severity: text("severity").$type<Severity>().notNull(),
    confidence: text("confidence").$type<Confidence>().notNull(),
    observedAt: text("observed_at").notNull(),
    engineVersion: text("engine_version").notNull(),
    evidence: text("evidence", { mode: "json" }).$type<Evidence>().notNull(),
    recommendedAction: text("recommended_action").notNull(),
    applicability: text("applicability").notNull(),
    reason: text("reason"),
    groupSignature: text("group_signature"),
  },
  (t) => [
    index("findings_audit_status_idx").on(t.auditId, t.status),
    index("findings_audit_rule_idx").on(t.auditId, t.ruleId),
    index("findings_audit_url_idx").on(t.auditId, t.url),
  ],
);

export interface PriorityComponents {
  severityWeight: number;
  pageFactor: number;
  confidenceFactor: number;
  importanceFactor: number;
}

export const findingGroups = sqliteTable(
  "finding_groups",
  {
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    signature: text("signature").notNull(),
    ruleId: text("rule_id").notNull(),
    module: text("module").$type<ModuleId>().notNull(),
    title: text("title").notNull(),
    severity: text("severity").$type<Severity>().notNull(),
    confidence: text("confidence").$type<Confidence>().notNull(),
    affectedPages: integer("affected_pages").notNull(),
    testedPages: integer("tested_pages").notNull(),
    templateHint: text("template_hint"),
    priority: real("priority").notNull(),
    priorityComponents: text("priority_components", { mode: "json" }).$type<PriorityComponents>().notNull(),
    enoughEvidence: integer("enough_evidence", { mode: "boolean" }).notNull(),
    sampleUrls: text("sample_urls", { mode: "json" }).$type<string[]>().notNull(),
    recommendedAction: text("recommended_action").notNull(),
  },
  (t) => [primaryKey({ columns: [t.auditId, t.signature] })],
);

export const evidenceArtifacts = sqliteTable(
  "evidence_artifacts",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    url: text("url"),
    kind: text("kind").$type<"screenshot" | "lighthouse" | "report" | "bundle">().notNull(),
    path: text("path").notNull(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("artifacts_audit_idx").on(t.auditId)],
);

export const exportsTable = sqliteTable("exports", {
  id: text("id").primaryKey(),
  auditId: text("audit_id")
    .notNull()
    .references(() => audits.id, { onDelete: "cascade" }),
  format: text("format").$type<"html" | "json" | "csv" | "md">().notNull(),
  artifactId: text("artifact_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const llmAnalyses = sqliteTable(
  "llm_analyses",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    task: text("task").$type<"executive_summary" | "roadmap" | "qa">().notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    question: text("question"),
    /** Exactly what was sent (shown to user before sending, AI-06). */
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    output: text("output", { mode: "json" }).$type<unknown>(),
    citedFindingIds: text("cited_finding_ids", { mode: "json" }).$type<string[]>(),
    invalidCitations: text("invalid_citations", { mode: "json" }).$type<string[]>(),
    status: text("status").$type<"ok" | "error">().notNull(),
    error: text("error"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("llm_audit_idx").on(t.auditId)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    at: text("at").notNull(),
    level: text("level").$type<"debug" | "info" | "warn" | "error">().notNull(),
    phase: text("phase"),
    message: text("message").notNull(),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [index("events_audit_idx").on(t.auditId, t.id)],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text("status").$type<"queued" | "leased" | "done" | "failed">().notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(2),
    runAfter: text("run_after").notNull(),
    leaseUntil: text("lease_until"),
    workerId: text("worker_id"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("jobs_ready_idx").on(t.status, t.runAfter)],
);
