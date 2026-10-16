import type { Evidence, PageContext, RuleDefinition, RuleResult, Severity } from "@webaudit/core";

export function rules(defs: RuleDefinition[]): RuleDefinition[] {
  const ids = new Set<string>();
  for (const d of defs) {
    if (ids.has(d.id)) throw new Error(`Duplicate rule id ${d.id}`);
    ids.add(d.id);
  }
  return defs;
}

export const pass = (ruleId: string, url: string, evidence?: Partial<Evidence>): RuleResult => ({
  ruleId,
  url,
  status: "pass",
  evidence,
});

export const fail = (
  ruleId: string,
  url: string,
  evidence: Partial<Evidence>,
  extra: { severity?: Severity; recommendedAction?: string } = {},
): RuleResult => ({ ruleId, url, status: "fail", evidence, ...extra });

export const na = (ruleId: string, url: string, reason: string): RuleResult => ({
  ruleId,
  url,
  status: "not_applicable",
  reason,
});

export const notTested = (ruleId: string, url: string, reason: string): RuleResult => ({
  ruleId,
  url,
  status: "not_tested",
  reason,
});

export const inconclusive = (ruleId: string, url: string, reason: string): RuleResult => ({
  ruleId,
  url,
  status: "inconclusive",
  reason,
});

/** pass/fail helper: `check(cond, ...)` fails when cond is true. */
export function check(
  failing: boolean,
  ruleId: string,
  url: string,
  evidence: Partial<Evidence>,
  extra?: { severity?: Severity; recommendedAction?: string },
): RuleResult {
  return failing ? fail(ruleId, url, evidence, extra) : pass(ruleId, url);
}

/** Why a page is not an auditable HTML document, or null if it is. */
export function notHtmlReason(ctx: PageContext): string | null {
  if (ctx.http.redirectChain.length && ctx.http.url !== ctx.http.finalUrl) return "URL redirects";
  if (ctx.http.status >= 400) return `HTTP ${ctx.http.status}`;
  if (!/html/i.test(ctx.http.contentType)) return `Not HTML (${ctx.http.contentType || "unknown type"})`;
  if (!ctx.parsed) return "No parsed HTML";
  return null;
}

/** Return N/A results for every rule id when the page is not auditable HTML. */
export function naAll(ids: string[], url: string, reason: string): RuleResult[] {
  return ids.map((id) => na(id, url, reason));
}

export function truncate(s: string | undefined, n = 160): string | undefined {
  if (s === undefined) return undefined;
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export const repro = {
  viewSource: (url: string, what: string) => [
    `Open ${url}`,
    `View page source (Ctrl/Cmd+U)`,
    `Look for ${what}`,
  ],
  devtoolsNetwork: (url: string, filter: string) => [
    `Open ${url} in a fresh private window (no prior consent)`,
    `Open DevTools → Network, filter by "${filter}"`,
    `Reload the page without interacting with any banner`,
  ],
  inspect: (url: string, selector: string) => [
    `Open ${url}`,
    `In DevTools → Elements, search for: ${selector}`,
  ],
};
