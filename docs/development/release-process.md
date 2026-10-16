# Release process

## Versioning

- **Semantic Versioning, starting at `v0.1.0`.** The feature set is broad and tested, but CI, Docker and the Action have not yet run in public. Expect feedback-driven changes, and keep 0.x until rule IDs, the CLI flags and the JSON report shape are considered stable. Then go to 1.0.
- Before 1.0: **minor** releases may change behaviour (always noted under _Changed_ or _Removed_); **patch** releases are fixes only.
- Rule IDs are part of the public contract (CI budgets reference them). Renaming one is a breaking change.

## Commits and changelog

- [Conventional Commits](https://www.conventionalcommits.org/) in PR titles:
  - types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`
  - optional scope: a module or package, e.g. `feat(m04): …`
- Squash-merge PRs, so `main` history reads as the PR titles.
- Update `CHANGELOG.md` under **[Unreleased]** in the PR ([Keep a Changelog](https://keepachangelog.com/) sections: Added, Changed, Fixed, Removed, Security).

## Cutting a release (manual, maintainer only)

1. Check that `main` is green: CI's `check`, `e2e`, `action-selftest`, `docker`, `security` and `docs` jobs.
2. Locally: `pnpm install --frozen-lockfile && pnpm check && pnpm e2e && pnpm examples`. Review any changes to `examples/`.
3. Bump versions:
   - `ENGINE_VERSION` in `packages/core` (it appears in the User-Agent and reports)
   - `version` in `apps/web/package.json` and the CLI
4. In `CHANGELOG.md`, move [Unreleased] into `[X.Y.Z] — YYYY-MM-DD` and update the compare links at the bottom.
5. Commit `chore(release): vX.Y.Z` through a PR, then tag the merge commit: `git tag -s vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`.
6. The tag triggers `release.yml`, which builds and pushes `ghcr.io/santoshbpathak/webaudit-ai:X.Y.Z` and `:X.Y`. It runs in the `release` environment; configure that environment to **require reviewer approval**.
7. Create the GitHub Release by hand:
   - notes from the changelog
   - attach `branding/assets/github/release.png`
   - mark as pre-release while on 0.x if preferred
8. The Action is referenced by tag (`santoshbpathak/webaudit-ai/action@vX.Y.Z`). Optionally move a `v0` major tag after verifying the release.

Nothing is published automatically from pull requests or `main`.

## Repository settings (one time)

- **Branch protection on `main`:** require PRs, require CI checks (`check`, `e2e`, `security`, `docs`), no force pushes.
- **Actions → General:**
  - workflow permissions _Read repository contents_
  - require approval for first-time contributors' workflow runs
- **Security:** enable private vulnerability reporting, secret scanning with push protection, Dependabot alerts and security updates.
- **Environments:** create `release` with a required reviewer (the maintainer).
- **Labels:** create from `.github/labels.yml` (the command is in the file header, or create them in the UI).
- **Social preview:** upload `branding/assets/github/social-preview.png`.

## CI overview (`.github/workflows/ci.yml`)

| Job               | What it checks                                                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check`           | format, lint, typecheck, unit and integration tests (SSRF suite, fixture end-to-end), web build                                                                                                                                                     |
| `e2e`             | Playwright UI tests, including axe in both themes and a live audit                                                                                                                                                                                  |
| `action-selftest` | The composite Action against the fixture site                                                                                                                                                                                                       |
| `docker`          | Image build and access-token smoke test                                                                                                                                                                                                             |
| `security`        | gitleaks over full history (checksum-verified binary), `pnpm audit --prod --audit-level high`, configuration guards (no committed `.env`, no private-host exemption in images, non-root container, loopback-only compose, no `pull_request_target`) |
| `docs`            | Offline check of relative links and images in Markdown (lychee)                                                                                                                                                                                     |

All workflows use a read-only token and no secrets on pull requests. Third-party actions are pinned to commit SHAs, and Dependabot (`.github/dependabot.yml`) proposes updates weekly.
