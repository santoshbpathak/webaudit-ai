import type { LookupAddress, LookupOptions } from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import { UnsafeUrlError, assertSafeUrlShape, resolvePublic, type SafetyPolicy } from "./policy";
import { redactUrl } from "./redact";

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * DNS lookup used at socket-connect time. Because the socket connects to exactly the
 * address validated here, a hostname cannot pass preflight with a public IP and then
 * rebind to 127.0.0.1 for the real connection.
 */
export function makeSafeLookup(policy: SafetyPolicy) {
  return (hostname: string, options: LookupOptions | number, callback: LookupCallback): void => {
    const opts: LookupOptions = typeof options === "number" ? { family: options } : (options ?? {});
    resolvePublic(hostname, policy)
      .then((answers) => {
        const filtered = opts.family ? answers.filter((a) => a.family === opts.family) : answers;
        const list = filtered.length ? filtered : answers;
        if (opts.all) callback(null, list as LookupAddress[]);
        else callback(null, list[0]!.address, list[0]!.family);
      })
      .catch((e: Error) => callback(Object.assign(e, { code: "EUNSAFEADDR" }), "", 0));
  };
}

export function createSafeAgent(policy: SafetyPolicy): Agent {
  return new Agent({
    connect: { lookup: makeSafeLookup(policy) as never, timeout: 10_000 },
    headersTimeout: 20_000,
    bodyTimeout: 20_000,
    connections: 16,
  });
}

export interface SafeFetchOptions {
  agent: Agent;
  policy: SafetyPolicy;
  userAgent: string;
  timeoutMs: number;
  maxBytes: number;
  maxRedirects?: number;
  /** Return false to stop following a redirect (e.g. out of scope). */
  allowRedirect?: (target: URL) => boolean;
  accept?: string;
  signal?: AbortSignal;
}

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  contentType: string;
  redirectChain: { url: string; status: number }[];
  body: Buffer;
  bytes: number;
  truncated: boolean;
  elapsedMs: number;
  /** Set when a redirect was not followed (unsafe or out of scope). */
  redirectStopped?: { target: string; reason: string };
}

export async function safeFetch(url: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  const started = Date.now();
  const maxRedirects = opts.maxRedirects ?? 10;
  const chain: { url: string; status: number }[] = [];
  let current = assertSafeUrlShape(url, opts.policy);
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  for (let hop = 0; ; hop++) {
    const res = await undiciFetch(current, {
      dispatcher: opts.agent,
      redirect: "manual",
      signal,
      headers: {
        "user-agent": opts.userAgent,
        accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
        "accept-language": "en",
      },
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      if (k !== "set-cookie") headers[k] = v;
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      chain.push({ url: redactUrl(current.toString()), status: res.status });
      await res.body?.cancel();
      let target: URL;
      try {
        target = new URL(location, current);
      } catch {
        throw new UnsafeUrlError(`Invalid redirect location: ${location.slice(0, 200)}`, "invalid_url");
      }
      // Every hop is re-validated; an unsafe hop is a hard error (T06).
      assertSafeUrlShape(target, opts.policy);
      if (hop >= maxRedirects) {
        throw new Error(`Too many redirects (>${maxRedirects})`);
      }
      if (opts.allowRedirect && !opts.allowRedirect(target)) {
        return {
          requestedUrl: url,
          finalUrl: current.toString(),
          status: res.status,
          headers,
          contentType: headers["content-type"] ?? "",
          redirectChain: chain,
          body: Buffer.alloc(0),
          bytes: 0,
          truncated: false,
          elapsedMs: Date.now() - started,
          redirectStopped: { target: redactUrl(target.toString()), reason: "out_of_scope" },
        };
      }
      current = target;
      continue;
    }

    const { body, bytes, truncated } = await readCapped(res.body, opts.maxBytes);
    return {
      requestedUrl: url,
      finalUrl: current.toString(),
      status: res.status,
      headers,
      contentType: headers["content-type"] ?? "",
      redirectChain: chain,
      body,
      bytes,
      truncated,
      elapsedMs: Date.now() - started,
    };
  }
}

/** Structural type so both Node and DOM lib ReadableStream typings are accepted. */
interface ByteStream {
  getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> };
}

async function readCapped(
  stream: ByteStream | null,
  maxBytes: number,
): Promise<{ body: Buffer; bytes: number; truncated: boolean }> {
  if (!stream) return { body: Buffer.alloc(0), bytes: 0, truncated: false };
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    if (total + value.byteLength > maxBytes) {
      parts.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      await reader.cancel();
      break;
    }
    parts.push(value);
    total += value.byteLength;
  }
  return { body: Buffer.concat(parts), bytes: total, truncated };
}

/** Unwrap undici's nested causes into a short human reason. */
export function describeFetchError(e: unknown): { reason: string; unsafe: boolean } {
  let err = e as (Error & { cause?: unknown; code?: string }) | undefined;
  for (let i = 0; i < 5 && err; i++) {
    if (err instanceof UnsafeUrlError || err.code === "EUNSAFEADDR") {
      return { reason: `Blocked by safety policy: ${err.message}`, unsafe: true };
    }
    if (!err.cause) break;
    err = err.cause as typeof err;
  }
  const top = e as Error & { name?: string };
  if (top?.name === "TimeoutError" || top?.name === "AbortError")
    return { reason: "Timed out", unsafe: false };
  const code = err?.code ? `${err.code}: ` : "";
  return { reason: `${code}${err?.message ?? String(e)}`.slice(0, 300), unsafe: false };
}
