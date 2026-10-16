import { createHash, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function sha1(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

/** Short stable hash, used for grouping signatures that must survive across scans (AU-06). */
export function stableHash(...parts: string[]): string {
  return sha1(parts.join("\u0000")).slice(0, 16);
}
