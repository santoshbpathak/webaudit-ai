import { Command, Option } from "commander";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ENGINE_VERSION, type AuditConfigInput, type ModuleId, type Severity } from "@webaudit/core";
import { computeCoverage, defaultDbPath, getAudit, listAudits, listEvents, openDb } from "@webaudit/db";
import {
  LocalArtifactStore,
  ValidationError,
  createAndQueueAudit,
  defaultArtifactRoot,
  runAudit,
  runWorker,
  writeReports,
} from "@webaudit/pipeline";
import { SqliteJobQueue } from "@webaudit/queue";
import {
  diffAudits,
  evaluateBudgets,
  failOnSeverity,
  loadReportData,
  renderMarkdown,
} from "@webaudit/report";
import { policyFromEnv } from "@webaudit/safety";
import { doctor } from "./doctor";

const EXIT = { ok: 0, budget: 1, error: 2 } as const;
const isTTY = process.stderr.isTTY;
const err = (s: string) => process.stderr.write(s + "\n");

function context(opts: { dataDir?: string; allowPrivateHost?: string[] }) {
  if (opts.dataDir) process.env.WEBAUDIT_DATA_DIR = resolve(opts.dataDir);
  const db = openDb(defaultDbPath());
  const policy = policyFromEnv();
  if (opts.allowPrivateHost?.length)
    policy.allowHosts.push(...opts.allowPrivateHost.map((h) => h.toLowerCase()));
  if (policy.allowHosts.length)
    err(`⚠ Safety allowlist active for: ${policy.allowHosts.join(", ")} (development/testing only)`);
  return {
    db,
    policy,
    queue: new SqliteJobQueue(db),
    artifacts: new LocalArtifactStore(defaultArtifactRoot()),
  };
}

const program = new Command()
  .name("webaudit")
  .description("Open-source website intelligence for marketers — evidence-backed audits, no AI required.")
  .version(ENGINE_VERSION)
  .option("--data-dir <dir>", "where the SQLite DB and artifacts live (default ./data or $WEBAUDIT_DATA_DIR)")
  .option(
    "--allow-private-host <hosts>",
    "comma-separated private/local hosts to permit (fixtures, staging). Never use for untrusted input",
    (v: string) =>
      v
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
  );

program
  .command("audit")
  .description("Run an audit in this process and write reports")
  .argument("<url>", "start URL (https:// assumed if omitted)")
  .addOption(
    new Option("-m, --mode <mode>", "quick | smart | deep")
      .choices(["quick", "smart", "deep"])
      .default("smart"),
  )
  .option("--max-urls <n>", "maximum URLs to fetch", (v) => Number(v))
  .option("--max-depth <n>", "maximum click depth", (v) => Number(v))
  .option("--sample <n>", "pages that receive browser checks (smart mode)", (v) => Number(v))
  .addOption(
    new Option("--device <device>", "emulated device").choices(["mobile", "desktop"]).default("mobile"),
  )
  .option("--no-lighthouse", "skip Lighthouse performance runs")
  .option("--lighthouse-pages <n>", "max pages to run Lighthouse on", (v) => Number(v))
  .option("--modules <ids>", "comma-separated module ids, e.g. M01,M04,M08")
  .option("--delay <ms>", "minimum delay between requests to the host", (v) => Number(v))
  .option("--priority-path <path...>", "business-critical paths (raise priority)")
  .option("--deny <pattern...>", "extra path patterns to exclude")
  .option("-o, --out <dir>", "copy reports into this directory")
  .addOption(
    new Option("--fail-on <severity>", "exit 1 if any issue group is at or above this severity").choices([
      "critical",
      "high",
      "medium",
      "low",
    ]),
  )
  .option("--budget <expr...>", "quality budgets, e.g. lh-performance>=80 issues-high<=0")
  .option("--json", "print the machine-readable summary to stdout")
  .addOption(
    new Option("--offline-external", "stub third-party requests (deterministic demos/tests)").hideHelp(),
  )
  .action(async (url: string, o) => {
    const g = program.opts();
    const { db, policy, queue, artifacts } = context(g);
    const input: AuditConfigInput = {
      url,
      mode: o.mode,
      device: o.device,
      lighthouse: o.lighthouse,
      ...(o.maxUrls ? { maxUrls: o.maxUrls } : {}),
      ...(o.maxDepth !== undefined ? { maxDepth: o.maxDepth } : {}),
      ...(o.sample ? { sampleSize: o.sample } : {}),
      ...(o.lighthousePages !== undefined ? { lighthouseMaxPages: o.lighthousePages } : {}),
      ...(o.modules
        ? {
            modules: String(o.modules)
              .split(",")
              .map((s) => s.trim().toUpperCase()) as ModuleId[],
          }
        : {}),
      ...(o.delay !== undefined ? { perHostDelayMs: o.delay } : {}),
      ...(o.priorityPath ? { priorityPaths: o.priorityPath } : {}),
    };
    let audit;
    try {
      audit = createAndQueueAudit(db, queue, policy, input, "cli");
      if (o.deny?.length) {
        const cfg = { ...audit.config, denyPaths: [...audit.config.denyPaths, ...o.deny] };
        db.$client.prepare("UPDATE audits SET config = ? WHERE id = ?").run(JSON.stringify(cfg), audit.id);
      }
    } catch (e) {
      err(`✖ ${(e as Error).message}`);
      process.exit(e instanceof ValidationError ? EXIT.error : EXIT.error);
    }
    // In-process run: claim the queued job ourselves so a separate worker does not also run it.
    db.$client
      .prepare("UPDATE jobs SET status = 'done' WHERE json_extract(payload, '$.auditId') = ?")
      .run(audit.id);

    err(`▶ Auditing ${audit.config.url} (${audit.mode}) — audit ${audit.id}`);
    const onSig = () => {
      err("\n■ Cancelling… (press Ctrl+C again to force quit)");
      db.$client.prepare("UPDATE audits SET cancel_requested = 1 WHERE id = ?").run(audit.id);
      process.once("SIGINT", () => process.exit(130));
    };
    process.once("SIGINT", onSig);

    let lastEvent = 0;
    const progress = setInterval(() => {
      const a = getAudit(db, audit.id);
      const c = computeCoverage(db, audit.id);
      for (const e of listEvents(db, audit.id, lastEvent)) {
        lastEvent = e.id;
        if (e.level === "warn" || e.level === "error") {
          if (isTTY) process.stderr.write("\r\x1b[K");
          err(`  ${e.level === "error" ? "✖" : "⚠"} ${e.message}`);
        }
      }
      const line = `  ${a?.phase ?? "…"} · discovered ${c.discovered} · checked ${c.checked} · sampled ${c.sampled} · failed ${c.failed}`;
      if (isTTY) process.stderr.write(`\r\x1b[K${line}`);
    }, 500);

    const status = await runAudit(audit.id, {
      db,
      artifacts,
      policy,
      offlineExternal: !!o.offlineExternal,
      onLog: () => {},
    });
    clearInterval(progress);
    if (isTTY) process.stderr.write("\r\x1b[K");
    const final = getAudit(db, audit.id)!;
    if (status === "failed") {
      err(`✖ Audit failed: ${final.error}`);
      process.exit(EXIT.error);
    }

    const data = loadReportData(db, audit.id);
    const dir = join(defaultArtifactRoot(), audit.id);
    if (o.out) {
      await mkdir(o.out, { recursive: true });
      for (const f of ["report.html", "report.json", "findings.csv", "summary.md"])
        await copyFile(join(dir, f), join(o.out, f)).catch(() => undefined);
    }
    const c = data.coverage;
    err(
      `✔ ${status} — ${data.groups.length} issue groups · ${c.checked} checked / ${c.discovered} discovered · ${c.sampled} browser-sampled`,
    );
    for (const gr of data.groups.slice(0, 8))
      err(
        `  [${gr.severity.padEnd(8)}] ${gr.title} — ${gr.affectedPages}/${gr.testedPages} pages (${gr.templateHint})`,
      );
    err(`  Reports: ${o.out ? resolve(o.out) : dir}`);

    let exit: number = EXIT.ok;
    const budgets = o.budget ? evaluateBudgets(data, o.budget as string[]) : [];
    for (const b of budgets) {
      err(
        `  ${b.passed ? "✔" : "✖"} budget ${b.expression} (actual: ${b.actual ?? "n/a"})${b.note ? ` — ${b.note}` : ""}`,
      );
      if (!b.passed) exit = EXIT.budget;
    }
    if (o.failOn) {
      const r = failOnSeverity(data, o.failOn as Severity);
      if (r.failed) {
        err(`  ✖ ${r.count} issue group(s) at or above "${o.failOn}"`);
        exit = EXIT.budget;
      }
    }
    if (o.json) {
      process.stdout.write(
        JSON.stringify(
          {
            auditId: audit.id,
            status,
            coverage: c,
            groups: data.groups.length,
            budgets,
            reportDir: o.out ? resolve(o.out) : dir,
          },
          null,
          2,
        ) + "\n",
      );
    }
    process.exit(exit);
  });

program
  .command("worker")
  .description("Process queued audits (used by the web app and Docker)")
  .option("--once", "exit when the queue is empty")
  .action(async (o) => {
    const { db, policy, queue, artifacts } = context(program.opts());
    const ac = new AbortController();
    process.on("SIGTERM", () => ac.abort());
    process.on("SIGINT", () => ac.abort());
    err(`webaudit worker started (db ${defaultDbPath()})`);
    await runWorker(
      db,
      queue,
      { artifacts, policy, onLog: (lvl, m) => err(`${new Date().toISOString()} ${lvl} ${m}`) },
      { signal: ac.signal, exitWhenIdle: !!o.once },
    );
  });

program
  .command("list")
  .description("List recent audits")
  .option("--host <host>")
  .action((o) => {
    const { db } = context(program.opts());
    for (const a of listAudits(db, { host: o.host, limit: 50 })) {
      console.log(`${a.id}  ${a.status.padEnd(18)} ${a.mode.padEnd(6)} ${a.createdAt}  ${a.url}`);
    }
  });

program
  .command("report")
  .description("Regenerate reports for an audit, or print its Markdown summary")
  .argument("<auditId>")
  .option("--markdown", "print Markdown summary to stdout")
  .action(async (id: string, o) => {
    const { db, artifacts } = context(program.opts());
    if (o.markdown) return void process.stdout.write(renderMarkdown(loadReportData(db, id)));
    const paths = await writeReports(db, artifacts, id);
    for (const p of Object.values(paths)) console.log(join(defaultArtifactRoot(), p));
  });

program
  .command("diff")
  .description("Compare two audits of the same site (new / resolved / persisting)")
  .argument("<baseId>")
  .argument("<headId>")
  .option("--json")
  .action((a: string, b: string, o) => {
    const { db } = context(program.opts());
    const d = diffAudits(loadReportData(db, a), loadReportData(db, b));
    if (o.json) return void console.log(JSON.stringify(d, null, 2));
    if (!d.comparable) for (const n of d.scopeNotes) console.log(`⚠ ${n}`);
    const show = (label: string, xs: typeof d.newIssues) => {
      console.log(`\n${label} (${xs.length})`);
      for (const x of xs)
        console.log(`  [${x.severity}] ${x.title} ${x.templateHint} ${x.before}→${x.after}`);
    };
    show("New", d.newIssues);
    show("Resolved", d.resolved);
    show("Not re-tested (not counted as resolved)", d.notRetested);
    show("Persisting", d.persisting);
  });

program
  .command("doctor")
  .description("Check the local setup and write a redacted troubleshooting bundle")
  .option("--bundle <file>", "write a JSON troubleshooting bundle")
  .action(async (o) => {
    const report = await doctor(program.opts().dataDir);
    for (const c of report.checks)
      console.log(`${c.ok ? "✔" : "✖"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    if (o.bundle) {
      await writeFile(o.bundle, JSON.stringify(report, null, 2));
      console.log(`Bundle written to ${o.bundle}`);
    }
    process.exit(report.checks.every((c) => c.ok) ? 0 : 1);
  });

await program.parseAsync(process.argv);
