## What and why

<!-- One or two sentences. Link the issue: "Closes #123". -->

## Type

- [ ] Bug fix
- [ ] New or changed audit rule
- [ ] Feature / UI
- [ ] Documentation
- [ ] Tests / fixtures only
- [ ] Build / CI

## Checklist

- [ ] `pnpm check` passes (lint, typecheck, tests)
- [ ] UI changes: `pnpm e2e` passes and screenshots are attached
- [ ] Rule changes: explicit status for every page, honest confidence, a caveat for heuristics, fixture + `expected.ts` updated if plantable, `pnpm docs:rules` run
- [ ] No network access to audited sites outside `@webaudit/safety`; no AI in the audit/score/report path
- [ ] User-facing wording avoids compliance, ranking or conversion promises

## Privacy

- [ ] This PR contains no private or client website data, credentials, cookies, personal data or unpublished URLs (including in fixtures, screenshots and test snapshots)
