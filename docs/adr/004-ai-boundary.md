# ADR 004 — AI is an optional, append-only layer

**Status:** accepted · **Date:** 2026-10-15

All audit outputs are deterministic. AI is limited to three tasks over already-computed findings, is off by default, requires a per-request confirmed transmission preview, and writes only to `llm_analyses`. Outputs must cite ids from the payload; unknown ids are stored as invalid citations. Providers: Claude via the official SDK, and any OpenAI-compatible endpoint (which also covers local Ollama for a free, offline option).
