import { SEVERITY_ORDER, type Severity } from "@webaudit/core";
import type { ReportData } from "./model";

/**
 * Quality budgets for CI (GitHub Action / CLI --budget). Syntax: `<metric><op><number>`,
 * e.g. `lh-performance>=80`, `issues-high<=0`, `rule:M01-TITLE-MISSING==0`, `ga4-missing-pages==0`.
 */
export interface BudgetResult {
  expression: string;
  metric: string;
  actual: number | null;
  passed: boolean;
  note?: string;
}

const OPS: Record<string, (a: number, b: number) => boolean> = {
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
  "==": (a, b) => a === b,
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
};

export const BUDGET_METRICS = [
  "lh-performance",
  "issues-critical",
  "issues-high",
  "issues-medium",
  "issues-low",
  "issues-total",
  "a11y-groups",
  "a11y-serious",
  "ga4-missing-pages",
  "broken-link-pages",
  "consent-issue-pages",
  "rule:<RULE-ID>",
];

function metricValue(d: ReportData, metric: string): { value: number | null; note?: string } {
  const sev = (s: Severity) => d.groups.filter((g) => g.severity === s).length;
  const pagesFor = (ruleId: string) =>
    d.groups.filter((g) => g.ruleId === ruleId).reduce((a, g) => a + g.affectedPages, 0);
  // Zero issues only counts when the relevant checks actually evaluated something; a module
  // that never ran (browser crash, partial audit, module disabled) must not pass a budget.
  const tested = (prefix: string) =>
    d.ruleCoverage.filter((r) => r.ruleId.startsWith(prefix)).reduce((a, r) => a + r.tested, 0);
  const guard = (prefix: string, label: string, value: () => number) =>
    tested(prefix) > 0
      ? { value: value() }
      : { value: null, note: `No ${label ? `${label} ` : ""}checks were evaluated` };
  switch (metric) {
    case "lh-performance":
      return d.lighthouse.medianScore === null
        ? { value: null, note: "Lighthouse did not produce a score" }
        : { value: d.lighthouse.medianScore };
    case "issues-critical":
    case "issues-high":
    case "issues-medium":
    case "issues-low":
      return guard("", "", () => sev(metric.slice(7) as Severity));
    case "issues-total":
      return guard("", "", () => d.groups.length);
    case "a11y-groups":
      return guard("M03-", "accessibility", () => d.groups.filter((g) => g.module === "M03").length);
    case "a11y-serious":
      return guard(
        "M03-",
        "accessibility",
        () =>
          d.groups.filter((g) => g.module === "M03" && SEVERITY_ORDER[g.severity] <= SEVERITY_ORDER.high)
            .length,
      );
    case "ga4-missing-pages":
      return guard("M04-GA4-NOT-OBSERVED", "GA4", () => pagesFor("M04-GA4-NOT-OBSERVED"));
    case "broken-link-pages":
      return guard("M01-BROKEN-INTERNAL-LINK", "internal-link", () => pagesFor("M01-BROKEN-INTERNAL-LINK"));
    case "consent-issue-pages":
      return guard("M08-", "consent", () =>
        d.groups.filter((g) => g.module === "M08").reduce((a, g) => a + g.affectedPages, 0),
      );
    default:
      if (metric.startsWith("rule:")) {
        const id = metric.slice(5).toUpperCase();
        const cov = d.ruleCoverage.find((r) => r.ruleId === id);
        if (!cov || cov.tested === 0) return { value: null, note: `${id} was not tested in this audit` };
        return { value: pagesFor(id) };
      }
      return { value: null, note: `Unknown metric. Known: ${BUDGET_METRICS.join(", ")}` };
  }
}

export function evaluateBudgets(d: ReportData, expressions: string[]): BudgetResult[] {
  return expressions.map((raw) => {
    const expression = raw.trim();
    const m = /^([a-z0-9:_-]+)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)$/i.exec(expression);
    if (!m)
      return {
        expression,
        metric: expression,
        actual: null,
        passed: false,
        note: "Invalid budget syntax (use metric<op>number)",
      };
    const [, metric, op, num] = m as unknown as [string, string, string, string];
    const { value, note } = metricValue(
      d,
      metric.toLowerCase().startsWith("rule:") ? metric : metric.toLowerCase(),
    );
    // A metric that could not be measured fails the budget: absence of evidence is not a pass.
    if (value === null) return { expression, metric, actual: null, passed: false, note };
    return { expression, metric, actual: value, passed: OPS[op]!(value, Number(num)), note };
  });
}

/** --fail-on <severity>: any issue group at or above that severity fails. */
export function failOnSeverity(
  d: ReportData,
  threshold: Severity,
): { failed: boolean; count: number; note?: string } {
  const count = d.groups.filter((g) => SEVERITY_ORDER[g.severity] <= SEVERITY_ORDER[threshold]).length;
  // An audit in which no check was evaluated has no evidence of being clean.
  if (!d.ruleCoverage.some((r) => r.tested > 0))
    return { failed: true, count, note: "No checks were evaluated" };
  return { failed: count > 0, count };
}
