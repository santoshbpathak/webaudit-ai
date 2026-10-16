import { startFixtureServer } from "./server";

const port = Number(process.env.FIXTURE_PORT ?? 4100);
const host = process.env.FIXTURE_HOST ?? "127.0.0.1";
const largePages = Number(process.env.FIXTURE_LARGE ?? 0);

const s = await startFixtureServer({ port, host, largePages });
console.log(`Fernhill fixture site: ${s.origin}${largePages ? ` (+${largePages} generated pages)` : ""}`);
console.log(`Audit it with WEBAUDIT_ALLOW_PRIVATE_HOSTS=${host} so the safety policy permits it.`);
