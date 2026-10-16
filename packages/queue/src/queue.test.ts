import { describe, expect, it } from "vitest";
import { openDb } from "@webaudit/db";
import { SqliteJobQueue } from "./index";

describe("SqliteJobQueue", () => {
  it("leases each job to exactly one worker", () => {
    const q = new SqliteJobQueue(openDb(":memory:"));
    q.enqueue("audit.run", { auditId: "a1" });
    const j1 = q.lease("w1", ["audit.run"], 60_000);
    const j2 = q.lease("w2", ["audit.run"], 60_000);
    expect(j1?.payload).toEqual({ auditId: "a1" });
    expect(j2).toBeNull();
  });

  it("re-leases a job whose lease expired (crashed worker)", () => {
    const q = new SqliteJobQueue(openDb(":memory:"));
    q.enqueue("audit.run", { auditId: "a1" }, { maxAttempts: 3 });
    expect(q.lease("w1", ["audit.run"], -1)).not.toBeNull(); // lease already expired
    const again = q.lease("w2", ["audit.run"], 60_000);
    expect(again?.attempts).toBe(2);
    expect(q.heartbeat(again!.id, "w1", 60_000)).toBe(false);
    expect(q.heartbeat(again!.id, "w2", 60_000)).toBe(true);
  });

  it("retries then fails permanently when attempts are exhausted", () => {
    const q = new SqliteJobQueue(openDb(":memory:"));
    q.enqueue("audit.run", { auditId: "a1" }, { maxAttempts: 2 });
    const a = q.lease("w1", ["audit.run"], 60_000)!;
    expect(q.fail(a.id, "w1", "boom", 0)).toBe(true);
    const b = q.lease("w1", ["audit.run"], 60_000)!;
    expect(q.fail(b.id, "w1", "boom again", 0)).toBe(false);
    expect(q.lease("w1", ["audit.run"], 60_000)).toBeNull();
    expect(q.stats()).toEqual({ failed: 1 });
  });

  it("completes jobs", () => {
    const q = new SqliteJobQueue(openDb(":memory:"));
    q.enqueue("audit.run", { auditId: "a1" });
    const j = q.lease("w1", ["audit.run"], 60_000)!;
    q.complete(j.id, "w1");
    expect(q.stats()).toEqual({ done: 1 });
  });
});
