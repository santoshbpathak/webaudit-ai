import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    "@webaudit/ai",
    "@webaudit/core",
    "@webaudit/db",
    "@webaudit/modules",
    "@webaudit/pipeline",
    "@webaudit/queue",
    "@webaudit/report",
    "@webaudit/safety",
    "@webaudit/scoring",
    "@webaudit/crawler",
  ],
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // Baseline headers. frame-ancestors 'self' (not 'none') because the Export tab previews
  // the report route in a same-origin sandboxed iframe; the report route sets its own CSP.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
          // Keeps a one-time ?token= out of Referer headers to third parties.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
