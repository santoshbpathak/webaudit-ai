import { NextResponse, type NextRequest } from "next/server";
import { checkRequest, parseAllowedHosts } from "./lib/request-guard";

/**
 * Access gate. Local installs (bound to 127.0.0.1) need no token. Any network-exposed
 * deployment sets WEBAUDIT_ACCESS_TOKEN; the Docker entrypoint refuses to bind 0.0.0.0
 * without it. Accepts `Authorization: Bearer <token>`, the session cookie, or a one-time
 * `?token=` that is exchanged for an httpOnly cookie.
 */
const COOKIE = "webaudit_token";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function proxy(req: NextRequest) {
  const token = process.env.WEBAUDIT_ACCESS_TOKEN;
  const guard = checkRequest({
    method: req.method,
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    tokenConfigured: !!token,
    demo: process.env.WEBAUDIT_DEMO === "1",
    allowedHosts: parseAllowedHosts(process.env.WEBAUDIT_ALLOWED_HOSTS),
  });
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });
  if (!token) return NextResponse.next();
  const { pathname, searchParams } = req.nextUrl;
  if (pathname === "/api/health") return NextResponse.next();

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cookie = req.cookies.get(COOKIE)?.value;
  const query = searchParams.get("token");
  if ((bearer && safeEqual(bearer, token)) || (cookie && safeEqual(cookie, token)))
    return NextResponse.next();

  if (query && safeEqual(query, token)) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("token");
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      // Behind a TLS-terminating proxy the app sees http:, so trust x-forwarded-proto too.
      secure:
        req.nextUrl.protocol === "https:" ||
        req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>WebAudit AI</title><body style="font-family:system-ui;max-width:420px;margin:15vh auto;padding:0 16px">
<h1>Access token required</h1><p>This WebAudit AI instance is protected. Open it with <code>?token=…</code>.</p></body>`,
    { status: 401, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
