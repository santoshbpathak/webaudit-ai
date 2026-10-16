import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./artifacts";

describe("LocalArtifactStore", () => {
  it("deletes all artifacts of an audit and rejects traversal", async () => {
    const root = mkdtempSync(join(tmpdir(), "wa-art-"));
    const store = new LocalArtifactStore(root);
    await store.put("aud_1", "shot-a.jpg", Buffer.from("x"));
    await store.put("aud_2", "report.html", "<p>keep</p>");
    await store.removeAudit("aud_1");
    expect(existsSync(join(root, "aud_1"))).toBe(false);
    expect(existsSync(join(root, "aud_2", "report.html"))).toBe(true);
    await store.removeAudit("aud_1"); // idempotent
    await expect(store.removeAudit("../aud_2")).rejects.toThrow(/Invalid/);
    await expect(store.get("../outside.txt")).rejects.toThrow(/traversal/);
  });
});
