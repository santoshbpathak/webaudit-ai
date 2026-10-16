import { z } from "zod";
import { ModuleId } from "./finding";

export const AuditMode = z.enum(["quick", "smart", "deep"]);
export type AuditMode = z.infer<typeof AuditMode>;

export const ENGINE_VERSION = "0.1.0";
export const DEFAULT_USER_AGENT = `WebAuditAI/${ENGINE_VERSION} (+https://github.com/santoshbpathak/webaudit-ai; open-source site auditor)`;

/** Paths that look state-changing or private. Never crawled by default (PRD §7). */
export const DEFAULT_DENY_PATTERNS = [
  "/logout",
  "/log-out",
  "/signout",
  "/sign-out",
  "/cart",
  "/checkout",
  "/basket",
  "/wp-admin",
  "/admin",
  "/account",
  "/my-account",
  "/login",
  "/wp-login.php",
  "add-to-cart=",
  "action=delete",
  "/delete",
  "/unsubscribe",
];

/** Bounded so API callers cannot submit pathological patterns or unbounded lists. */
const Pattern = z.string().max(200);

export const AuditConfig = z.object({
  url: z.string().min(1),
  mode: AuditMode.default("smart"),
  maxUrls: z.number().int().min(1).max(5_000).default(500),
  maxDepth: z.number().int().min(0).max(20).default(5),
  includeSubdomains: z.boolean().default(false),
  /** Concurrent HTTP fetches during discovery. */
  httpConcurrency: z.number().int().min(1).max(16).default(4),
  /** Concurrent browser pages for heavy checks. */
  browserConcurrency: z.number().int().min(1).max(4).default(2),
  /** Minimum delay between requests to the same host. */
  perHostDelayMs: z.number().int().min(0).max(30_000).default(250),
  pageTimeoutMs: z.number().int().min(1_000).max(120_000).default(30_000),
  auditDeadlineMs: z
    .number()
    .int()
    .min(10_000)
    .max(6 * 60 * 60 * 1000)
    .default(30 * 60 * 1000),
  maxResponseBytes: z.number().int().min(10_000).max(50_000_000).default(5_000_000),
  userAgent: z.string().max(300).default(DEFAULT_USER_AGENT),
  device: z.enum(["mobile", "desktop"]).default("mobile"),
  /** Render pages with Playwright during discovery to find JS-inserted links (CR-08). */
  renderDiscovery: z.boolean().default(false),
  sitemapOnly: z.boolean().default(false),
  allowPaths: z.array(Pattern).max(200).default([]),
  denyPaths: z.array(Pattern).max(200).default(DEFAULT_DENY_PATTERNS),
  /** Query params dropped during normalization (tracking etc.), in addition to built-ins. */
  stripParams: z.array(Pattern).max(200).default([]),
  /** Max distinct query-string variants per path (T04 loop guard). */
  maxQueryVariantsPerPath: z.number().int().min(1).max(100).default(5),
  /** Pages sampled for heavy checks in smart mode. */
  sampleSize: z.number().int().min(1).max(500).default(30),
  modules: z.array(ModuleId).default(["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10"]),
  /** Run Lighthouse (slow). */
  lighthouse: z.boolean().default(true),
  /** Lighthouse runs on at most this many sampled pages (start URL first). */
  lighthouseMaxPages: z.number().int().min(0).max(100).default(5),
  /** Paths the user marks as business-critical; raises importance factor (PRD §5.4). */
  priorityPaths: z.array(Pattern).max(200).default([]),
  /** Rule ids disabled for this audit (AU-05). */
  disabledRules: z.array(Pattern).max(200).default([]),
});
export type AuditConfig = z.infer<typeof AuditConfig>;
export type AuditConfigInput = z.input<typeof AuditConfig>;

/** Apply mode-specific defaults before schema defaults. */
export function resolveConfig(input: AuditConfigInput): AuditConfig {
  const mode = input.mode ?? "smart";
  const modeDefaults: Partial<AuditConfigInput> =
    mode === "quick" ? { maxUrls: 1, maxDepth: 0 } : mode === "deep" ? { sampleSize: 500 } : {};
  return AuditConfig.parse({ ...modeDefaults, ...input });
}

export const AuditStatus = z.enum([
  "queued",
  "running",
  "completed",
  "completed_partial",
  "failed",
  "cancelling",
  "cancelled_partial",
]);
export type AuditStatus = z.infer<typeof AuditStatus>;

/** Discovery ledger states (CR-12, RP-01). Mutually exclusive terminal states. */
export const UrlState = z.enum([
  "discovered",
  "queued",
  "attempted",
  "checked",
  "blocked_robots",
  "skipped",
  "failed",
]);
export type UrlState = z.infer<typeof UrlState>;
