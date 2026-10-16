import { getAudit, listFindings } from "@webaudit/db";
import { findingsToCsv, loadReportData, renderHtml, renderJson, renderMarkdown } from "@webaudit/report";
import { problem, services } from "@/lib/server";

export const dynamic = "force-dynamic";

const TYPES = {
  html: "text/html; charset=utf-8",
  json: "application/json",
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
} as const;

/** GET /api/audits/:id/report?format=html|json|csv|md[&all=1][&download=1] */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const format = (sp.get("format") ?? "html") as keyof typeof TYPES;
  if (!(format in TYPES)) return problem(400, "format must be html, json, csv or md");
  const { db } = services();
  const audit = getAudit(db, id);
  if (!audit) return problem(404, "Audit not found");
  const data = loadReportData(db, id);
  const body =
    format === "html"
      ? renderHtml(data, {
          artifactUrl: (ref) => `/api/audits/${id}/artifacts/by-path?path=${encodeURIComponent(ref)}`,
        })
      : format === "json"
        ? renderJson(data)
        : format === "csv"
          ? findingsToCsv(sp.get("all") ? listFindings(db, id) : data.failures)
          : renderMarkdown(data);
  const name = `webaudit-${audit.host}-${id.slice(4, 12)}.${format === "md" ? "md" : format}`;
  return new Response(body, {
    headers: {
      "content-type": TYPES[format],
      ...(sp.get("download") || format === "csv"
        ? { "content-disposition": `attachment; filename="${name}"` }
        : {}),
      // The HTML report is self-contained; forbid scripts entirely.
      ...(format === "html"
        ? { "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:" }
        : {}),
    },
  });
}
