import type { AuditModule, PageContext, RuleResult } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { check, naAll, notHtmlReason, repro, rules } from "./helpers";

const R = rules([
  {
    id: "M07-NO-CTA-ABOVE-FOLD",
    module: "M07",
    title: "No call-to-action visible above the fold",
    severity: "medium",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "If visitors cannot see what to do next without scrolling, many leave — especially paid traffic landing on mobile.",
    remediation: "Test placing the primary CTA (e.g. 'Get a quote') within the first screen on mobile.",
    caveat:
      "CTAs are detected by text/class heuristics; a testable hypothesis, not a proven conversion problem.",
    applicability: "Pages that received browser checks",
  },
  {
    id: "M07-TOO-MANY-CTAS",
    module: "M07",
    title: "Many competing CTAs above the fold",
    severity: "low",
    confidence: "heuristic",
    layer: "browser",
    rationale: "Too many equally weighted actions dilute focus (choice overload).",
    remediation: "Prioritise one primary action; demote the rest. Found {count}: {ctas}.",
    caveat: "Hypothesis for testing.",
    applicability: "Pages that received browser checks",
  },
  {
    id: "M07-HORIZONTAL-OVERFLOW",
    module: "M07",
    title: "Page scrolls horizontally on the tested viewport",
    severity: "high",
    confidence: "verified",
    layer: "browser",
    rationale: "Sideways scrolling on mobile feels broken and hides content and CTAs.",
    remediation:
      "Constrain the widest element (tables, images, embeds) with max-width:100% or responsive wrappers. Content width {documentWidth}px vs viewport {viewportWidth}px.",
    applicability: "Pages that received browser checks",
  },
  {
    id: "M07-SMALL-TAP-TARGETS",
    module: "M07",
    title: "Tap targets smaller than 24×24 px",
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale: "Small links and buttons cause mis-taps on mobile (WCAG 2.2 SC 2.5.8 target size minimum).",
    remediation: "Increase size or spacing of: {targets}.",
    applicability: "Pages that received browser checks",
  },
]);

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
  const b = ctx.browser;
  const above = b.ctas.filter((c) => c.aboveFold);
  const distinct = [...new Set(above.map((c) => c.text.toLowerCase()))];
  const overflow = b.documentWidth - b.viewport.width;
  const shot = b.screenshotRef;
  return [
    check(above.length === 0, "M07-NO-CTA-ABOVE-FOLD", url, {
      screenshotRef: shot,
      observed: { ctasBelowFold: b.ctas.slice(0, 5).map((c) => c.text) },
      reproSteps: [
        `Open ${url} on a ${b.viewport.width}×${b.viewport.height} viewport`,
        "Look for a primary action without scrolling",
      ],
    }),
    check(distinct.length > 6, "M07-TOO-MANY-CTAS", url, {
      screenshotRef: shot,
      observed: { count: distinct.length, ctas: distinct.slice(0, 8).join(", ") },
      reproSteps: [`Open ${url}`, "Count the calls-to-action visible on the first screen"],
    }),
    check(overflow > 5, "M07-HORIZONTAL-OVERFLOW", url, {
      screenshotRef: shot,
      observed: { documentWidth: b.documentWidth, viewportWidth: b.viewport.width },
      reproSteps: [
        `Open ${url} in DevTools device mode at ${b.viewport.width}px wide`,
        "Try to scroll sideways",
      ],
    }),
    check(b.smallTapTargets.length > 0, "M07-SMALL-TAP-TARGETS", url, {
      selector: b.smallTapTargets
        .slice(0, 3)
        .map((t) => t.selector)
        .join(", "),
      observed: {
        count: b.smallTapTargets.length,
        targets: b.smallTapTargets
          .slice(0, 5)
          .map((t) => `${t.selector} (${t.width}×${t.height})`)
          .join(", "),
      },
      reproSteps: repro.inspect(url, b.smallTapTargets[0]?.selector ?? "a"),
    }),
  ];
}

export const m07Cro: AuditModule = {
  id: "M07",
  name: "CRO / UX",
  version: "1.0.0",
  rules: R,
  runPage,
  explain: explainFrom(R),
};
