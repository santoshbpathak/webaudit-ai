# Security model

Auditing arbitrary URLs means fetching attacker-controlled content from your machine or server. WebAudit AI treats every input URL, redirect, page and response as hostile.

## Server-side request forgery

| Layer        | Control                                                                                                                                                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input        | Only `http`/`https`; no credentials in URLs; internal hostnames (`localhost`, `*.local`, `*.internal`, metadata names) rejected.                                                                                                                                                                   |
| DNS          | Every answer must be a globally routable unicast address (`ipaddr.js` range `unicast` only). Private, loopback, link-local (incl. `169.254.169.254`), CGNAT, multicast, documentation, unique-local, IPv4-mapped and NAT64 addresses are rejected. A hostname with any private answer is rejected. |
| Connect time | The HTTP agent validates DNS inside the socket `lookup`, so the socket connects to exactly the validated address — DNS rebinding between check and connect does not work.                                                                                                                          |
| Redirects    | Followed manually; every hop is re-validated.                                                                                                                                                                                                                                                      |
| Browser      | Chromium and Lighthouse's Chrome are forced through a local guard proxy (loopback included) that resolves and validates every destination, for subresources, `fetch()`, iframes and WebSockets.                                                                                                    |
| WebRTC       | Chromium and Lighthouse's Chrome run with `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`, so page JS cannot use STUN/TURN UDP to probe internal hosts around the proxy.                                                                                                               |
| Limits       | Response byte caps, redirect cap (10), sitemap count/size/depth caps, query-variant caps, per-host delay, an audit deadline that covers discovery, browser checks and Lighthouse, and a hard per-page watchdog (default 4 × page timeout) that terminates pages that block the renderer.           |

`WEBAUDIT_ALLOW_PRIVATE_HOSTS` exempts named hosts for local fixtures and staging. It is logged loudly and should never be set on a shared instance.

The regression suite lives in `packages/safety/src/ssrf.test.ts` (IP ranges, encodings like `http://2130706433/`, redirects into metadata, DNS rebinding, proxy CONNECT).

## Browser sandbox

Audited pages are hostile input. Playwright's Chromium runs with the renderer sandbox **on** (`chromiumSandbox: true`); Lighthouse's Chrome keeps Chrome's default sandbox. Browser processes receive an allowlisted environment (`browserEnv()` in `@webaudit/safety`), so API keys, the access token and database URLs are never visible to a renderer.

Docker's default seccomp profile blocks the user namespaces the sandbox needs, so the image sets `WEBAUDIT_CHROME_NO_SANDBOX=1` and relies on the container boundary (non-root `pwuser`, secret-free browser env). To keep the sandbox on in Docker, run the container with Playwright's seccomp profile (`--security-opt seccomp=seccomp_profile.json` from the Playwright repository) and set `WEBAUDIT_CHROME_NO_SANDBOX=0`. For hostile-at-scale use, run workers in a separate, network-restricted container with egress limited to the public internet.

## Crawl ethics and side effects

- robots.txt is honoured (5xx = disallow all, per RFC 9309); blocked URLs are recorded, never fetched.
- Default denylist skips logout, cart, checkout, admin, account and delete paths. API-supplied patterns extend it and can never replace it, and it also applies to in-browser navigations.
- Forms are read, never submitted: main-frame POST navigations are aborted. The only interaction is clicking a consent banner's "accept" button to observe post-consent tags.
- Downloads are disabled; out-of-scope navigations after load are blocked; service workers are blocked.

## Data handling

- Query parameters that look sensitive (tokens, sessions, emails, phone numbers, click IDs, analytics client IDs) are redacted before storage; cookie values are never stored; analytics beacon bodies are stored as redacted excerpts.
- Data stays in the local SQLite database and artifact folder. Nothing is sent anywhere unless you enable AI and confirm a transmission preview.

## Exposure

- `pnpm dev` and `next start` bind `127.0.0.1`. `pnpm --filter @webaudit/web start` and the container entrypoint both refuse a non-loopback bind without `WEBAUDIT_ACCESS_TOKEN`.
- **Browser-borne attacks on a local instance.** A page you visit can try to POST to `http://127.0.0.1:3000` (drive-by CSRF) or DNS-rebind its own hostname to 127.0.0.1. `apps/web/src/proxy.ts` rejects cross-site state-changing requests (Origin / `Sec-Fetch-Site`), mutating JSON routes require `Content-Type: application/json`, and without a token only loopback `Host` headers are accepted (`WEBAUDIT_ALLOWED_HOSTS` adds more).
- Security headers on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, CSP `frame-ancestors 'self'`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP.
- The container entrypoint refuses to bind a network interface without `WEBAUDIT_ACCESS_TOKEN` (≥ 16 characters) unless it runs as the read-only demo. The token is checked in constant time and exchanged for an httpOnly cookie.
- The HTML report is served with `Content-Security-Policy: default-src 'none'` and contains no scripts (stored HTML artifacts additionally get `sandbox`); CSV exports neutralise spreadsheet formula injection.
- AI calls are capped per audit (`WEBAUDIT_AI_MAX_CALLS_PER_AUDIT`, default 20) with a 120 s timeout and one retry.

Report vulnerabilities as described in [SECURITY.md](../SECURITY.md).
