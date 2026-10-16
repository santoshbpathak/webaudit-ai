# Optional AI

AI is **off** unless `WEBAUDIT_AI_PROVIDER` is set. The audit, findings, grouping, priority and every export work without it.

## Tasks

| Task              | Output                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Executive summary | Headline, 2–4 paragraphs, business risks — each citing ids                                                         |
| 30-day roadmap    | Four weeks of actions with likely owner and rationale — each citing ids                                            |
| Ask the audit     | An answer grounded in locally retrieved findings (BM25, no embeddings API), or an explicit "insufficient evidence" |

## Providers

| Provider           | Variables                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude (Anthropic) | `WEBAUDIT_AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, optional `WEBAUDIT_ANTHROPIC_MODEL` (default `claude-opus-5-5`)                                        |
| OpenAI-compatible  | `WEBAUDIT_AI_PROVIDER=openai`, `WEBAUDIT_OPENAI_MODEL`, optional `OPENAI_BASE_URL`, `OPENAI_API_KEY` — works with OpenAI, OpenRouter, Groq, Ollama, LM Studio |

The Claude adapter uses the official SDK with JSON-schema structured output, a cached system prompt and server-side refusal fallback. Keys are read from the environment only; they are never stored or sent to the browser.

## Guarantees

1. **Opt-in per request.** The UI shows the destination, model, size and the exact request text; nothing is sent until you confirm. The API rejects analyze calls without `confirm: true`.
2. **Restricted input.** Only the top issue groups and a bounded set of findings: rule ids, URLs, severities, confidence and short evidence excerpts (at most 200 characters, which can be HTML snippets) with attribute values such as `value=` removed and emails/JWTs redacted. No cookies, request bodies or full pages. Review the preview before sending.
3. **Prompt-injection resistance.** Page-derived text is fenced in `<untrusted_page_data>`; the system prompt instructs the model to treat it as data.
4. **Grounding.** Every statement carries `cited_ids`; ids that are not in the payload are stored as invalid citations and highlighted as unsupported.
5. **No write path to findings.** AI output is appended to `llm_analyses` only. `packages/ai/src/ai.test.ts` asserts findings and groups are byte-identical before and after an AI run that makes unsupported claims.
