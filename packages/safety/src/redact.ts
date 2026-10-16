/**
 * Redaction applied before anything is stored or logged (PRD §7, T15).
 * Parameter names are matched case-insensitively; values that look like secrets or
 * personal data are redacted even under innocuous names.
 */

/** Name contains a secret/PII word anywhere (session_id, x-auth-token, user_email). */
const SENSITIVE_CONTAINS =
  /(token|secret|passw|pwd|api[-_]?key|apikey|auth|session|sessid|signature|jwt|otp|nonce|credential|private|email|e-mail|phone|mobile|ssn|aadhaar)/i;
/** Short names that are only sensitive as whole names. */
const SENSITIVE_EXACT =
  /^(sid|sig|code|key|mail|tel|pan|dob|first_?name|last_?name|full_?name|name|address|zip|postcode|user|user_?id|uid|customer_?id|account|account_?id|cid|client_?id|_p|ecid|visitor_?id|anonymous_?id|device_?id|fbp|fbc|_fbp|_fbc|gclid|gbraid|wbraid|fbclid|msclkid|ttclid|li_fat_id|_hsenc|mc_eid)$/i;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const LONG_SECRET = /^[A-Za-z0-9+/=_-]{32,}$/;
const PHONE = /^\+?[0-9][0-9\s-]{8,14}$/;

export const REDACTED = "REDACTED";

function looksSensitiveValue(v: string): boolean {
  if (!v) return false;
  if (EMAIL.test(v)) {
    EMAIL.lastIndex = 0;
    return true;
  }
  EMAIL.lastIndex = 0;
  return LONG_SECRET.test(v) || PHONE.test(v) || /^eyJ/.test(v);
}

export function isSensitiveParam(name: string): boolean {
  return SENSITIVE_CONTAINS.test(name) || SENSITIVE_EXACT.test(name);
}

/** Remove credentials and redact sensitive query values. Invalid URLs are text-redacted. */
export function redactUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return redactText(raw);
  }
  if (u.username || u.password) {
    u.username = "";
    u.password = "";
  }
  const params = [...u.searchParams.entries()];
  if (params.length) {
    const next = new URLSearchParams();
    for (const [k, v] of params) {
      next.append(k, isSensitiveParam(k) || looksSensitiveValue(v) ? REDACTED : v);
    }
    u.search = next.toString();
  }
  // Fragments can carry OAuth tokens (#access_token=...).
  if (u.hash && /=/.test(u.hash)) u.hash = "#" + REDACTED;
  return u.toString();
}

/** Redact emails and JWT-like strings from free text (logs, snippets, POST bodies). */
export function redactText(s: string): string {
  return s.replace(EMAIL, "[email]").replace(JWT, "[jwt]");
}

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
]);

export function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? REDACTED : v;
  return out;
}

/**
 * Redact a URL-encoded or JSON request body excerpt (analytics beacons often carry
 * client ids and user properties). Keeps parameter names for evidence value.
 */
export function redactBody(body: string, max = 500): string {
  const trimmed = body.slice(0, 4_000);
  let out: string;
  if (/^[\w.%-]+=/.test(trimmed) && !trimmed.includes("{")) {
    const parts = trimmed.split(/[&\n]/).map((pair) => {
      const [k = "", ...rest] = pair.split("=");
      const v = rest.join("=");
      let decoded = v;
      try {
        decoded = decodeURIComponent(v);
      } catch {
        /* keep raw */
      }
      return isSensitiveParam(k) || looksSensitiveValue(decoded) || /^(cid|uid|_p|sid)$/i.test(k)
        ? `${k}=${REDACTED}`
        : pair;
    });
    out = parts.join("&");
  } else {
    out = redactText(trimmed);
  }
  return out.slice(0, max);
}
