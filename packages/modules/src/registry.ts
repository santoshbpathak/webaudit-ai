import type {
  AuditModule,
  Finding,
  ModuleId,
  PageContext,
  RuleDefinition,
  RuleResult,
  SiteContext,
} from "@webaudit/core";
import { ENGINE_VERSION, Evidence, newId, renderTemplate } from "@webaudit/core";
import { m01Seo } from "./m01-seo";
import { m02Performance } from "./m02-performance";
import { axeRuleDefinition, m03Accessibility } from "./m03-accessibility";
import { m04Analytics } from "./m04-analytics";
import { m05Pixels } from "./m05-pixels";
import { m06Forms } from "./m06-forms";
import { m07Cro } from "./m07-cro";
import { m08Consent } from "./m08-consent";
import { m09Content } from "./m09-content";
import { m10Architecture } from "./m10-architecture";

export const ALL_MODULES: AuditModule[] = [
  m01Seo,
  m02Performance,
  m03Accessibility,
  m04Analytics,
  m05Pixels,
  m06Forms,
  m07Cro,
  m08Consent,
  m09Content,
  m10Architecture,
];

const RULES = new Map<string, RuleDefinition>(
  ALL_MODULES.flatMap((m) => m.rules.map((r) => [r.id, r] as const)),
);

/** Rule metadata by id. Dynamic axe rules (M03-AXE-*) resolve to a generated definition. */
export function getRule(ruleId: string): RuleDefinition | undefined {
  const r = RULES.get(ruleId);
  if (r) return r;
  if (ruleId.startsWith("M03-AXE-")) return axeRuleDefinition(ruleId.slice(8).toLowerCase());
  return undefined;
}

export function allRules(): RuleDefinition[] {
  return [...RULES.values()];
}

export function selectModules(ids: ModuleId[]): AuditModule[] {
  return ALL_MODULES.filter((m) => ids.includes(m.id));
}

export interface EvaluateOptions {
  auditId: string;
  disabledRules?: string[];
  now?: () => string;
}

/** Turn a module's RuleResult into a stored Finding (AU-01). */
export function toFinding(r: RuleResult, opts: EvaluateOptions, engineVersion: string): Finding {
  const rule = getRule(r.ruleId);
  if (!rule) throw new Error(`Unknown rule ${r.ruleId}`);
  const evidence = Evidence.parse({ reproSteps: [], ...(r.evidence ?? {}) });
  const observed = { url: r.url, ...(evidence.observed ?? {}) } as Record<string, unknown>;
  return {
    findingId: newId("fnd"),
    ruleId: r.ruleId,
    auditId: opts.auditId,
    url: r.url,
    module: rule.module,
    status: r.status,
    severity: r.severity ?? rule.severity,
    confidence: rule.confidence,
    observedAt: opts.now?.() ?? new Date().toISOString(),
    engineVersion,
    evidence,
    recommendedAction: r.recommendedAction ?? renderTemplate(rule.remediation, observed),
    applicability: rule.applicability,
    reason: r.reason,
  };
}

const moduleVersion = (m: AuditModule) => `webaudit@${ENGINE_VERSION}/${m.id}@${m.version}`;

async function safeRun(
  m: AuditModule,
  fn: () => RuleResult[] | Promise<RuleResult[]>,
): Promise<{ results: RuleResult[]; error?: string }> {
  try {
    return { results: await fn() };
  } catch (e) {
    return { results: [], error: (e as Error).message };
  }
}

/**
 * Run per-page checks for the selected modules. A module that throws yields
 * `inconclusive` for its rules on this page rather than aborting the audit.
 * Browser-layer rules on pages without browser data become `not_tested`, so every
 * rule has an exact, honest denominator (T07).
 */
export async function evaluatePage(
  ctx: PageContext,
  modules: AuditModule[],
  opts: EvaluateOptions,
): Promise<Finding[]> {
  const disabled = new Set(opts.disabledRules ?? []);
  const findings: Finding[] = [];
  for (const m of modules) {
    if (!m.runPage) continue;
    const pageRules = m.rules.filter((r) => r.layer !== "site" && !disabled.has(r.id));
    const { results, error } = await safeRun(m, () => m.runPage!(ctx));
    const got = new Set<string>();
    for (const r of results) {
      if (disabled.has(r.ruleId)) continue;
      got.add(r.ruleId);
      findings.push(toFinding(r, opts, moduleVersion(m)));
    }
    for (const rule of pageRules) {
      if (got.has(rule.id)) continue;
      const browserFailed = rule.layer === "browser" && !ctx.browser && !!ctx.browserError;
      const status: RuleResult["status"] = error || browserFailed ? "inconclusive" : "not_tested";
      const reason = error
        ? `Module error: ${error}`
        : browserFailed
          ? `Browser check failed: ${ctx.browserError}`
          : rule.layer === "browser" && !ctx.browser
            ? "Not in the browser-check sample"
            : rule.layer === "browser"
              ? "Engine did not run for this page"
              : "No result produced";
      findings.push(toFinding({ ruleId: rule.id, url: ctx.url, status, reason }, opts, moduleVersion(m)));
    }
  }
  return findings;
}

export async function evaluateSite(
  site: SiteContext,
  modules: AuditModule[],
  opts: EvaluateOptions,
): Promise<Finding[]> {
  const disabled = new Set(opts.disabledRules ?? []);
  const findings: Finding[] = [];
  for (const m of modules) {
    if (!m.runSite) continue;
    const { results, error } = await safeRun(m, () => m.runSite!(site));
    if (error) {
      for (const rule of m.rules.filter((r) => r.layer === "site")) {
        findings.push(
          toFinding(
            { ruleId: rule.id, url: site.startUrl, status: "inconclusive", reason: `Module error: ${error}` },
            opts,
            moduleVersion(m),
          ),
        );
      }
      continue;
    }
    for (const r of results) if (!disabled.has(r.ruleId)) findings.push(toFinding(r, opts, moduleVersion(m)));
  }
  return findings;
}
