// Container entrypoint: enforces the network-exposure policy, then runs the web UI
// and/or the audit worker (WEBAUDIT_ROLE=all|web|worker). Exits if a child exits so
// the orchestrator restarts the container instead of leaving it half-alive.
import { spawn } from "node:child_process";

const role = process.env.WEBAUDIT_ROLE ?? "all";
const host = process.env.WEBAUDIT_HOST ?? "127.0.0.1";
const port = process.env.PORT ?? "3000";
const demo = process.env.WEBAUDIT_DEMO === "1";
const token = process.env.WEBAUDIT_ACCESS_TOKEN ?? "";
const loopback = host === "127.0.0.1" || host === "localhost" || host === "::1";

if (role !== "worker" && !loopback && !demo && token.length < 16) {
  console.error(
    `Refusing to start: WEBAUDIT_HOST=${host} exposes the app on the network.\n` +
      `Set WEBAUDIT_ACCESS_TOKEN (16+ random characters), or WEBAUDIT_DEMO=1 for a read-only demo, or bind to 127.0.0.1.`,
  );
  process.exit(1);
}
if (process.env.WEBAUDIT_ALLOW_PRIVATE_HOSTS && !loopback) {
  console.warn(
    `WARNING: WEBAUDIT_ALLOW_PRIVATE_HOSTS=${process.env.WEBAUDIT_ALLOW_PRIVATE_HOSTS} on a network-exposed instance weakens SSRF protection.`,
  );
}

const children = [];
const run = (name, cmd, args, cwd) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit", env: process.env });
  child.on("exit", (code, signal) => {
    console.error(`[${name}] exited (${signal ?? code}); stopping container`);
    for (const c of children) if (c !== child) c.kill("SIGTERM");
    process.exit(code ?? 1);
  });
  children.push(child);
};

if (role === "all" || role === "web") {
  run("web", "node", ["node_modules/next/dist/bin/next", "start", "-H", host, "-p", port], "/app/apps/web");
}
if ((role === "all" || role === "worker") && !demo) {
  run("worker", "node", ["apps/cli/bin/webaudit.js", "worker"], "/app");
}

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    for (const c of children) c.kill("SIGTERM");
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
