// Regenerates examples/ from the Fernhill fixture site: two audits (baseline, then the
// site with 60 extra generated pages) so the demo shows reports, history and compare.
// Usage: pnpm examples
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = join(root, "examples", "demo-data");
const port = 4321; // not on the Fetch-spec "bad ports" list (4190 is)

function fixture(large) {
  const child = spawn(process.execPath, ["--import", "tsx", "fixtures/site/src/cli.ts"], {
    cwd: root,
    env: { ...process.env, FIXTURE_PORT: String(port), FIXTURE_LARGE: String(large) },
    stdio: "ignore",
  });
  return new Promise((r) => setTimeout(() => r(child), 1500));
}

function audit(extra = []) {
  const res = spawnSync(
    process.execPath,
    [
      "apps/cli/bin/webaudit.js",
      "--data-dir",
      dataDir,
      "--allow-private-host",
      "127.0.0.1",
      "audit",
      `http://127.0.0.1:${port}/`,
      "--offline-external",
      "--delay",
      "0",
      "--json",
      ...extra,
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  if (res.status !== 0 && res.status !== 1) throw new Error(`audit failed (${res.status})`);
  return JSON.parse(res.stdout);
}

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

let fx = await fixture(0);
const first = audit(["--lighthouse-pages", "2"]);
fx.kill();
fx = await fixture(60);
const second = audit(["--lighthouse-pages", "2", "--sample", "25"]);
fx.kill();

const out = join(root, "examples", "fernhill");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of readdirSync(second.reportDir)) {
  if (/^(report\.(html|json)|findings\.csv|summary\.md)$/.test(f))
    cpSync(join(second.reportDir, f), join(out, f));
}
// Keep the committed demo data lean: drop bulky raw artifacts and compact the DB.
for (const id of readdirSync(join(dataDir, "artifacts"))) {
  for (const f of readdirSync(join(dataDir, "artifacts", id))) {
    if (f === "findings-all.csv" || f.startsWith("lh-")) rmSync(join(dataDir, "artifacts", id, f));
  }
}
const Database = createRequire(join(root, "packages/db/package.json"))("better-sqlite3");
const db = new Database(join(dataDir, "webaudit.sqlite"));
db.pragma("wal_checkpoint(TRUNCATE)");
db.exec("DELETE FROM evidence_artifacts WHERE kind = 'lighthouse'; VACUUM;");
db.pragma("journal_mode = DELETE");
db.close();
console.log(`Examples written:\n  ${out}\n  ${dataDir} (audits ${first.auditId}, ${second.auditId})`);
