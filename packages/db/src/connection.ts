import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations.generated";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/**
 * $WEBAUDIT_DATA_DIR, else `<workspace root>/data` (so the web app and worker share one
 * DB regardless of their working directory), else ./data.
 */
export function defaultDataDir(): string {
  if (process.env.WEBAUDIT_DATA_DIR) return resolve(process.env.WEBAUDIT_DATA_DIR);
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return join(dir, "data");
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return resolve("./data");
}

export function defaultDbPath(): string {
  return join(defaultDataDir(), "webaudit.sqlite");
}

/** Apply embedded migrations inside a transaction. Idempotent. */
export function migrate(sqlite: Database.Database): void {
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS __webaudit_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (sqlite.prepare("SELECT name FROM __webaudit_migrations").all() as { name: string }[]).map((r) => r.name),
  );
  const apply = sqlite.transaction((name: string, sql: string) => {
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const s = stmt.trim();
      if (s) sqlite.exec(s);
    }
    sqlite
      .prepare("INSERT INTO __webaudit_migrations (name, applied_at) VALUES (?, ?)")
      .run(name, new Date().toISOString());
  });
  for (const m of MIGRATIONS) {
    if (!applied.has(m.name)) apply(m.name, m.sql);
  }
}

const cache = new Map<string, Db>();

/**
 * Open (and migrate) a SQLite database. Connections are cached per path so Next.js
 * hot reloads and repeated calls do not leak file handles.
 */
export function openDb(path: string = defaultDbPath()): Db {
  const existing = cache.get(path);
  if (existing) return existing;
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  migrate(sqlite);
  const db = drizzle(sqlite, { schema }) as Db;
  if (path !== ":memory:") cache.set(path, db);
  return db;
}

export function closeDb(db: Db): void {
  for (const [k, v] of cache) if (v === db) cache.delete(k);
  db.$client.close();
}
