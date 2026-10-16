# Contributing to WebAudit AI

Thanks for helping make website audits more trustworthy. You don't need to write code to contribute. Rule reviews from SEO, accessibility, analytics and privacy practitioners are just as valuable.

## Ways to contribute

| You are                                 | Good first contributions                                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketer / SEO / MarTech specialist** | Review a rule's accuracy or wording ([audit accuracy issue](.github/ISSUE_TEMPLATE/audit_accuracy_issue.yml)), improve a [marketing guide](docs/marketing/), suggest a check you do by hand today |
| **Accessibility practitioner**          | Improve explanations; document what automated checks miss                                                                                                                                         |
| **Developer**                           | Pick a [good first issue](docs/development/good-first-issues.md); add a synthetic fixture or test; improve error messages, exports or UI                                                          |

> **Privacy first.** Never paste private, client or internal website data, credentials, cookies or unpublished URLs into issues or pull requests. Use a public page, or reproduce the problem with a minimal HTML snippet or the bundled fixture site.

## Developer setup (about 10 minutes)

Requirements: Node.js ≥ 22.19, pnpm 9 (`corepack enable`).

```bash
git clone https://github.com/santoshbpathak/webaudit-ai.git && cd webaudit-ai
pnpm install --frozen-lockfile
pnpm --filter @webaudit/browser exec playwright install chromium
pnpm webaudit doctor          # verifies Node, data dir, SQLite, Chromium
```

**Run it:**

```bash
pnpm fixture                                          # synthetic test site on 127.0.0.1:4100
WEBAUDIT_ALLOW_PRIVATE_HOSTS=127.0.0.1 pnpm dev        # UI + worker on http://127.0.0.1:3000
```

Then audit `http://127.0.0.1:4100/` from the UI. Or use the CLI: `pnpm webaudit --allow-private-host 127.0.0.1 audit http://127.0.0.1:4100/`.

**Test it:**

```bash
pnpm check                    # lint + typecheck + unit/integration tests (Vitest)
pnpm e2e                      # builds the web app, runs Playwright e2e incl. axe in both themes
pnpm format:check
```

Troubleshooting: [docs/development/installation.md](docs/development/installation.md).

## Architecture in two minutes

```
apps/web        Next.js UI + API routes      apps/cli     CLI + worker (`webaudit worker`)
packages/safety SSRF guard, proxy, redaction  packages/crawler   discovery + coverage ledger
packages/browser Chromium sessions           packages/engines   Lighthouse (child process)
packages/modules M01–M10 rules               packages/scoring   grouping + priority
packages/report  HTML/JSON/CSV/MD            packages/ai        optional AI (3 tasks)
fixtures/site    synthetic site with planted defects + expected findings
```

More in [docs/architecture.md](docs/architecture.md) and the [ADRs](docs/adr).

## Adding or changing a rule

1. Define the rule and its logic in `packages/modules/src/mXX-*.ts`. Return an explicit status for every page (`pass`, `fail`, `not_applicable`, `not_tested`, `inconclusive`). Never skip silently.
2. Choose confidence honestly:
   - `verified` only when directly observed
   - `heuristic` for inferences
   - `manual_review` when human judgement is required

   Add a `caveat` for anything heuristic.

3. Use cautious language. Privacy and accessibility rules are indicators, never compliance verdicts. Never promise rankings or conversions.
4. If the defect can be planted, add it to `fixtures/site/src/pages.ts` **and** `fixtures/site/src/expected.ts`. The end-to-end test enforces it.
5. Run `pnpm docs:rules` to regenerate [docs/rules.md](docs/rules.md).

## Ground rules (enforced in review)

- All network access to audited sites goes through `@webaudit/safety`. Never add a raw `fetch` to an audited URL.
- No AI in the audit, scoring or report path. AI output never modifies findings.
- Redact before storing anything derived from URLs, requests or cookies.
- Keep pull requests focused, with tests. Match the surrounding code style.

## Pull requests

- Branch from `main`. Use [Conventional Commits](https://www.conventionalcommits.org/) for titles: `feat(m04): detect …`, `fix(crawler): …`, `docs: …`.
- Fill in the PR template, including the privacy checklist.
- CI must be green. A maintainer reviews within a few days. Please be patient: this is a volunteer project.

## Labels

`good first issue` · `help wanted` · `bug` · `enhancement` · `documentation` · `audit-accuracy` · `seo` · `accessibility` · `analytics` · `privacy` · `performance` · `security` (see [.github/labels.yml](.github/labels.yml)).

## Licence

By contributing, you agree that your contributions are licensed under the [Apache-2.0 licence](LICENSE). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
