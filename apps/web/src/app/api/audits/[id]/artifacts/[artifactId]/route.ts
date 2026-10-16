import { getArtifact } from "@webaudit/db";
import { problem, services } from "@/lib/server";

/** GET /api/audits/:id/artifacts/:artifactId  or  /artifacts/by-path?path=<auditId>/<file> */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; artifactId: string }> }) {
  const { id, artifactId } = await params;
  const { db, artifacts } = services();
  let path: string | undefined;
  let type = "application/octet-stream";
  if (artifactId === "by-path") {
    path = new URL(req.url).searchParams.get("path") ?? undefined;
    if (!path?.startsWith(`${id}/`)) return problem(400, "Invalid path");
    type = path.endsWith(".jpg") ? "image/jpeg" : path.endsWith(".json") ? "application/json" : type;
  } else {
    const a = getArtifact(db, artifactId);
    if (!a || a.auditId !== id) return problem(404, "Artifact not found");
    path = a.path;
    type = a.contentType;
  }
  try {
    const buf = await artifacts.get(path);
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": type,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        // Stored reports contain crawled text. Even though it is escaped, serve HTML
        // artifacts with no script execution and an opaque origin (defence in depth).
        ...(type.startsWith("text/html")
          ? {
              "content-security-policy":
                "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox",
            }
          : {}),
      },
    });
  } catch {
    return problem(404, "Artifact file missing");
  }
}
