/**
 * Lighthouse child-process runner. Executed directly by Node (built-in type stripping),
 * so it must stay self-contained: no relative imports, erasable TypeScript only.
 * Input: JSON in argv[2]. Output: one JSON line on stdout.
 */
import { writeFileSync } from "node:fs";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

interface RunnerInput {
  url: string;
  chromePath: string;
  proxyUrl: string;
  formFactor: "mobile" | "desktop";
  reportPath?: string;
  noSandbox?: boolean;
}

const input = JSON.parse(process.argv[2] ?? "{}") as RunnerInput;

const flags = [
  "--headless=new",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--disable-background-networking",
  "--disable-component-update",
  `--proxy-server=${input.proxyUrl}`,
  // Chrome bypasses proxies for loopback by default; force it through the guard proxy.
  "--proxy-bypass-list=<-loopback>",
  // WebRTC UDP bypasses HTTP proxies; keep it from reaching internal hosts.
  "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  "--webrtc-ip-handling-policy=disable_non_proxied_udp",
];
if (input.noSandbox) flags.push("--no-sandbox");

const chrome = await chromeLauncher.launch({
  chromePath: input.chromePath,
  chromeFlags: flags,
  logLevel: "silent",
});
const cleanup = () => {
  try {
    chrome.kill();
  } catch {
    /* already gone */
  }
};
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  const desktop = input.formFactor === "desktop";
  const result = await lighthouse(
    input.url,
    { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] },
    {
      extends: "lighthouse:default",
      settings: {
        formFactor: input.formFactor,
        screenEmulation: desktop
          ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
          : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        throttlingMethod: "simulate",
        maxWaitForLoad: 45_000,
      },
    },
  );
  if (!result) throw new Error("Lighthouse returned no result");
  const lhr = result.lhr;
  if (input.reportPath) writeFileSync(input.reportPath, JSON.stringify(lhr));
  const num = (id: string) => {
    const v = lhr.audits[id]?.numericValue;
    return typeof v === "number" ? Math.round(v * 1000) / 1000 : undefined;
  };
  // Lighthouse 13 replaced render-blocking-resources with render-blocking-insight.
  const rb = (lhr.audits["render-blocking-insight"] ?? lhr.audits["render-blocking-resources"])?.details as
    { items?: { url: string; wastedMs?: number }[] } | undefined;
  const out = {
    ok: true,
    version: lhr.lighthouseVersion,
    runtimeError: lhr.runtimeError?.message,
    performanceScore: lhr.categories.performance?.score ?? null,
    metrics: {
      lcpMs: num("largest-contentful-paint"),
      cls: num("cumulative-layout-shift"),
      tbtMs: num("total-blocking-time"),
      fcpMs: num("first-contentful-paint"),
      speedIndexMs: num("speed-index"),
      totalByteWeight: num("total-byte-weight"),
    },
    renderBlocking: (rb?.items ?? [])
      .slice(0, 10)
      .map((i) => ({ url: i.url, wastedMs: Math.round(i.wastedMs ?? 0) })),
  };
  process.stdout.write(JSON.stringify(out) + "\n");
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, error: (e as Error).message }) + "\n");
} finally {
  cleanup();
}
