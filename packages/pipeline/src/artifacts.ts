import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { defaultDataDir } from "@webaudit/db";

/**
 * Where screenshots, Lighthouse reports and exports live. Local filesystem by default;
 * an S3-compatible implementation can satisfy the same contract for cloud deployments.
 */
export interface ArtifactStore {
  put(auditId: string, name: string, data: Buffer | string): Promise<{ path: string; bytes: number }>;
  get(path: string): Promise<Buffer>;
  /** Local filesystem path for engines that write files themselves (Lighthouse). */
  localPath(auditId: string, name: string): Promise<string>;
  /** Delete every artifact of an audit (screenshots, reports). Idempotent. */
  removeAudit(auditId: string): Promise<void>;
}

export class LocalArtifactStore implements ArtifactStore {
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }

  private safe(auditId: string, name: string): string {
    if (!/^[\w-]+$/.test(auditId) || !/^[\w.-]+$/.test(name)) throw new Error("Invalid artifact name");
    return join(auditId, name);
  }

  async put(auditId: string, name: string, data: Buffer | string) {
    const rel = this.safe(auditId, name);
    await mkdir(join(this.root, auditId), { recursive: true });
    const buf = typeof data === "string" ? Buffer.from(data) : data;
    await writeFile(join(this.root, rel), buf);
    return { path: rel, bytes: buf.length };
  }

  async get(path: string): Promise<Buffer> {
    const full = resolve(this.root, normalize(path));
    if (!full.startsWith(this.root + sep)) throw new Error("Path traversal blocked");
    return readFile(full);
  }

  async removeAudit(auditId: string): Promise<void> {
    if (!/^[\w-]+$/.test(auditId)) throw new Error("Invalid audit id");
    await rm(join(this.root, auditId), { recursive: true, force: true });
  }

  async localPath(auditId: string, name: string): Promise<string> {
    const rel = this.safe(auditId, name);
    await mkdir(join(this.root, auditId), { recursive: true });
    return join(this.root, rel);
  }
}

export function defaultArtifactRoot(): string {
  return join(defaultDataDir(), "artifacts");
}
