# Candidate first issues

Each item was verified against the code on 2026-10-16. They are drafts for the maintainer to open as GitHub issues after publication, using the suggested labels.

---

### 1. Exported report shows an empty "finished" time

**Labels:** `good first issue` · `bug`

**Verified:** `examples/fernhill/report.json` has `"finishedAt": null` for a completed audit, and the HTML header shows `finished —`. Reports are generated before `finishedAt` is written: `packages/pipeline/src/run.ts` sets `finishedAt` in the final `updateAudit` (around line 491), after report generation.

**Task:** set the finish time before generating reports, or pass it to the report builder. Add a test asserting `finishedAt` is set in `report.json`, then regenerate the examples (`pnpm examples`).

### 2. Set `metadataBase` to silence the Next.js build warning

**Labels:** `good first issue` · `enhancement`

**Verified:** `next build` and `next start` log _"metadataBase property in metadata export is not set for resolving social open graph or twitter images"_.

**Task:** set `metadataBase` in `apps/web/src/app/layout.tsx` from an env var, defaulting to `http://127.0.0.1:3000`, and document the variable in `.env.example`.

### 3. `docker compose --profile demo up demo` requires an access token

**Labels:** `good first issue` · `documentation` · `bug`

**Verified:** `docker/compose.yaml` uses `${WEBAUDIT_ACCESS_TOKEN:?…}` on the main service, and Compose interpolates the whole file even when only the demo service is started.

**Task:** restructure the compose file (for example, a separate demo compose file), or document the workaround in `docs/deploy.md`.

### 4. Record `not_tested` for site-level rules that produce no result

**Labels:** `audit-accuracy` · `help wanted`

**Verified:** `packages/modules/src/registry.ts` backfills `not_tested` for page rules, but `evaluateSite` doesn't do the same for site rules.

**Task:** mirror the page-rule backfill logic and add a unit test.

### 5. Add unit tests for the deterministic executive summary

**Labels:** `good first issue` · `enhancement`

**Verified:** `packages/report/src/summary.ts` has no direct tests.

**Task:** cover three cases (no issues with nothing checked, no issues with pages checked, mixed severities), plus the "indicator, not a legal determination" wording.

### 6. Add tests for Lighthouse-error and axe-incomplete mapping

**Labels:** `good first issue` · `performance` · `accessibility`

**Verified:** `m02-performance.ts` maps a Lighthouse error to `inconclusive`, and `m03-accessibility.ts` maps axe "incomplete" to `inconclusive`. Neither mapping has a dedicated unit test.

**Task:** add tests with synthetic snapshot objects (no browser needed).

### 7. Add documentation links to rule definitions

**Labels:** `documentation` · `seo` · `analytics` · `help wanted`

**Verified:** `RuleDefinition` (`packages/core/src/rule.ts`) has no docs URL field. Only axe findings carry a `helpUrl`.

**Task:** add an optional `docsUrl`, fill it for a handful of M01 rules with authoritative sources (search-engine developer docs), and show it in the evidence panel and in `docs/rules.md`.

### 8. Show the "automated checks only" caveat next to accessibility pass counts

**Labels:** `accessibility` · `enhancement`

**Verified:** category coverage rows show axe pass counts, but the "not WCAG conformance" caveat appears only in rule details.

**Task:** add the caveat to the M03 category view in `apps/web`.

### 9. Escape backticks from crawled paths in the Markdown job summary

**Labels:** `good first issue` · `bug`

**Verified:** `packages/report/src/markdown.ts` puts `templateHint`, derived from crawled URLs, inside backticks without escaping.

**Task:** escape or strip backticks, and add a test.

### 10. Filter sitemap-index children by scope

**Labels:** `help wanted` · `seo`

**Verified:** `packages/crawler/src/sitemap.ts` queues every child sitemap of an index without a scope check. They are still SSRF-guarded.

**Task:** apply the same `accept` filter used for URLs, and add a test with an off-site child sitemap.
