# Roadmap

Status as of 2026-10-17. "Implemented" means it exists in this repository with tests. Everything else is a plan, not a promise. Suggestions are welcome via [feature requests](.github/ISSUE_TEMPLATE/feature_request.yml).

## ✅ Implemented in v0.1.0

- **Discovery:** robots.txt (RFC 9309), sitemaps (index and gzip, with caps), link-first frontier, coverage ledger, parameter-trap and depth guards, resumable checkpoints
- **Audit modes:** Quick, Smart (stratified browser sample by inferred template) and Deep
- **Modules:** M01 Technical SEO · M02 Performance (Lighthouse lab) · M03 Accessibility (axe-core) · M04 GA4/GTM · M05 Ad pixels · M06 Lead forms · M07 CRO/UX · M08 Consent · M09 Content · M10 Architecture
- **Prioritisation:** template-level grouping and a transparent priority index. Deterministic executive summary and backlog with effort estimates
- **Interfaces:** web UI (live crawl, issues, evidence, pages, categories, recommendations, compare), CLI, GitHub Action with CI budgets
- **Exports:** HTML, JSON, CSV, Markdown
- **Safety:** SSRF protection at connect time, guard proxy for the browser, sandboxed Chromium, redaction, local-instance CSRF/DNS-rebinding guard
- **Optional AI:** executive summary, 30-day roadmap, Q&A (Anthropic or OpenAI-compatible, including local models)
- **Delivery:** Docker image definition, read-only demo mode

## ✅ Released: v0.1.0 (2026-10-16)

- [x] First CI run on GitHub: lint, tests, e2e, Docker smoke test, Action self-test
- [x] Docker image published to GHCR (linux/amd64, linux/arm64)
- [x] Tag `v0.1.0` and GitHub release notes

## 🔜 Planned (v0.2, guided by feedback)

- [ ] Community rule-accuracy review (SEO, accessibility, analytics, consent)
- [ ] Documentation links on every rule (today only axe rules carry one)
- [ ] Record `not_tested` for site-level rules that produce no result
- [ ] Show the "automated checks only" caveat next to accessibility pass counts
- [ ] Stricter CI mode for partial audits
- [ ] Report "finished" timestamp in exported reports (currently empty; see good first issues)

## 🗺️ Later (ideas, not commitments)

- [ ] Scale mode: Postgres database and queue, S3-compatible artifact storage (interfaces exist)
- [ ] Scheduled audits and trend view across many audits
- [ ] More tag signatures (CMPs, analytics and ad platforms) contributed by practitioners
- [ ] Recording AI token usage for spend tracking

## ⛔ Out of scope by design

- Logging in, filling or submitting forms, checkout flows
- Backlink, keyword-ranking or traffic data
- Legal compliance certification (privacy, accessibility)
- Bypassing robots.txt, CAPTCHAs or bot protection
