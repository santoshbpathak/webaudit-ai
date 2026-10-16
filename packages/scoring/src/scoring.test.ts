import { describe, expect, it } from "vitest";
import type { Finding } from "@webaudit/core";
import {
  estimateEffort,
  genericAction,
  groupFindings,
  groupSignature,
  priorityIndex,
  ruleCoverageFrom,
} from "./index";

let n = 0;
const f = (ruleId: string, url: string, status: Finding["status"], over: Partial<Finding> = {}): Finding => ({
  findingId: `f${n++}`,
  ruleId,
  auditId: "a",
  url,
  module: ruleId.slice(0, 3) as Finding["module"],
  status,
  severity: "medium",
  confidence: "verified",
  observedAt: "",
  engineVersion: "",
  evidence: { reproSteps: [] },
  recommendedAction: "fix",
  applicability: "",
  ...over,
});

describe("grouping and priority", () => {
  it("groups the same rule across one template into a single issue", () => {
    const fs = Array.from({ length: 40 }, (_, i) =>
      f("M01-META-DESC-MISSING", `https://x.com/blog/post-${i}`, "fail"),
    );
    fs.push(f("M01-META-DESC-MISSING", "https://x.com/pricing", "fail"));
    const { groups } = groupFindings({ findings: fs, startUrl: "https://x.com/" });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ templateHint: "/blog/*", affectedPages: 40 });
  });

  it("signatures are stable across scans (no volatile ids)", () => {
    expect(groupSignature("M01-H1-MISSING", "https://x.com/blog/a")).toBe(
      groupSignature("M01-H1-MISSING", "https://x.com/blog/b"),
    );
    expect(groupSignature("M01-H1-MISSING", "https://x.com/blog/a")).not.toBe(
      groupSignature("M01-H1-MISSING", "https://x.com/shop/a"),
    );
  });

  it("log-scales page count and caps it so big templates do not always dominate", () => {
    const one = priorityIndex("critical", 1, "verified", 1);
    const huge = priorityIndex("low", 100_000, "verified", 1);
    expect(huge.pageFactor).toBe(8);
    expect(one.priority).toBeGreaterThan(huge.priority);
  });

  it("weights confidence and user priority paths", () => {
    const fs = [
      f("M08-TRACKING-BEFORE-CONSENT", "https://x.com/a", "fail", {
        confidence: "heuristic",
        severity: "high",
      }),
      f("M01-H1-MULTIPLE", "https://x.com/checkout-help", "fail", { severity: "high" }),
    ];
    const { groups } = groupFindings({
      findings: fs,
      startUrl: "https://x.com/",
      priorityPaths: ["/checkout-help"],
    });
    expect(groups[0]!.ruleId).toBe("M01-H1-MULTIPLE");
    expect(groups[0]!.priorityComponents.importanceFactor).toBe(1.5);
    expect(groups[1]!.priorityComponents.confidenceFactor).toBe(0.7);
  });

  it("counts tested pages from pass+fail only; never assumes unobserved pages fail", () => {
    const fs = [
      f("M07-HORIZONTAL-OVERFLOW", "https://x.com/p/1", "fail"),
      f("M07-HORIZONTAL-OVERFLOW", "https://x.com/p/2", "pass"),
      ...Array.from({ length: 100 }, (_, i) =>
        f("M07-HORIZONTAL-OVERFLOW", `https://x.com/p/${i + 3}`, "not_tested"),
      ),
    ];
    const { groups } = groupFindings({ findings: fs, startUrl: "https://x.com/" });
    expect(groups[0]).toMatchObject({ affectedPages: 1, testedPages: 2, enoughEvidence: false });
    const [cov] = ruleCoverageFrom(fs);
    expect(cov).toMatchObject({ tested: 2, failed: 1, notTested: 100 });
  });
});

describe("genericAction", () => {
  it("removes page-specific placeholder clauses", () => {
    expect(genericAction("Gate these tags on consent (e.g. GTM consent settings): {vendors}.")).toBe(
      "Gate these tags on consent (e.g. GTM consent settings).",
    );
    expect(
      genericAction('Rewrite the title to about 30–60 characters. Current ({length} chars): "{title}"'),
    ).toBe("Rewrite the title to about 30–60 characters.");
    expect(genericAction("Add a single <title> in the <head>.")).toBe("Add a single <title> in the <head>.");
    expect(genericAction("Increase size or spacing of: {targets}.")).toBe(
      "Increase size or spacing of the affected items.",
    );
  });
});

describe("estimateEffort", () => {
  it("scales content fixes with pages and keeps template fixes small", () => {
    expect(estimateEffort("M01-META-DESC-MISSING", 2).level).toBe("small");
    expect(estimateEffort("M01-META-DESC-MISSING", 120).level).toBe("large");
    expect(estimateEffort("M01-CANONICAL-MISSING", 80, 1).level).toBe("small");
    expect(estimateEffort("M02-LCP", 1).level).toBe("large");
    expect(estimateEffort("M04-GA4-NOT-OBSERVED", 10, 2)).toMatchObject({
      level: "small",
      basis: expect.stringMatching(/tag/i),
    });
  });
});
