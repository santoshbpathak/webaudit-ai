# Scoring and prioritisation

WebAudit AI does **not** compute a site-wide "quality %". It ranks fixable issue groups.

## Issue groups

Failures are grouped by **rule + generalised path pattern** — `/blog/first-post` and `/blog/second-post` share `/blog/*`; numeric segments become `:n`. The pattern is an _inferred_ template and is labelled as such. The group signature is a hash of rule and pattern, so the same issue keeps the same id across audits; that is what makes comparisons possible.

## Priority index

```
priority = severity weight × page factor × confidence factor × importance factor
```

| Component         | Values                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Severity weight   | critical 10 · high 6 · medium 3 · low 1 · info 0.25 (the worst instance in the group)      |
| Page factor       | `min(8, 1 + log2(affected pages))`                                                         |
| Confidence factor | verified 1.0 · heuristic 0.7 · manual review 0.4                                           |
| Importance factor | 1 by default · 1.25 if the start URL is affected · 1.5 if a user priority path is affected |

The cap of 8 is deliberate: at equal confidence and page importance, one critical issue on a single page (10) still outranks any low-severity issue regardless of how many pages share it (max 8). Confidence and importance factors can change that order (for example, a heuristic critical issue scores 7). These weights are product decisions, documented here so they can be challenged — not an industry standard.

## Denominators and evidence

Every finding row records an explicit status (`pass`, `fail`, `not_applicable`, `not_tested`, `inconclusive`). "Affected / tested" in the UI counts only pages where the rule was actually evaluated. Browser-based rules on pages outside the sample are `not_tested`, never assumed to pass or fail. A browser-rule group with fewer than 3 tested pages is marked **not enough evidence**.

## Comparisons

`diffAudits` reports new, resolved, persisting and **not re-tested** groups. A group only counts as resolved if its rule was evaluated again on the affected pages. Differences in mode, URL cap, modules, device, checked-URL count or sample size are listed as scope notes rather than presented as regressions or fixes.
