import { describe, expect, it } from "vitest";
import { resolveConfig } from "@webaudit/core";
import { openDb } from "./connection";
import {
  computeCoverage,
  createAudit,
  getAudit,
  insertDiscovered,
  insertFindings,
  listFindings,
  requestCancel,
  ruleCoverage,
  updateAudit,
  updateUrl,
} from "./repo";

const fresh = () => openDb(":memory:");
const ts = () => new Date().toISOString();

describe("db repo", () => {
  it("migrates and creates an audit", () => {
    const db = fresh();
    const a = createAudit(db, resolveConfig({ url: "https://example.com/" }));
    expect(getAudit(db, a.id)?.status).toBe("queued");
    expect(a.host).toBe("example.com");
  });

  it("dedupes discovered URLs and reconciles coverage from the ledger", () => {
    const db = fresh();
    const a = createAudit(db, resolveConfig({ url: "https://example.com/" }));
    const base = {
      auditId: a.id,
      depth: 0,
      state: "queued" as const,
      discoveredAt: ts(),
      source: "link" as const,
    };
    const n1 = insertDiscovered(db, [
      { ...base, url: "https://example.com/", originalUrl: "https://example.com/" },
      { ...base, url: "https://example.com/a", originalUrl: "https://example.com/a?utm_source=x" },
    ]);
    const n2 = insertDiscovered(db, [
      { ...base, url: "https://example.com/a", originalUrl: "https://example.com/a" },
    ]);
    expect(n1).toBe(2);
    expect(n2).toBe(0);
    updateUrl(db, a.id, "https://example.com/", { state: "checked" });
    updateUrl(db, a.id, "https://example.com/a", { state: "blocked_robots", reason: "Disallow: /a" });
    const c = computeCoverage(db, a.id);
    expect(c.discovered).toBe(2);
    expect(c.checked).toBe(1);
    expect(c.blockedRobots).toBe(1);
    expect(c.checked + c.blockedRobots + c.failed + c.skipped + c.queued + c.attempted).toBe(c.discovered);
  });

  it("computes per-rule denominators from stored statuses", () => {
    const db = fresh();
    const a = createAudit(db, resolveConfig({ url: "https://example.com/" }));
    const mk = (i: number, status: "pass" | "fail" | "not_tested") => ({
      findingId: `f${i}`,
      ruleId: "M01-TITLE-MISSING",
      auditId: a.id,
      url: `https://example.com/${i}`,
      module: "M01" as const,
      status,
      severity: "high" as const,
      confidence: "verified" as const,
      observedAt: ts(),
      engineVersion: "test",
      evidence: { reproSteps: [] },
      recommendedAction: "Add a title",
      applicability: "HTML pages",
    });
    insertFindings(db, [mk(1, "fail"), mk(2, "pass"), mk(3, "not_tested")]);
    const [cov] = ruleCoverage(db, a.id);
    expect(cov).toMatchObject({ tested: 2, failed: 1, notTested: 1 });
    expect(listFindings(db, a.id, { status: ["fail"] })).toHaveLength(1);
  });

  it("cancels queued audits immediately and running audits cooperatively", () => {
    const db = fresh();
    const q = createAudit(db, resolveConfig({ url: "https://example.com/" }));
    expect(requestCancel(db, q.id)).toBe(true);
    expect(getAudit(db, q.id)?.status).toBe("cancelled_partial");
    const r = createAudit(db, resolveConfig({ url: "https://example.com/" }));
    updateAudit(db, r.id, { status: "running" });
    requestCancel(db, r.id);
    expect(getAudit(db, r.id)).toMatchObject({ status: "cancelling", cancelRequested: true });
  });
});
