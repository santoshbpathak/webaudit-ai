import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { LighthouseSummary } from "@webaudit/core";
import { browserEnv } from "@webaudit/safety";

export interface LighthouseOptions {
  url: string;
  chromePath: string;
  /** Guard proxy URL — Lighthouse's Chrome must go through it too. */
  proxyUrl: string;
  formFactor: "mobile" | "desktop";
  timeoutMs: number;
  reportPath?: string;
  signal?: AbortSignal;
}

const RUNNER = fileURLToPath(new URL("./lh-runner.ts", import.meta.url));

/**
 * Run Lighthouse in an isolated child process. Lighthouse is not safe to run
 * concurrently in one process and can hang on hostile pages, so each run gets its own
 * process and a hard timeout. Never throws: failures come back as { error } (T08).
 */
export function runLighthouse(opts: LighthouseOptions): Promise<LighthouseSummary | { error: string }> {
  return new Promise((resolve) => {
    const input = JSON.stringify({
      url: opts.url,
      chromePath: opts.chromePath,
      proxyUrl: opts.proxyUrl,
      formFactor: opts.formFactor,
      reportPath: opts.reportPath,
      noSandbox: process.env.WEBAUDIT_CHROME_NO_SANDBOX === "1",
    });
    const child = spawn(process.execPath, ["--no-warnings", RUNNER, input], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      // Allowlisted env: the runner and its Chrome never see API keys or tokens.
      env: { ...browserEnv(), NODE_OPTIONS: "" },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr = (stderr + d.toString()).slice(-2_000)));

    const finish = (r: LighthouseSummary | { error: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      resolve(r);
    };
    const kill = () => {
      try {
        // Negative pid = whole process group (runner + anything it spawned).
        if (child.pid) process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM");
      } catch {
        /* exited */
      }
      setTimeout(() => {
        try {
          if (child.pid && child.exitCode === null)
            process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL");
        } catch {
          /* exited */
        }
      }, 3_000).unref();
    };
    const timer = setTimeout(() => {
      kill();
      finish({ error: `Lighthouse timed out after ${Math.round(opts.timeoutMs / 1000)}s` });
    }, opts.timeoutMs);
    const onAbort = () => {
      kill();
      finish({ error: "Cancelled" });
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (e) => finish({ error: `Could not start Lighthouse: ${e.message}` }));
    child.on("close", (code) => {
      const line = stdout.trim().split("\n").pop() ?? "";
      try {
        const parsed = JSON.parse(line) as
          | ({ ok: true; runtimeError?: string } & Omit<LighthouseSummary, "reportRef">)
          | { ok: false; error: string };
        if (!parsed.ok) return finish({ error: parsed.error.slice(0, 300) });
        if (parsed.runtimeError) return finish({ error: `Lighthouse runtime error: ${parsed.runtimeError}` });
        finish({
          version: parsed.version,
          performanceScore: parsed.performanceScore,
          metrics: parsed.metrics,
          renderBlocking: parsed.renderBlocking,
          reportRef: opts.reportPath,
        });
      } catch {
        finish({
          error: `Lighthouse exited (${code}) without a result. ${stderr.split("\n").slice(-3).join(" ").slice(0, 300)}`,
        });
      }
    });
  });
}
