# ADR 002 — SQLite for storage and the job queue

**Status:** accepted · **Date:** 2026-10-15

Local-first installs must work with zero services. SQLite (WAL) via Drizzle stores audits, the URL ledger, findings and jobs. The queue uses an atomic `UPDATE … RETURNING` lease with heartbeats; expired leases are recovered so a crashed worker's audit resumes.

`JobQueue` and `ArtifactStore` are interfaces so a Postgres queue (`FOR UPDATE SKIP LOCKED`) and S3 artifacts can be added for multi-worker cloud deployments without touching callers. Redis/BullMQ is not used: it would add a mandatory service for no v1 benefit.

Migrations are embedded as TypeScript strings because Next.js bundling breaks runtime file lookups.
