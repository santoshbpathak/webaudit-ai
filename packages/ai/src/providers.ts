import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";

export interface GenerateRequest<T> {
  /** Stable, cacheable instructions (never contains audit data). */
  system: string;
  /** Audit data + task; page-derived text is wrapped as untrusted. */
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
}

export interface GenerateResult<T> {
  data: T;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number };
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly kind: "config" | "auth" | "rate_limit" | "refusal" | "invalid_output" | "provider",
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiProvider {
  name: "anthropic" | "openai-compatible" | "mock";
  model: string;
  /** Where data is sent — shown to the user before transmission (AI-06). */
  destination: string;
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

function parseJson<T>(text: string, schema: z.ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiError("Model did not return valid JSON", "invalid_output");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new AiError(
      `Model output failed schema validation: ${parsed.error.issues[0]?.message}`,
      "invalid_output",
    );
  return parsed.data;
}

/** Claude via the official SDK, JSON-schema structured output, server-side refusal fallback. */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  readonly destination = "Anthropic API (api.anthropic.com)";
  private readonly client: Anthropic;

  constructor(
    readonly model: string,
    apiKey?: string,
  ) {
    this.client = new Anthropic({ ...(apiKey ? { apiKey } : {}), timeout: 120_000, maxRetries: 1 });
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Summaries over pre-computed findings: moderate depth is enough.
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: z.toJSONSchema(req.schema) as Record<string, unknown> },
        },
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.user }],
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError)
        throw new AiError("Anthropic API key is invalid or missing", "auth");
      if (e instanceof Anthropic.RateLimitError)
        throw new AiError("Anthropic rate limit reached — try again shortly", "rate_limit");
      if (e instanceof Anthropic.BadRequestError)
        throw new AiError(`Anthropic rejected the request: ${e.message}`, "provider");
      if (e instanceof Anthropic.APIError)
        throw new AiError(`Anthropic API error ${e.status}: ${e.message}`, "provider");
      throw new AiError(`Could not reach Anthropic: ${(e as Error).message}`, "provider");
    }
    if (res.stop_reason === "refusal")
      throw new AiError(
        `The model declined this request${res.stop_details?.category ? ` (${res.stop_details.category})` : ""}`,
        "refusal",
      );
    if (res.stop_reason === "max_tokens")
      throw new AiError("Model output was truncated (max_tokens)", "invalid_output");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return {
      data: parseJson(text, req.schema),
      model: res.model,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        cacheReadTokens: res.usage.cache_read_input_tokens ?? undefined,
      },
    };
  }
}

/** Any OpenAI-compatible chat endpoint (OpenAI, OpenRouter, Groq, Ollama, LM Studio). */
export class OpenAICompatibleProvider implements AiProvider {
  readonly name = "openai-compatible" as const;
  private readonly client: OpenAI;

  constructor(
    readonly model: string,
    private readonly baseURL: string | undefined,
    apiKey?: string,
  ) {
    this.client = new OpenAI({
      apiKey: apiKey ?? "not-needed-for-local",
      ...(baseURL ? { baseURL } : {}),
      timeout: 120_000,
      maxRetries: 1,
    });
  }

  get destination() {
    return this.baseURL
      ? `OpenAI-compatible endpoint (${new URL(this.baseURL).host})`
      : "OpenAI API (api.openai.com)";
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 4000,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: req.schemaName,
            schema: z.toJSONSchema(req.schema) as Record<string, unknown>,
            strict: false,
          },
        },
      });
      const choice = res.choices[0];
      if (!choice?.message?.content) throw new AiError("Empty response from model", "invalid_output");
      if (choice.finish_reason === "length")
        throw new AiError("Model output was truncated", "invalid_output");
      return {
        data: parseJson(choice.message.content, req.schema),
        model: res.model,
        usage: { inputTokens: res.usage?.prompt_tokens, outputTokens: res.usage?.completion_tokens },
      };
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e instanceof OpenAI.AuthenticationError)
        throw new AiError("API key rejected by the OpenAI-compatible endpoint", "auth");
      if (e instanceof OpenAI.RateLimitError)
        throw new AiError("Rate limited by the OpenAI-compatible endpoint", "rate_limit");
      if (e instanceof OpenAI.APIError)
        throw new AiError(`Provider error ${e.status}: ${e.message}`, "provider");
      throw new AiError(`Could not reach the AI endpoint: ${(e as Error).message}`, "provider");
    }
  }
}

export interface AiStatus {
  enabled: boolean;
  provider?: AiProvider["name"];
  model?: string;
  destination?: string;
  reason?: string;
}

/**
 * AI is OFF unless WEBAUDIT_AI_PROVIDER is set (AI-01). Keys come from the environment
 * only — never stored in the database or sent to the browser.
 */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): AiProvider | null {
  const p = env.WEBAUDIT_AI_PROVIDER?.toLowerCase();
  if (p === "anthropic")
    return new AnthropicProvider(env.WEBAUDIT_ANTHROPIC_MODEL || "claude-opus-5-5", env.ANTHROPIC_API_KEY);
  if (p === "openai" || p === "openai-compatible") {
    const model = env.WEBAUDIT_OPENAI_MODEL;
    if (!model)
      throw new AiError("WEBAUDIT_OPENAI_MODEL is required for the OpenAI-compatible provider", "config");
    return new OpenAICompatibleProvider(model, env.OPENAI_BASE_URL || undefined, env.OPENAI_API_KEY);
  }
  return null;
}

export function aiStatus(env: NodeJS.ProcessEnv = process.env): AiStatus {
  try {
    const p = providerFromEnv(env);
    if (!p)
      return {
        enabled: false,
        reason: "AI is off. Set WEBAUDIT_AI_PROVIDER=anthropic or openai to enable optional AI suggestions.",
      };
    return { enabled: true, provider: p.name, model: p.model, destination: p.destination };
  } catch (e) {
    return { enabled: false, reason: (e as Error).message };
  }
}
