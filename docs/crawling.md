# Crawling

## Normalisation

Collapsed: scheme/host case, default ports, fragments, tracking parameters (`utm_*`, `gclid`, `fbclid`, `msclkid`, `_ga`, `_gl`, …, plus `stripParams`), parameter order. **Preserved:** trailing slashes, path case and other parameters — those can be genuinely different pages; duplicate-content rules flag the ones that are not.

## Scope

Same site (`www.` and apex are equivalent), same port, optional subdomains, allow/deny path patterns (substring or `*` glob, matched on path + query). The default denylist excludes state-changing and private paths.

## Order and limits

The link graph is crawled breadth-first; sitemap-only URLs are fetched after it, and a sitemap URL found via a link is promoted. This keeps navigable pages ahead of orphaned sitemap entries when the URL cap is reached.

| Limit                     | Default                | Ledger reason when hit              |
| ------------------------- | ---------------------- | ----------------------------------- |
| `maxUrls`                 | 500 (quick: 1)         | `max_urls_cap`                      |
| `maxDepth`                | 5                      | `max_depth`                         |
| `maxQueryVariantsPerPath` | 5                      | `query_variant_cap`                 |
| `auditDeadlineMs`         | 30 min                 | `audit_deadline`                    |
| ledger size               | max(2000, 5 × maxUrls) | counted as overflow                 |
| robots.txt                | —                      | `blocked_robots` with matching line |

robots `Crawl-delay` is respected up to 10 s. Responses are capped at `maxResponseBytes` (5 MB). Sitemaps: up to 50 files, 3 index levels, 50 000 URLs.

## Ledger states

`queued → attempted → checked | failed`, or directly `blocked_robots | skipped`. Coverage figures are computed from the ledger, never from in-memory counters, so they always reconcile.
