/**
 * Browser-borne attacks on a local, token-less instance. The UI binds to 127.0.0.1, but any
 * web page the user visits can still (a) POST to http://127.0.0.1:3000 (drive-by CSRF:
 * start scans, cancel audits, trigger paid AI calls) or (b) DNS-rebind its own hostname to
 * 127.0.0.1 and read audit data same-origin. Defence: reject cross-site state-changing
 * requests, and when no access token is configured, accept only loopback Host headers.
 * Non-browser clients (curl, the CLI) send neither Origin nor Sec-Fetch-Site and pass.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export interface GuardInput {
  method: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  /** True when WEBAUDIT_ACCESS_TOKEN is set (requests are authenticated separately). */
  tokenConfigured: boolean;
  /** True in read-only public demo mode, where any Host is expected. */
  demo: boolean;
  /** Extra hostnames from WEBAUDIT_ALLOWED_HOSTS (e.g. a local reverse proxy). */
  allowedHosts: string[];
}

export type GuardResult = { ok: true } | { ok: false; status: 403 | 421; reason: string };

/** Hostname without port; handles bracketed IPv6. */
export function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  const i = h.lastIndexOf(":");
  return i > -1 && h.indexOf(":") === i ? h.slice(0, i) : h;
}

export function parseAllowedHosts(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function checkRequest(i: GuardInput): GuardResult {
  if (!i.tokenConfigured && !i.demo) {
    const name = i.host ? hostnameOf(i.host) : "";
    if (!LOOPBACK.has(name) && !i.allowedHosts.includes(name))
      return { ok: false, status: 421, reason: "Host not allowed" };
  }
  if (SAFE_METHODS.has(i.method.toUpperCase())) return { ok: true };
  if (i.secFetchSite && i.secFetchSite !== "same-origin" && i.secFetchSite !== "none")
    return { ok: false, status: 403, reason: "Cross-site request blocked" };
  if (i.origin) {
    let originHost: string;
    try {
      originHost = new URL(i.origin).host.toLowerCase();
    } catch {
      return { ok: false, status: 403, reason: "Cross-site request blocked" };
    }
    if (!i.host || originHost !== i.host.trim().toLowerCase())
      return { ok: false, status: 403, reason: "Cross-site request blocked" };
  }
  return { ok: true };
}
