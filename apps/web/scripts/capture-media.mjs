// Records the README walkthrough from a real running instance: production build, a real
// worker, and the bundled synthetic Fernhill fixture (no third-party site is audited).
//   pnpm --filter @webaudit/web build && node apps/web/scripts/capture-media.mjs
// Outputs docs/images/walkthrough.{webm,gif} and docs/images/report.png (needs ffmpeg for GIF).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "../../..");
const out = join(root, "docs/images");
const data = mkdtempSync(join(tmpdir(), "webaudit-capture-"));
const videoDir = mkdtempSync(join(tmpdir(), "webaudit-video-"));
const WEB = 3351;
const FIX = 4351;
const env = { ...process.env, WEBAUDIT_DATA_DIR: data, WEBAUDIT_ALLOW_PRIVATE_HOSTS: "127.0.0.1" };

const procs = [
  spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(WEB)],
    {
      cwd: join(root, "apps/web"),
      env,
      stdio: "ignore",
    },
  ),
  spawn(process.execPath, ["apps/cli/bin/webaudit.js", "worker"], { cwd: root, env, stdio: "ignore" }),
  spawn(process.execPath, ["--import", "tsx", "fixtures/site/src/cli.ts"], {
    cwd: root,
    env: { ...process.env, FIXTURE_PORT: String(FIX) },
    stdio: "ignore",
  }),
];
const stop = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("exit", stop);

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

await waitFor(`http://127.0.0.1:${WEB}/api/health`);
await waitFor(`http://127.0.0.1:${FIX}/`);

const browser = await chromium.launch();
const size = { width: 1280, height: 800 };
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size } });
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const base = `http://127.0.0.1:${WEB}`;

// 1. Submit a URL.
await page.goto(base + "/");
await pause(1200);
await page.getByLabel("Website URL").pressSequentially(`http://127.0.0.1:${FIX}/`, { delay: 40 });
await page.getByText("Advanced crawler controls").click();
await page.getByLabel("Delay (ms)").fill("0");
await page.getByLabel("Lighthouse pages").fill("1");
await pause(800);
await page.getByRole("button", { name: "Start audit" }).click();

// 2. Live crawl → overview.
await page.waitForURL(/\/audits\/aud_/);
await page.getByText("Scope & coverage").waitFor({ timeout: 300_000 });
await pause(2500);
await page.mouse.wheel(0, 600);
await pause(1500);

const nav = (name) =>
  page
    .getByRole("navigation", { name: "Audit sections" })
    .getByRole("link", { name: new RegExp(`^${name}`) })
    .click();

// 3. Issue explorer → evidence.
await nav("Issues");
const rows = page.getByRole("table", { name: /issue types/i }).locator("tbody tr");
await rows.first().waitFor();
await pause(1500);
await rows.first().getByRole("button").last().click();
await page.getByRole("dialog").getByText("Why it matters").waitFor();
await pause(2500);
await page.keyboard.press("Escape");

// 4. Page inspector.
await page.goto(page.url().replace(/\/issues.*$/, "/pages?sort=failures"));
await page
  .getByRole("table", { name: /discovered urls/i })
  .locator("tbody tr a")
  .first()
  .click();
await page.getByText("Technical summary").waitFor();
await pause(2500);

// 5. Recommendations and export.
await nav("Recommendations");
await page.getByRole("table", { name: /remediation backlog/i }).waitFor();
await pause(2000);
await nav("Export");
await page.getByTitle("HTML report preview").waitFor();
await pause(2500);

await ctx.close();
const video = readdirSync(videoDir).find((f) => f.endsWith(".webm"));
renameSync(join(videoDir, video), join(out, "walkthrough.webm"));

// Exported HTML report, as a reader receives it.
const rp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await rp.goto("file://" + join(root, "examples/fernhill/report.html"));
await rp.screenshot({ path: join(out, "report.png") });
await browser.close();
stop();

// 1.5× speed, 8 fps, 960 px wide, palette-optimised GIF.
execFileSync("ffmpeg", [
  "-y",
  "-i",
  join(out, "walkthrough.webm"),
  "-vf",
  "setpts=PTS/1.5,fps=8,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
  join(out, "walkthrough.gif"),
]);
rmSync(data, { recursive: true, force: true });
rmSync(videoDir, { recursive: true, force: true });
console.log("Wrote docs/images/walkthrough.webm, walkthrough.gif, report.png");
