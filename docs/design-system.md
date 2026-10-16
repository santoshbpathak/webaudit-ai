# Design system — "Midnight Intelligence"

Audience: marketers, SEO specialists and developers doing focused audit work on a desktop. The UI should read like a professional diagnostics tool: calm, dense, precise, and honest about what was and wasn't measured.

## Principles

1. **Evidence before opinion.** Every number links to the findings behind it. No universal "health score": category cards show _checks passed / checks evaluated_ with the denominator visible.
2. **Confidence is always visible.** Three tiers, each with its own icon and label, everywhere a finding appears: **Confirmed** (verified observation), **Potential** (heuristic), **Manual review**.
3. **Coverage is a first-class citizen.** Sampled vs. full-site, not-tested and partial results are stated next to the data they qualify.
4. **Restraint.** No gradients, glass, decorative AI imagery or motion beyond 150–200 ms state transitions. Accent colour is reserved for interaction and focus.
5. **Every control works.** Unsupported actions (e.g. pause — the engine supports cancel only) are not rendered.

## Tokens

| Token                                      | Dark (default)                                                                          | Light                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------- |
| `bg`                                       | `#0a0f1c`                                                                               | `#f7f8fa`                         |
| `surface`                                  | `#0f1626`                                                                               | `#ffffff`                         |
| `surface-2` (hover, inset)                 | `#151e31`                                                                               | `#f1f4f8`                         |
| `line`                                     | `#1f2a40`                                                                               | `#e3e8ef`                         |
| `ink` / `ink-2` / `muted`                  | `#e6ebf3` / `#b8c2d3` / `#8d9ab3`                                                       | `#0e1726` / `#3b4759` / `#566275` |
| `accent` (teal)                            | `#2dd4bf`                                                                               | `#0f766e`                         |
| `ok` (emerald)                             | `#34d399`                                                                               | `#03644a`                         |
| Severity (fixed status scale, both themes) | critical `#d03b3b` · high `#ec835a` · medium `#fab219` · low `#4c8df6` · info `#8a94a6` | same                              |

Typography: Inter (UI) and JetBrains Mono (URLs, rule ids, numbers in code contexts), with tabular numerals for all figures. Scale: 12 / 13 (table) / 14 (body) / 16 / 20 / 24. Radius 6 px (controls) / 10 px (cards). Spacing on a 4 px grid; dense tables use 8 px row padding.

Severity is a status scale, not a categorical palette: it fails colour-blind separation as hues alone, so it is **always** paired with a distinct icon and a text label (OctagonAlert / TriangleAlert / CircleAlert / Info / CircleDot), and charts use 2 px gaps plus a labelled legend. Contrast of every token on its surfaces is enforced by the axe scan in `apps/web/e2e/demo.spec.ts` for both themes.

## Components (`apps/web/src/components/ui/`)

shadcn/ui conventions (copy-in source, `cn()` + `class-variance-authority`, Radix primitives for behaviour): Button, Badge, Card, Input, Select, Checkbox, Tabs, Sheet (evidence side panel), DropdownMenu, Tooltip, Table, Skeleton, Progress, EmptyState, Kbd. Domain components (`components/audit/`): SeverityBadge, ConfidenceBadge, StatusBadge, SeverityBar, CoverageFunnel, Meter, EvidenceBlock, LiveCrawl, IssueExplorer, UrlExplorer, RecommendationsTable, HistoryTable, AiPanel.

## Information architecture

```
App shell (sidebar + top bar)
├── New audit                 /                       Welcome: URL, mode, limits, device, advanced crawler controls
├── Audits & history          /history                All audits, select two of the same site → compare
│   └── Compare               /compare?base&head
└── Audit workspace           /audits/[id]/…          (left sub-navigation)
    ├── Overview              (live crawl view while running)
    ├── Issues                Issue explorer: search, filters, sort, evidence sheet
    │   └── Issue detail      /issues/[signature]
    ├── Pages                 URL explorer (Screaming Frog-style)
    │   └── Page inspector    /pages/inspect?url=
    ├── Categories            /categories/[module]  SEO · Performance · Accessibility · Analytics · Ad pixels · Forms · UX · Privacy · Content · Architecture
    ├── Recommendations       Prioritised backlog with estimated effort + optional AI suggestions
    └── Export                HTML / JSON / CSV / Markdown, report preview
```

Filters live in the URL query string so views are shareable and the back button works.

## States

Every data view has: loading (skeletons via `loading.tsx`), empty (explains why and what to do), error (`error.tsx` with retry), and partial (banner stating what is missing: cancelled, deadline, browser failures, not-in-sample).
