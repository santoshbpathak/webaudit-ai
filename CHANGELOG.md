# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). Before 1.0, minor versions may include breaking changes, which will always be called out.

## [Unreleased]

## [0.1.0] — 2026-10-16

First public release.

### Added

- Quick, Smart and Deep audits, with robots.txt and sitemap discovery, a link-graph-first frontier and a full coverage ledger.
- Ten rule modules: technical SEO, Lighthouse performance, axe-core accessibility, GA4/GTM, ad pixels, lead forms, CRO/UX, consent, content and architecture (72 documented rules plus dynamic axe rules).
- Template-level issue grouping with a transparent priority index; scope-aware audit comparison.
- Web UI (live crawl, issue explorer, evidence, page inspector, category reports, recommendations, compare), a CLI and a GitHub Action with CI budgets.
- HTML, JSON, CSV and Markdown exports.
- Optional AI (Claude or OpenAI-compatible, including local models) for an executive summary, a 30-day roadmap and Q&A, with a transmission preview, citation validation and a per-audit call cap.
- Docker image with an access-token gate, and a read-only demo mode.
- Documentation for marketers (`docs/marketing/`), contributor guides, issue templates and a roadmap.

### Security

- SSRF protection with connect-time DNS validation, and a guard proxy for Chromium and Lighthouse; redaction of sensitive parameters.
- DNS-rebinding and CSRF guard for local instances; security headers.
- Chromium sandbox on by default, with a secret-free browser environment; WebRTC confinement; hard per-page watchdog.
- ReDoS-safe path globs; CI budgets fail when the relevant checks did not run.

See [docs/security.md](docs/security.md).

[Unreleased]: https://github.com/santoshbpathak/webaudit-ai/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/santoshbpathak/webaudit-ai/releases/tag/v0.1.0
