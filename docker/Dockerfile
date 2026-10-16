# WebAudit AI — single image for web UI + audit worker.
# Playwright base image ships Chromium and all system dependencies.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    WEBAUDIT_DATA_DIR=/data \
    WEBAUDIT_HOST=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Docker's default seccomp profile blocks the user namespaces Chromium's sandbox needs.
# The container (non-root, browser env stripped of secrets) is the isolation boundary
# here. To keep the Chromium sandbox on, run with Playwright's seccomp profile and set
# this to 0 (docs/security.md, "Browser sandbox").
ENV WEBAUDIT_CHROME_NO_SANDBOX=1

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && apt-get update \
    # make + g++: better-sqlite3 compiles its native addon during install (no prebuilt
    # binary is fetched), and the Playwright base image ships Python but no C++ toolchain.
    && apt-get install -y --no-install-recommends tini make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependency layer (cached unless manifests change).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/cli/package.json apps/cli/
COPY fixtures/site/package.json fixtures/site/
COPY packages ./packages-manifests
RUN for d in packages-manifests/*; do mkdir -p packages/$(basename $d) && cp $d/package.json packages/$(basename $d)/; done \
    && rm -rf packages-manifests \
    # --prod=false: NODE_ENV=production would otherwise skip devDependencies that the
    # web build needs (Tailwind's PostCSS plugin, TypeScript).
    && pnpm install --frozen-lockfile --prod=false

# Source + production build of the web app.
COPY . .
RUN pnpm --filter @webaudit/web build \
    && mkdir -p /data && chown -R pwuser:pwuser /data /app/apps/web/.next /app/examples

USER pwuser
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "node", "docker/start.mjs"]
