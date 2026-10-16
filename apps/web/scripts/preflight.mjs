// `pnpm --filter @webaudit/web start` preflight: same exposure policy as docker/start.mjs.
// Binding a network interface without an access token would expose scanning, deletion and
// any configured AI key to the local network.
const host = process.env.WEBAUDIT_HOST ?? "127.0.0.1";
const loopback = host === "127.0.0.1" || host === "localhost" || host === "::1";
const token = process.env.WEBAUDIT_ACCESS_TOKEN ?? "";
if (!loopback && process.env.WEBAUDIT_DEMO !== "1" && token.length < 16) {
  console.error(
    `Refusing to start: WEBAUDIT_HOST=${host} exposes the app on the network.\n` +
      `Set WEBAUDIT_ACCESS_TOKEN (16+ random characters), WEBAUDIT_DEMO=1, or bind to 127.0.0.1.`,
  );
  process.exit(1);
}
