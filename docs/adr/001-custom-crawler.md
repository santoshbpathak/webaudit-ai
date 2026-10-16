# ADR 001 — Custom crawl frontier instead of Crawlee

**Status:** accepted · **Date:** 2026-10-15

The PRD suggested Crawlee. Crawlee manages its own request queue and storage. Two non-negotiables conflict with that: (1) every discovered URL must end in an exact, reasoned state in our ledger (coverage must reconcile), and (2) every hop — redirects included — must pass our SSRF checks with connect-time DNS validation.

**Decision:** a small frontier on undici (through `@webaudit/safety`), cheerio for extraction, robots-parser and fast-xml-parser, with Playwright only for rendering and browser checks.

**Consequences:** ~400 lines we own and test (T02–T05), full control of ordering (link graph before sitemap seeds) and limits; we forgo Crawlee's autoscaling, which v1 does not need.
