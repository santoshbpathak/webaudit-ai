# ADR 003 — Lighthouse in isolated child processes

**Status:** accepted · **Date:** 2026-10-15

Lighthouse is not safe to run concurrently in one process and can hang on hostile pages. Each run is a separate Node process with a hard timeout; the process group is killed on timeout or cancellation. Its Chrome is forced through the same guard proxy as Playwright. A failed run marks M02 rules `inconclusive` with the reason; other modules are unaffected (PRD T08).
