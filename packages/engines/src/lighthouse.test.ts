import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { policyFromEnv, startGuardProxy, type GuardProxy } from "@webaudit/safety";
import { startFixtureServer, type FixtureServer } from "@webaudit/fixture-site";
import { runLighthouse } from "./lighthouse";

describe("runLighthouse (child process)", () => {
  let fx: FixtureServer;
  let proxy: GuardProxy;
  beforeAll(async () => {
    fx = await startFixtureServer();
    proxy = await startGuardProxy({ policy: { ...policyFromEnv({}), allowHosts: ["127.0.0.1"] } });
  });
  afterAll(async () => {
    await proxy.close();
    await fx.close();
  });

  it("returns lab metrics for a page through the guard proxy", async () => {
    const r = await runLighthouse({
      url: `${fx.origin}/pricing`,
      chromePath: chromium.executablePath(),
      proxyUrl: proxy.url,
      formFactor: "mobile",
      timeoutMs: 120_000,
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.version).toMatch(/^\d+\./);
    expect(r.performanceScore).not.toBeNull();
    expect(r.metrics.lcpMs).toBeGreaterThan(0);
    expect(r.renderBlocking.some((b) => b.url.includes("blocking.js"))).toBe(true);
  }, 150_000);

  it("T08: times out cleanly and reports a reason instead of throwing", async () => {
    const r = await runLighthouse({
      url: `${fx.origin}/`,
      chromePath: chromium.executablePath(),
      proxyUrl: proxy.url,
      formFactor: "mobile",
      timeoutMs: 1_500,
    });
    expect(r).toEqual({ error: expect.stringMatching(/timed out/) });
  }, 30_000);
});
