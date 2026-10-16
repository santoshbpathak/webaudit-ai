import { describe, expect, it } from "vitest";
import { evaluateBudgets, failOnSeverity } from "./budgets";
import type { ReportData } from "./model";

const data = (tested: Record<string, number>, groups: Partial<ReportData["groups"][number]>[] = []) =>
  ({
    groups,
    ruleCoverage: Object.entries(tested).map(([ruleId, n]) => ({ ruleId, tested: n })),
    lighthouse: { medianScore: null },
  }) as unknown as ReportData;

describe("CI budgets never pass on missing evidence", () => {
  it("fails accessibility budgets when no accessibility check ran", () => {
    const [r] = evaluateBudgets(data({ "M01-TITLE-MISSING": 10 }), ["a11y-serious<=0"]);
    expect(r).toMatchObject({ passed: false, actual: null, note: "No accessibility checks were evaluated" });
  });

  it("passes when the checks ran and found nothing", () => {
    const [r] = evaluateBudgets(data({ "M03-AXE-LABEL": 5 }), ["a11y-serious<=0"]);
    expect(r).toMatchObject({ passed: true, actual: 0 });
  });

  it("fails issue-count budgets and --fail-on when nothing at all was evaluated", () => {
    const empty = data({ "M01-TITLE-MISSING": 0 });
    expect(evaluateBudgets(empty, ["issues-high<=0"])[0]).toMatchObject({ passed: false });
    expect(failOnSeverity(empty, "high")).toMatchObject({ failed: true, note: "No checks were evaluated" });
    expect(failOnSeverity(data({ "M01-TITLE-MISSING": 3 }), "high")).toMatchObject({ failed: false });
  });

  it("counts real failures", () => {
    const d = data({ "M03-AXE-LABEL": 5 }, [{ module: "M03", severity: "high", ruleId: "M03-AXE-LABEL" }]);
    expect(evaluateBudgets(d, ["a11y-serious<=0"])[0]).toMatchObject({ passed: false, actual: 1 });
    expect(failOnSeverity(d, "high")).toMatchObject({ failed: true, count: 1 });
  });
});
