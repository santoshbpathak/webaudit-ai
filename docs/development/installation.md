# Installation and troubleshooting

## Requirements

| Item          | Requirement                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Node.js       | ≥ 22.19 (LTS 22 recommended; `.nvmrc` provided)                                                                                   |
| pnpm          | 9.12.0. Run `corepack enable` and the version pinned in `package.json` is used                                                    |
| Chromium      | Installed by Playwright (step 3 below)                                                                                            |
| OS            | macOS verified. Linux on Playwright-supported distributions expected to work (the Docker image is Ubuntu). Windows not yet tested |
| Disk / memory | About 1 GB for dependencies and Chromium; 1–2 GB RAM during a Smart audit                                                         |

## Install

```bash
corepack enable
git clone https://github.com/santoshbpathak/webaudit-ai.git && cd webaudit-ai
pnpm install --frozen-lockfile
pnpm --filter @webaudit/browser exec playwright install chromium    # Linux: add --with-deps
pnpm webaudit doctor
```

`doctor` checks:

- the Node version
- that the data directory is writable
- that SQLite opens and migrates
- that Chromium is installed
- whether private networks are blocked (they should be)

## Run

| Command                                                                  | What it does                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                               | Web UI and audit worker on http://127.0.0.1:3000                                            |
| `pnpm fixture`                                                           | Synthetic demo site with planted defects on http://127.0.0.1:4100                           |
| `pnpm webaudit audit <url> [--mode quick\|smart\|deep] [--out dir]`      | Audit from the terminal                                                                     |
| `pnpm webaudit list` / `report <id>` / `diff <a> <b>`                    | List audits, export a report, compare two audits                                            |
| `pnpm --filter @webaudit/web build && pnpm --filter @webaudit/web start` | Production server (binds 127.0.0.1; refuses a network bind without `WEBAUDIT_ACCESS_TOKEN`) |

To audit the demo site from the UI, allow its private address. This is for development only:

```bash
WEBAUDIT_ALLOW_PRIVATE_HOSTS=127.0.0.1 pnpm dev
```

## Configuration

Everything is optional. See [`.env.example`](../../.env.example) for all variables.

| Variable                                                                                                       | Purpose                                                                           |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `WEBAUDIT_DATA_DIR`                                                                                            | Where the SQLite database and artifacts live (default `<repo>/data`)              |
| `WEBAUDIT_ACCESS_TOKEN`                                                                                        | Required for any network-exposed instance (16+ random characters)                 |
| `WEBAUDIT_HOST`                                                                                                | Interface for `start` (default `127.0.0.1`)                                       |
| `WEBAUDIT_ALLOWED_HOSTS`                                                                                       | Extra Host names for a token-less local instance behind a reverse proxy           |
| `WEBAUDIT_DEMO=1`                                                                                              | Read-only demo over bundled sample audits                                         |
| `WEBAUDIT_ALLOW_PRIVATE_HOSTS`                                                                                 | Development and testing only: permit named private hosts                          |
| `WEBAUDIT_CHROME_NO_SANDBOX=1`                                                                                 | Only where Chromium's sandbox cannot start (for example Docker's default seccomp) |
| `WEBAUDIT_AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_*`, `WEBAUDIT_*_MODEL`, `WEBAUDIT_AI_MAX_CALLS_PER_AUDIT` | Optional AI; see [docs/ai.md](../ai.md)                                           |

## Troubleshooting

| Symptom                                              | Cause and fix                                                                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doctor`: Chromium not installed                     | Run `pnpm --filter @webaudit/browser exec playwright install chromium` (add `--with-deps` on Linux)                                                         |
| `better-sqlite3` build errors during install         | No prebuilt binary for your platform or Node version. Use Node 22 LTS, or install a C/C++ toolchain (Xcode CLT, `build-essential`) and reinstall            |
| "URL is not public" / private host refused           | Working as intended: private networks are blocked. For the local fixture only, set `WEBAUDIT_ALLOW_PRIVATE_HOSTS=127.0.0.1`                                 |
| `failed: bad port`                                   | Node's fetch blocks some ports (for example 6000, 6667). Sites on those ports can't be audited; pick another port for local test servers                    |
| Every browser check is "inconclusive"                | Chromium failed to start or was killed. Run `doctor`. In containers, Chromium needs a sandbox-compatible seccomp profile, or `WEBAUDIT_CHROME_NO_SANDBOX=1` |
| Audit stays "Queued"                                 | The worker isn't running. `pnpm dev` starts both; otherwise run `pnpm webaudit worker` with the same `WEBAUDIT_DATA_DIR`                                    |
| UI and CLI show different audits                     | They use different data directories. Set `WEBAUDIT_DATA_DIR` for both                                                                                       |
| HTTP 421 "Host not allowed"                          | You opened a token-less instance through a non-loopback hostname. Use `127.0.0.1`, set `WEBAUDIT_ALLOWED_HOSTS`, or configure an access token               |
| HTTP 403 "Cross-site request blocked"                | A different site tried to submit to your instance. Use the app from its own address                                                                         |
| "Refusing to start: WEBAUDIT_HOST=… exposes the app" | Set `WEBAUDIT_ACCESS_TOKEN` (16+ chars), or bind to 127.0.0.1                                                                                               |
| AI panel says AI is off                              | Set `WEBAUDIT_AI_PROVIDER` plus the provider's key or base URL, and restart                                                                                 |
| Lighthouse results missing                           | Lighthouse runs on up to 5 sampled pages by default; check "Lighthouse pages" in Advanced controls. Failures are logged and recorded as inconclusive        |

Still stuck? Open a [bug report](../../.github/ISSUE_TEMPLATE/bug_report.yml) with the `doctor` output, minus any private paths.
