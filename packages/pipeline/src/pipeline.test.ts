import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getAudit,
  listFindings,
  listGroups,
  openDb,
  requestCancel,
  computeCoverage,
  type Db,
} from "@webaudit/db";
import { SqliteJobQueue } from "@webaudit/queue";
import { policyFromEnv } from "@webaudit/safety";
import {
  CLEAN,
  PLANTED,
  ROBOTS_BLOCKED,
  startFixtureServer,
  type FixtureServer,
} from "@webaudit/fixture-site";
import { LocalArtifactStore } from "./artifacts";
import { runAudit } from "./run";
import { createAndQueueAudit } from "./create";

const policy = { ...policyFromEnv({}), allowHosts: ["127.0.0.1"] };

describe("end-to-end audit of the fixture site (AI disabled — T13)", () => {
  let fx: FixtureServer;
  let db: Db;
  let artifacts: LocalArtifactStore;
  let auditId: string;
  let dir: string;

  beforeAll(async () => {
    fx = await startFixtureServer();
    db = openDb(":memory:");
    dir = mkdtempSync(join(tmpdir(), "webaudit-test-"));
    artifacts = new LocalArtifactStore(dir);
    const audit = createAndQueueAudit(db, new SqliteJobQueue(db), policy, {
      url: fx.origin + "/",
      mode: "smart",
      perHostDelayMs: 0,
      sampleSize: 20,
      lighthouseMaxPages: 1,
    });
    auditId = audit.id;
    fx.requests.length = 0;
    await runAudit(auditId, { db, artifacts, policy, offlineExternal: true });
  }, 240_000);
  afterAll(() => fx.close());

  it("completes with an honest status and full coverage accounting", () => {
    const a = getAudit(db, auditId)!;
    expect(a.error).toBeNull();
    expect(a.status).toBe("completed");
    const c = computeCoverage(db, auditId);
    expect(c.checked + c.blockedRobots + c.skipped + c.failed + c.queued + c.attempted).toBe(c.discovered);
    expect(c.queued).toBe(0);
    expect(c.sampled).toBeGreaterThan(5);
    expect(a.engineVersions).toMatchObject({
      lighthouse: expect.any(String),
      "axe-core": expect.any(String),
    });
  });

  it.each(PLANTED.map((p) => [p.path, p.ruleId, p.note] as const))(
    "detects planted defect %s → %s (%s)",
    (path, ruleId) => {
      const fs = listFindings(db, auditId, { ruleId, status: ["fail"] });
      expect(fs.map((f) => new URL(f.url).pathname)).toContain(path);
    },
  );

  it.each(CLEAN.map((c) => [c.path, c.ruleId] as const))(
    "does not flag clean control %s → %s",
    (path, ruleId) => {
      const fs = listFindings(db, auditId, { ruleId, status: ["fail"] });
      expect(fs.map((f) => new URL(f.url).pathname)).not.toContain(path);
    },
  );

  it("T05: never requests robots-disallowed URLs", () => {
    for (const p of ROBOTS_BLOCKED) expect(fx.requests).not.toContain(p);
  });

  it("T11: never submits forms", () => {
    expect(fx.requests.some((r) => r.startsWith("/api/"))).toBe(false);
  });

  it("groups findings into prioritized issue groups", () => {
    const groups = listGroups(db, auditId);
    expect(groups.length).toBeGreaterThan(10);
    for (let i = 1; i < groups.length; i++)
      expect(groups[i - 1]!.priority).toBeGreaterThanOrEqual(groups[i]!.priority);
  });

  it("writes HTML, JSON and CSV reports with evidence", () => {
    const html = readFileSync(join(dir, auditId, "report.html"), "utf8");
    expect(html).toContain("Prioritized backlog");
    expect(html).toContain("M01-META-DESC-MISSING");
    const json = JSON.parse(readFileSync(join(dir, auditId, "report.json"), "utf8"));
    expect(json.format).toBe("webaudit-report");
    expect(json.findings.length).toBeGreaterThan(20);
    const csv = readFileSync(join(dir, auditId, "findings.csv"), "utf8");
    expect(csv.split("\r\n")[0]).toContain("finding_id,rule_id");
    expect(existsSync(join(dir, auditId, "summary.md"))).toBe(true);
  });

  it("T07: browser findings have sampled denominators, HTTP findings cover all checked pages", () => {
    const c = computeCoverage(db, auditId);
    const all = listFindings(db, auditId);
    const tested = (rule: string) =>
      all.filter((f) => f.ruleId === rule && (f.status === "pass" || f.status === "fail")).length;
    expect(tested("M07-HORIZONTAL-OVERFLOW")).toBeLessThanOrEqual(c.sampled);
    expect(tested("M02-LH-PERFORMANCE")).toBe(1); // lighthouseMaxPages = 1
    expect(
      all.filter((f) => f.ruleId === "M02-LH-PERFORMANCE" && f.status === "not_tested").length,
    ).toBeGreaterThan(0);
  });
});

describe("failure and cancellation behaviour", () => {
  let fx: FixtureServer;
  beforeAll(async () => {
    fx = await startFixtureServer({ largePages: 300 });
  });
  afterAll(() => fx.close());

  it("T12: cancelling an active crawl stops it and labels the result partial", async () => {
    const db = openDb(":memory:");
    const artifacts = new LocalArtifactStore(mkdtempSync(join(tmpdir(), "webaudit-test-")));
    const audit = createAndQueueAudit(db, new SqliteJobQueue(db), policy, {
      url: fx.origin + "/",
      perHostDelayMs: 20,
      httpConcurrency: 2,
      lighthouse: false,
    });
    const run = runAudit(audit.id, { db, artifacts, policy, offlineExternal: true });
    await new Promise((r) => setTimeout(r, 1_500));
    requestCancel(db, audit.id);
    const status = await run;
    expect(status).toBe("cancelled_partial");
    const c = computeCoverage(db, audit.id);
    expect(c.skipped).toBeGreaterThan(0);
    expect(c.queued).toBe(0);
  }, 120_000);

  it("T06: an audit starting at a redirect into private space fails safely", async () => {
    const db = openDb(":memory:");
    const artifacts = new LocalArtifactStore(mkdtempSync(join(tmpdir(), "webaudit-test-")));
    const audit = createAndQueueAudit(db, new SqliteJobQueue(db), policy, {
      url: fx.origin + "/redirect-private",
      mode: "quick",
      lighthouse: false,
    });
    await runAudit(audit.id, { db, artifacts, policy, offlineExternal: true });
    const fs = listFindings(db, audit.id);
    expect(fs.every((f) => !f.evidence.requestUrl?.includes("169.254"))).toBe(true);
    const a = getAudit(db, audit.id)!;
    expect(["completed", "completed_partial"]).toContain(a.status);
    expect(computeCoverage(db, audit.id).failed).toBe(1);
  }, 120_000);
});
