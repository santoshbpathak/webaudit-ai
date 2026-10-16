import { lookup as dnsLookup } from "node:dns/promises";
import { isBlockedHostname, isIpLiteral, isPublicIp, stripBrackets } from "./ip";

export class UnsafeUrlError extends Error {
  constructor(
    message: string,
    public readonly code:
      "invalid_url" | "scheme" | "credentials" | "port" | "blocked_host" | "private_address" | "dns_failure",
  ) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export type Resolver = (host: string) => Promise<{ address: string; family: number }[]>;

export const systemResolver: Resolver = (host) => dnsLookup(host, { all: true, verbatim: true });

export interface SafetyPolicy {
  /**
   * host or host:port entries exempt from the private-address check.
   * For local fixture sites in tests/dev ONLY. Never set in production.
   */
  allowHosts: string[];
  /** Ports permitted for crawling. Empty = any port. */
  allowedPorts: number[];
  resolver: Resolver;
}

export function policyFromEnv(env: NodeJS.ProcessEnv = process.env): SafetyPolicy {
  const allowHosts = (env.WEBAUDIT_ALLOW_PRIVATE_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return { allowHosts, allowedPorts: [], resolver: systemResolver };
}

export function isAllowlisted(policy: SafetyPolicy, host: string, port?: string | number): boolean {
  if (!policy.allowHosts.length) return false;
  const h = stripBrackets(host.toLowerCase());
  return policy.allowHosts.includes(h) || (port !== undefined && policy.allowHosts.includes(`${h}:${port}`));
}

function effectivePort(u: URL): number {
  if (u.port) return Number(u.port);
  return u.protocol === "https:" ? 443 : 80;
}

/** Synchronous checks that do not need DNS. Throws UnsafeUrlError. */
export function assertSafeUrlShape(raw: string | URL, policy: SafetyPolicy): URL {
  let u: URL;
  try {
    u = typeof raw === "string" ? new URL(raw) : raw;
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${String(raw).slice(0, 200)}`, "invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UnsafeUrlError(`Only http and https URLs can be audited (got ${u.protocol})`, "scheme");
  }
  if (u.username || u.password) {
    throw new UnsafeUrlError("URLs containing credentials are not allowed", "credentials");
  }
  const port = effectivePort(u);
  if (policy.allowedPorts.length && !policy.allowedPorts.includes(port)) {
    throw new UnsafeUrlError(`Port ${port} is not permitted`, "port");
  }
  const host = stripBrackets(u.hostname);
  if (isAllowlisted(policy, host, port)) return u;
  if (isIpLiteral(host)) {
    if (!isPublicIp(host)) throw new UnsafeUrlError(`Address ${host} is not public`, "private_address");
  } else if (isBlockedHostname(host)) {
    throw new UnsafeUrlError(`Host ${host} is an internal name`, "blocked_host");
  }
  return u;
}

/**
 * Full check: shape + every DNS answer must be public. Used at preflight and for
 * redirect targets. Connection-time enforcement lives in the safe agent/proxy, which
 * closes the DNS-rebinding gap between this check and the actual connect.
 */
export async function assertPublicUrl(raw: string | URL, policy: SafetyPolicy): Promise<URL> {
  const u = assertSafeUrlShape(raw, policy);
  const host = stripBrackets(u.hostname);
  if (isAllowlisted(policy, host, effectivePort(u)) || isIpLiteral(host)) return u;
  await resolvePublic(host, policy);
  return u;
}

/** Resolve a hostname and return only if ALL answers are public. */
export async function resolvePublic(
  host: string,
  policy: SafetyPolicy,
  port?: number,
): Promise<{ address: string; family: number }[]> {
  if (isAllowlisted(policy, host, port)) return policy.resolver(host);
  if (isIpLiteral(host)) {
    const h = stripBrackets(host);
    if (!isPublicIp(h)) throw new UnsafeUrlError(`Address ${h} is not public`, "private_address");
    return [{ address: h, family: h.includes(":") ? 6 : 4 }];
  }
  if (isBlockedHostname(host)) throw new UnsafeUrlError(`Host ${host} is an internal name`, "blocked_host");
  let answers: { address: string; family: number }[];
  try {
    answers = await policy.resolver(host);
  } catch (e) {
    throw new UnsafeUrlError(`DNS lookup failed for ${host}: ${(e as Error).message}`, "dns_failure");
  }
  if (!answers.length) throw new UnsafeUrlError(`No DNS answers for ${host}`, "dns_failure");
  const bad = answers.find((a) => !isPublicIp(a.address));
  if (bad) {
    throw new UnsafeUrlError(`${host} resolves to non-public address ${bad.address}`, "private_address");
  }
  return answers;
}
