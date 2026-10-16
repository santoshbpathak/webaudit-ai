# Architecture

## Processes

| Process | Command                      | Responsibility                                                           |
| ------- | ---------------------------- | ------------------------------------------------------------------------ |
| Web     | `next start` (apps/web)      | UI and REST API. Reads the DB, enqueues audits, never launches browsers. |
| Worker  | `webaudit worker` (apps/cli) | Leases jobs from the queue and runs the audit pipeline.                  |
| CLI     | `webaudit audit <url>`       | Runs one audit in-process (used by the GitHub Action).                   |

The web app and worker share one SQLite database (WAL mode) in `WEBAUDIT_DATA_DIR` (default `<repo>/data`). They are separate processes so a crashing browser never takes the UI down, and workers can scale independently.

## Audit pipeline (`packages/pipeline/src/run.ts`)

1. **Preflight** — normalise the URL, check scheme/credentials/port, resolve DNS, reject non-public addresses.
2. **Discovery** — robots.txt (RFC 9309), sitemaps (indexes, gzip, size and count limits), then a breadth-first frontier: link graph first, sitemap-only seeds after. Every URL is written to the ledger with its source, depth and a terminal state.
3. **HTTP checks** on every fetched page via `parseHtml` → `ParsedHtml` (titles, canonicals, headings, links, JSON-LD, MinHash sketch, DOM signature).
4. **Sampling** — pages are clustered by path pattern + DOM signature ("inferred template"); the browser sample takes the start URL, one page per cluster, up to two flagged pages per cluster, then round-robin fill. Deep mode samples everything up to the cap.
5. **Browser checks** — one Chromium per audit, all traffic through the guard proxy, a fresh context per page: network observation before and after consent, forms, CTAs, tap targets, broken images, axe-core, screenshot.
6. **Lighthouse** — serial child processes with hard timeouts, through the same proxy.
7. **Evaluate** — each module returns explicit statuses per rule and page; the engine fills `not_tested` for browser rules outside the sample and `inconclusive` when a module or browser run fails.
8. **Group + prioritise** — signature = rule + path pattern (stable across scans), priority index (see scoring.md).
9. **Reports** — HTML (self-contained, no scripts), JSON, CSV, Markdown; registered as artifacts.

Cancellation is cooperative (DB flag polled every 750 ms) and closes the browser pool; leftover URLs are labelled `skipped: cancelled`. A crashed worker's lease expires and another worker resumes the audit, keeping the discovery ledger and re-checking pages.

## Packages

| Package    | Notes                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `core`     | Zod schemas and the module contract. No I/O.                                                                                         |
| `safety`   | `assertPublicUrl`, connect-time DNS validation (`createSafeAgent`), `safeFetch` with manual redirects, `startGuardProxy`, redaction. |
| `db`       | Drizzle schema, embedded migrations, repository functions.                                                                           |
| `queue`    | `JobQueue` interface; SQLite implementation with atomic leases and heartbeats.                                                       |
| `crawler`  | Normalisation, scope, robots, sitemaps, extraction, frontier, clustering, sampling.                                                  |
| `browser`  | Chromium pool and page session; in-page collectors are self-contained functions.                                                     |
| `engines`  | Lighthouse runner.                                                                                                                   |
| `modules`  | M01–M10 rule modules, tracker signature registry, evaluator.                                                                         |
| `scoring`  | Grouping, priority index, coverage.                                                                                                  |
| `report`   | Report model, deterministic summary/backlog, exports, diff, CI budgets.                                                              |
| `pipeline` | Orchestration, worker loop, artifact store.                                                                                          |
| `ai`       | Optional providers, payload builder, citation validation.                                                                            |

## Scaling beyond one machine

`JobQueue` and `ArtifactStore` are interfaces. A Postgres queue (`FOR UPDATE SKIP LOCKED`) and an S3-compatible artifact store slot in without changing callers; the Docker image already supports `WEBAUDIT_ROLE=web|worker` so web and worker replicas can be deployed separately. The SQLite implementations are the default because they need no setup.
