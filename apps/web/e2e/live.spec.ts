import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/** End to end: submit the form → live crawl view → finished overview, with a real worker. */
let worker: ChildProcess | undefined;

test.beforeAll(() => {
  const root = resolve(import.meta.dirname, "../../..");
  worker = spawn(process.execPath, ["apps/cli/bin/webaudit.js", "worker"], {
    cwd: root,
    env: {
      ...process.env,
      WEBAUDIT_DATA_DIR: process.env.E2E_LIVE_DATA,
      WEBAUDIT_ALLOW_PRIVATE_HOSTS: "127.0.0.1",
    },
    stdio: "ignore",
  });
});
test.afterAll(() => {
  worker?.kill("SIGTERM");
});

test("new audit → live crawl → overview", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await page.getByLabel("Website URL").fill("http://127.0.0.1:4333/");
  await page.getByText("Advanced crawler controls").click();
  await page.getByLabel("Delay (ms)").fill("0");
  await page.getByLabel("Lighthouse pages").fill("0");
  await page.getByRole("button", { name: "Start audit" }).click();

  await expect(page).toHaveURL(/\/audits\/aud_/);
  await expect(page.getByLabel("Audit phases")).toBeVisible();
  await expect(page.getByText("Crawl log")).toBeVisible();

  await expect(page.getByText("Scope & coverage")).toBeVisible({ timeout: 200_000 });
  await expect(page.getByText(/issue types \(\d+ template-level groups\)/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Audit sections" })
    .getByRole("link", { name: /^Issues/ })
    .click();
  await expect(page.getByText("Missing meta description")).toBeVisible();
});

test("an unsafe URL is rejected with a clear message", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website URL").fill("http://169.254.169.254/latest/meta-data/");
  await page.getByRole("button", { name: "Start audit" }).click();
  await expect(page.locator("#url-error")).toContainText(/not public/i);
});
