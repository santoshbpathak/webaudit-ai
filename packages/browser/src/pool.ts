import { chromium, type Browser, type BrowserContext } from "playwright";
import { browserEnv, startGuardProxy, type GuardProxy, type SafetyPolicy } from "@webaudit/safety";

export interface PoolOptions {
  policy: SafetyPolicy;
  device: "mobile" | "desktop";
  userAgent: string;
  headless?: boolean;
  onBlocked?: (target: string, reason: string) => void;
}

const MOBILE = { width: 390, height: 844 };

/** WebRTC UDP (STUN/TURN) does not use the HTTP proxy; confine it so page JS cannot probe
 * internal UDP services around the guard proxy. */
export const WEBRTC_FLAGS = [
  "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  "--webrtc-ip-handling-policy=disable_non_proxied_udp",
];

export const noSandbox = () => process.env.WEBAUDIT_CHROME_NO_SANDBOX === "1";
const DESKTOP = { width: 1366, height: 900 };

/**
 * One Chromium process per audit, with every request forced through the guard proxy
 * (Playwright routes loopback through the proxy too). Each page gets a fresh context
 * so cookies and storage never leak between pages — consent observations stay honest.
 */
export class BrowserPool {
  private browser?: Browser;
  private proxy?: GuardProxy;
  private contexts = new Set<BrowserContext>();

  constructor(private readonly opts: PoolOptions) {}

  async start(): Promise<void> {
    this.proxy = await startGuardProxy({ policy: this.opts.policy, onBlocked: this.opts.onBlocked });
    this.browser = await chromium.launch({
      headless: this.opts.headless ?? true,
      // Audited pages are hostile input: keep Chromium's renderer sandbox on. Playwright
      // otherwise adds --no-sandbox. Containers without user namespaces can opt out with
      // WEBAUDIT_CHROME_NO_SANDBOX=1 (see docs/security.md for the trade-off).
      chromiumSandbox: !noSandbox(),
      env: browserEnv(),
      proxy: { server: this.proxy.url },
      args: [
        ...WEBRTC_FLAGS,
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "--no-first-run",
        "--mute-audio",
        "--disable-features=PrivateNetworkAccessSendPreflights",
      ],
    });
  }

  get proxyUrl(): string {
    if (!this.proxy) throw new Error("BrowserPool not started");
    return this.proxy.url;
  }

  async newContext(): Promise<BrowserContext> {
    if (!this.browser) throw new Error("BrowserPool not started");
    const mobile = this.opts.device === "mobile";
    const ctx = await this.browser.newContext({
      viewport: mobile ? MOBILE : DESKTOP,
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: 1,
      userAgent: mobile
        ? `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Mobile Safari/537.36 ${this.opts.userAgent}`
        : `Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36 ${this.opts.userAgent}`,
      acceptDownloads: false,
      serviceWorkers: "block",
      ignoreHTTPSErrors: false,
      javaScriptEnabled: true,
      locale: "en-US",
      permissions: [],
    });
    // esbuild keepNames (tsx) wraps nested functions in __name(); make it a no-op in-page.
    await ctx.addInitScript("globalThis.__name = globalThis.__name || ((f) => f);");
    this.contexts.add(ctx);
    ctx.on("close", () => this.contexts.delete(ctx));
    return ctx;
  }

  blockedCount(): number {
    return this.proxy?.blockedCount() ?? 0;
  }

  /** Idempotent; safe to call from cancellation paths. */
  async close(): Promise<void> {
    await Promise.allSettled([...this.contexts].map((c) => c.close()));
    this.contexts.clear();
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
    await this.proxy?.close();
    this.proxy = undefined;
  }
}
