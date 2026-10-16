/**
 * URL normalization (CR-01, CR-03, CR-04). Collapses only variants that are
 * never materially distinct: scheme/host case, default ports, fragments, tracking
 * parameters and parameter order. Trailing slashes and other path differences are
 * preserved — those pages can genuinely differ; duplicate-content rules catch the rest.
 */

const TRACKING_PARAMS = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "fbclid",
  "msclkid",
  "ttclid",
  "twclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "_hsenc",
  "_hsmi",
  "igshid",
  "yclid",
  "srsltid",
]);

export function isTrackingParam(name: string, extra: Set<string> = new Set()): boolean {
  const n = name.toLowerCase();
  return n.startsWith("utm_") || TRACKING_PARAMS.has(n) || extra.has(n);
}

export interface NormalizeOptions {
  stripParams?: string[];
}

/** Returns a normalized absolute URL, or null when not an http(s) URL. */
export function normalizeUrl(raw: string, base?: string, opts: NormalizeOptions = {}): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /^(mailto|tel|javascript|data|sms|whatsapp|blob|about):/i.test(trimmed)) return null;
  let u: URL;
  try {
    u = base ? new URL(trimmed, base) : new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/\.$/, "");
  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443"))
    u.port = "";
  if (!u.pathname) u.pathname = "/";

  const extra = new Set((opts.stripParams ?? []).map((s) => s.toLowerCase()));
  const kept = [...u.searchParams.entries()].filter(([k]) => !isTrackingParam(k, extra));
  kept.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  u.search = kept.length ? new URLSearchParams(kept).toString() : "";
  return u.toString();
}

/** Registrable-ish site key: host without a leading www. */
export function siteHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export interface ScopeOptions {
  includeSubdomains: boolean;
  allowPaths: string[];
  denyPaths: string[];
}

export type ScopeDecision = { ok: true } | { ok: false; reason: string };

function matchesPattern(pathAndQuery: string, pattern: string): boolean {
  if (pattern.includes("*")) return globPrefixMatch(pathAndQuery.toLowerCase(), pattern.toLowerCase());
  return pathAndQuery.toLowerCase().includes(pattern.toLowerCase());
}

/**
 * Anchored-at-start glob ("*" = any run of characters; the pattern may match a prefix).
 * Two-pointer matcher, O(n·m) worst case: user-supplied patterns can never trigger the
 * catastrophic backtracking that a "*" → ".*" RegExp allows.
 */
export function globPrefixMatch(s: string, p: string): boolean {
  let si = 0;
  let pi = 0;
  let star = -1;
  let mark = 0;
  while (si < s.length) {
    if (pi === p.length) return true; // pattern consumed: prefix match
    if (p[pi] === "*") {
      star = pi++;
      mark = si;
    } else if (p[pi] === s[si]) {
      pi++;
      si++;
    } else if (star > -1) {
      pi = star + 1;
      si = ++mark;
    } else return false;
  }
  while (p[pi] === "*") pi++;
  return pi === p.length;
}

/** Is `url` inside the audit scope rooted at `start`? */
export function inScope(url: string, start: string, opts: ScopeOptions): ScopeDecision {
  const u = new URL(url);
  const s = new URL(start);
  const host = siteHost(u.hostname);
  const startHost = siteHost(s.hostname);
  const sameSite =
    host === startHost || (opts.includeSubdomains && (host.endsWith("." + startHost) || host === startHost));
  if (!sameSite) return { ok: false, reason: "out_of_scope_host" };
  if (u.port !== s.port) return { ok: false, reason: "out_of_scope_port" };
  const pq = u.pathname + u.search;
  const denied = opts.denyPaths.find((p) => matchesPattern(pq, p));
  if (denied) return { ok: false, reason: `denylist:${denied}` };
  if (opts.allowPaths.length && !opts.allowPaths.some((p) => matchesPattern(u.pathname, p))) {
    return { ok: false, reason: "not_in_allowlist" };
  }
  return { ok: true };
}

/** Path with query stripped — used to cap query-string variants per path (T04). */
export function pathKey(url: string): string {
  const u = new URL(url);
  return `${u.host}${u.pathname}`;
}

/** Generalized path pattern for template clustering: /blog/first-post → /blog/*, /p/123 → /p/:n */
export function pathPattern(url: string): string {
  const segs = new URL(url).pathname.split("/").filter(Boolean);
  if (!segs.length) return "/";
  const mapped = segs.map((s, i) => {
    if (/^\d+$/.test(s)) return ":n";
    if (i === segs.length - 1 && segs.length > 1) return "*";
    return s.toLowerCase();
  });
  return "/" + mapped.join("/");
}
