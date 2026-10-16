import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Two servers: a read-only demo instance over the committed sample audits, and a live
 * instance (fresh data dir) that audits the local fixture site end to end.
 * Run `pnpm --filter @webaudit/web build` first.
 */
const root = resolve(import.meta.dirname, "../..");
const liveData = process.env.E2E_LIVE_DATA ?? mkdtempSync(join(tmpdir(), "webaudit-e2e-"));
process.env.E2E_LIVE_DATA = liveData;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "demo", testMatch: /demo\.spec\.ts/, use: { baseURL: "http://127.0.0.1:3341" } },
    { name: "live", testMatch: /live\.spec\.ts/, use: { baseURL: "http://127.0.0.1:3342" } },
  ],
  webServer: [
    {
      command: "node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3341",
      url: "http://127.0.0.1:3341/api/health",
      env: { WEBAUDIT_DEMO: "1", WEBAUDIT_DATA_DIR: join(root, "examples/demo-data") },
      reuseExistingServer: false,
    },
    {
      command: "node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3342",
      url: "http://127.0.0.1:3342/api/health",
      env: { WEBAUDIT_DATA_DIR: liveData, WEBAUDIT_ALLOW_PRIVATE_HOSTS: "127.0.0.1" },
      reuseExistingServer: false,
    },
    {
      command: "node --import tsx fixtures/site/src/cli.ts",
      cwd: root,
      port: 4333,
      env: { FIXTURE_PORT: "4333" },
      reuseExistingServer: false,
    },
  ],
});
