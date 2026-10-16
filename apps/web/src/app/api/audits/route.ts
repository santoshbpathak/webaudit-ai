import { AuditConfig, DEFAULT_DENY_PATTERNS } from "@webaudit/core";
import { listAudits } from "@webaudit/db";
import { ValidationError, createAndQueueAudit } from "@webaudit/pipeline/create";
import { isDemo, isJson, json, problem, services } from "@/lib/server";

export const dynamic = "force-dynamic";

/** GET /api/audits — recent audits (optionally ?host=). */
export function GET(req: Request) {
  const host = new URL(req.url).searchParams.get("host") ?? undefined;
  return json({ audits: listAudits(services().db, { host, limit: 200 }) });
}

/** POST /api/audits — validate and queue an audit. */
export async function POST(req: Request) {
  if (isDemo())
    return problem(403, "This is a read-only demo. Run WebAudit AI locally to audit your own site.");
  if (!isJson(req)) return problem(415, "Content-Type must be application/json");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Body must be JSON");
  }
  const parsed = AuditConfig.partial().safeParse(body);
  if (!parsed.success || !parsed.data.url)
    return problem(
      400,
      parsed.success
        ? "url is required"
        : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  // `denyPaths` and `extraDenyPaths` extend, never replace, the safe default denylist, so an
  // API caller cannot opt an audit into crawling logout/delete/cart routes.
  const extra = (body as { extraDenyPaths?: unknown }).extraDenyPaths;
  const extraDeny = Array.isArray(extra) ? extra.filter((x): x is string => typeof x === "string") : [];
  const denyPaths = [
    ...new Set([...DEFAULT_DENY_PATTERNS, ...(parsed.data.denyPaths ?? []), ...extraDeny.slice(0, 100)]),
  ];
  const rawLabel = (body as { label?: unknown }).label;
  const label = typeof rawLabel === "string" ? rawLabel.slice(0, 120) : undefined;
  const { db, queue, policy } = services();
  try {
    const audit = createAndQueueAudit(
      db,
      queue,
      policy,
      { ...parsed.data, url: parsed.data.url, denyPaths },
      label,
    );
    return json({ audit }, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return problem(400, e.message);
    throw e;
  }
}
