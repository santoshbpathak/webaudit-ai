import { access, constants, mkdir } from "node:fs/promises";
import { arch, cpus, freemem, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { ENGINE_VERSION } from "@webaudit/core";
import { defaultDataDir, defaultDbPath, listAudits, listEvents, openDb } from "@webaudit/db";
import { redactText } from "@webaudit/safety";

export interface DoctorReport {
  generatedAt: string;
  version: string;
  system: Record<string, string | number>;
  checks: { name: string; ok: boolean; detail?: string }[];
  recentErrors: { auditId: string; at: string; message: string }[];
}

/** Environment checks plus a redacted bundle of recent audit errors (PRD §8 observability). */
export async function doctor(dataDir?: string): Promise<DoctorReport> {
  if (dataDir) process.env.WEBAUDIT_DATA_DIR = resolve(dataDir);
  const checks: DoctorReport["checks"] = [];
  const [major, minor] = process.versions.node.split(".").map(Number) as [number, number];
  checks.push({
    name: `Node.js ${process.versions.node}`,
    ok: major > 22 || (major === 22 && minor >= 19),
    detail: "requires ≥ 22.19",
  });

  const dir = defaultDataDir();
  try {
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
    checks.push({ name: `Data directory writable`, ok: true, detail: dir });
  } catch (e) {
    checks.push({ name: `Data directory writable`, ok: false, detail: (e as Error).message });
  }

  let recentErrors: DoctorReport["recentErrors"] = [];
  try {
    const db = openDb(defaultDbPath());
    checks.push({ name: "SQLite database opens and migrates", ok: true, detail: defaultDbPath() });
    recentErrors = listAudits(db, { limit: 10 }).flatMap((a) =>
      listEvents(db, a.id, 0, 2_000)
        .filter((e) => e.level === "error")
        .slice(-5)
        .map((e) => ({ auditId: a.id, at: e.at, message: redactText(e.message) })),
    );
  } catch (e) {
    checks.push({ name: "SQLite database opens and migrates", ok: false, detail: (e as Error).message });
  }

  try {
    const path = chromium.executablePath();
    await access(path, constants.X_OK);
    checks.push({ name: "Playwright Chromium installed", ok: true });
  } catch {
    checks.push({
      name: "Playwright Chromium installed",
      ok: false,
      detail: "run: npx playwright install chromium",
    });
  }

  const allow = process.env.WEBAUDIT_ALLOW_PRIVATE_HOSTS;
  checks.push({
    name: "Safety allowlist",
    ok: true,
    detail: allow ? `ACTIVE for ${allow} (development only)` : "off (private networks blocked)",
  });

  return {
    generatedAt: new Date().toISOString(),
    version: ENGINE_VERSION,
    system: {
      platform: platform(),
      release: release(),
      arch: arch(),
      cpus: cpus().length,
      totalMemMB: Math.round(totalmem() / 1048576),
      freeMemMB: Math.round(freemem() / 1048576),
      node: process.version,
    },
    checks,
    recentErrors,
  };
}
