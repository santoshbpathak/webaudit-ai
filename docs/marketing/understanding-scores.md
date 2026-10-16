# Understanding scores (and why there is no "health score")

WebAudit AI deliberately has **no single website health score**. A score like "72/100" hides what was tested, mixes unrelated problems, and invites the wrong goal: raising the number instead of fixing what matters. Instead you get the numbers below. Each one says exactly what it measures.

## 1. Checks passed / checks evaluated (per category)

Example: **Accessibility — 182 / 240 checks passed**.

- **Evaluated** counts only checks that actually ran. Pages that weren't tested are excluded, not counted as passes.
- Use it to compare areas, or the same site over time with the same scope. It is not a percentage grade for the whole website.

## 2. Priority index (per issue group)

```
priority = severity weight × min(8, 1 + log2(affected pages)) × confidence × importance
```

| Factor     | Values                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------ |
| Severity   | critical 10 · high 6 · medium 3 · low 1                                                    |
| Pages      | log-scaled and capped at 8, so one huge template can't bury a critical single-page problem |
| Confidence | confirmed 1.0 · potential 0.7 · manual review 0.4                                          |
| Importance | normal 1 · start URL 1.25 · paths you mark as priority 1.5                                 |

It **orders the backlog**. It is not a measure of business impact. These weights are product decisions, documented so they can be challenged ([scoring details](../scoring.md)).

## 3. Lighthouse performance (lab)

The **Lighthouse lab score** (0–100) and lab metrics (LCP, CLS, TBT) come from Google Lighthouse running on sampled pages with simulated throttling.

- It is **lab data**: useful to find causes, and it varies between runs.
- It is **not** your real-user Core Web Vitals. Search Console and CrUX report those.
- WebAudit AI shows the median across tested pages.

## 4. Effort estimates

Recommendations show small / medium / large effort. These are **heuristic estimates** based on the type of fix and whether it is template-level. Use them for planning, not commitments.

## What to report upward

Report outcomes and evidence, not a score. For example: "Analytics is missing on 3 templates (16 of 25 tested pages)", or "Fixing the product template resolves 4 issue groups". See [Reporting to stakeholders](reporting-guide.md).
