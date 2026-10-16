import type {
  AuditModule,
  AxeResult,
  AxeViolation,
  PageContext,
  RuleDefinition,
  RuleResult,
  Severity,
} from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { fail, inconclusive, na, naAll, notHtmlReason, pass } from "./helpers";

const CAVEAT =
  "Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required.";

/** Marketing-relevant axe rules with tailored rationale. Others get a generic definition. */
const KNOWN: Record<string, { title: string; rationale: string }> = {
  "image-alt": {
    title: "Images without alternative text",
    rationale:
      "Screen-reader users miss the content of images (offers, product shots); search engines also use alt text.",
  },
  label: {
    title: "Form inputs without labels",
    rationale:
      "Unlabelled fields are unusable with assistive technology and cause errors for everyone — directly costing leads.",
  },
  "color-contrast": {
    title: "Insufficient text colour contrast",
    rationale: "Low-contrast text is hard to read for many visitors, especially on mobile in sunlight.",
  },
  "link-name": {
    title: "Links without discernible text",
    rationale: "Icon-only or empty links are announced as 'link' with no destination.",
  },
  "button-name": {
    title: "Buttons without accessible names",
    rationale: "Users cannot tell what the button does — including your CTAs.",
  },
  "html-has-lang": {
    title: "Page language not declared",
    rationale: "Screen readers may use the wrong pronunciation.",
  },
  "document-title": {
    title: "Page has no title",
    rationale: "Users of tabs and assistive technology cannot identify the page.",
  },
  "heading-order": {
    title: "Heading levels skipped",
    rationale: "Skipped levels break the outline that screen-reader users navigate by.",
  },
  "landmark-one-main": {
    title: "No main landmark",
    rationale: "Keyboard and screen-reader users cannot jump to the main content.",
  },
  region: {
    title: "Content outside landmarks",
    rationale: "Content outside landmarks is harder to navigate with assistive technology.",
  },
  "meta-viewport": {
    title: "Zoom disabled on mobile",
    rationale: "Blocking pinch-zoom prevents low-vision users from reading the page.",
  },
  "target-size": {
    title: "Touch targets too small",
    rationale: "Small targets cause mis-taps for users with motor impairments and on small screens.",
  },
};

const IMPACT_SEVERITY: Record<string, Severity> = {
  critical: "high",
  serious: "high",
  moderate: "medium",
  minor: "low",
};

export function axeRuleId(axeId: string): string {
  return `M03-AXE-${axeId.toUpperCase()}`;
}

export function axeRuleDefinition(axeId: string, help?: string, helpUrl?: string): RuleDefinition {
  const known = KNOWN[axeId];
  return {
    id: axeRuleId(axeId),
    module: "M03",
    title: known?.title ?? help ?? `axe rule ${axeId}`,
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale: known?.rationale ?? `${help ?? axeId}. Detected by axe-core.`,
    remediation: `Fix the affected elements as described in the axe-core guidance${helpUrl ? `: ${helpUrl}` : ""}.`,
    caveat: CAVEAT,
    applicability: "Pages that received browser checks",
  };
}

/** Static list for documentation; at runtime any axe rule id resolves via axeRuleDefinition. */
const R: RuleDefinition[] = Object.keys(KNOWN).map((id) => axeRuleDefinition(id));

function runPage(ctx: PageContext): RuleResult[] {
  const url = ctx.url;
  const reason = notHtmlReason(ctx);
  if (reason)
    return naAll(
      R.map((r) => r.id),
      url,
      reason,
    );
  if (!ctx.browser) return [];
  const axe = ctx.browser.axe;
  if (!axe) return [];
  if ("error" in axe) return R.map((r) => inconclusive(r.id, url, `axe-core failed: ${axe.error}`));
  const a: AxeResult = axe;
  const out: RuleResult[] = [];
  const seen = new Set<string>();
  for (const v of a.violations) {
    seen.add(v.id);
    out.push(
      fail(axeRuleId(v.id), url, violationEvidence(url, v, a.version), {
        severity: IMPACT_SEVERITY[v.impact ?? "moderate"] ?? "medium",
        recommendedAction: `${v.help}. Affected: ${v.nodes.length} element(s). Guidance: ${v.helpUrl}`,
      }),
    );
  }
  for (const id of a.passes) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(pass(axeRuleId(id), url));
  }
  for (const i of a.incomplete) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    out.push({
      ...inconclusive(axeRuleId(i.id), url, `Needs manual review: ${i.help}`),
      evidence: { reproSteps: [`Review manually: ${i.helpUrl}`] },
    });
  }
  for (const id of a.inapplicable) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(na(axeRuleId(id), url, "No matching elements"));
  }
  return out;
}

function violationEvidence(url: string, v: AxeViolation, version: string) {
  const first = v.nodes[0];
  return {
    selector: v.nodes
      .slice(0, 3)
      .map((n) => n.target)
      .join(", "),
    snippet: first?.html,
    observed: {
      axeRule: v.id,
      impact: v.impact,
      elements: v.nodes.length,
      wcag: v.tags.filter((t) => /^wcag/.test(t)).join(", "),
      axeVersion: version,
      summary: first?.failureSummary,
    },
    reproSteps: [
      `Open ${url}`,
      "Run axe DevTools (or Lighthouse accessibility)",
      `Look for rule "${v.id}" on: ${first?.target ?? "(see list)"}`,
    ],
  };
}

export const m03Accessibility: AuditModule = {
  id: "M03",
  name: "Accessibility",
  version: "1.0.0",
  rules: R,
  runPage,
  explain: explainFrom(R),
};
