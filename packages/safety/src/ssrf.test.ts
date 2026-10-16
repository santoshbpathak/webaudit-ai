import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  UnsafeUrlError,
  assertPublicUrl,
  assertSafeUrlShape,
  createSafeAgent,
  describeFetchError,
  isPublicIp,
  safeFetch,
  startGuardProxy,
  type Resolver,
  type SafetyPolicy,
  browserEnv,
} from "./index";

const policy = (over: Partial<SafetyPolicy> = {}): SafetyPolicy => ({
  allowHosts: [],
  allowedPorts: [],
  resolver: async () => [{ address: "93.184.216.34", family: 4 }],
  ...over,
});

describe("isPublicIp", () => {
  it.each([
    ["8.8.8.8", true],
    ["2606:4700::1111", true],
    ["127.0.0.1", false],
    ["::7f00:1", false],
    ["::a9fe:a9fe", false],
    ["fd00:ec2::254", false],
    ["10.1.2.3", false],
    ["172.16.0.1", false],
    ["192.168.1.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["224.0.0.1", false],
    ["192.0.2.10", false],
    ["::1", false],
    ["fe80::1", false],
    ["fc00::1", false],
    ["::ffff:127.0.0.1", false],
    ["::ffff:8.8.8.8", true],
    ["64:ff9b::7f00:1", false],
    ["not-an-ip", false],
  ])("%s → %s", (ip, expected) => {
    expect(isPublicIp(ip)).toBe(expected);
  });
});

describe("assertSafeUrlShape", () => {
  const bad: [string, string][] = [
    ["file:///etc/passwd", "scheme"],
    ["ftp://example.com/", "scheme"],
    ["javascript:alert(1)", "scheme"],
    ["http://user:pass@example.com/", "credentials"],
    ["http://localhost/", "blocked_host"],
    ["http://foo.localhost/", "blocked_host"],
    ["http://printer.local/", "blocked_host"],
    ["http://metadata.google.internal/", "blocked_host"],
    ["http://127.0.0.1/", "private_address"],
    ["http://2130706433/", "private_address"], // decimal 127.0.0.1
    ["http://0x7f.1/", "private_address"], // hex shorthand
    ["http://[::1]/", "private_address"],
    ["http://[::ffff:7f00:1]/", "private_address"],
    ["http://169.254.169.254/latest/meta-data/", "private_address"],
    ["not a url", "invalid_url"],
  ];
  it.each(bad)("rejects %s", (url, code) => {
    try {
      assertSafeUrlShape(url, policy());
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(UnsafeUrlError);
      expect((e as UnsafeUrlError).code).toBe(code);
    }
  });

  it("accepts a normal public URL", () => {
    expect(assertSafeUrlShape("https://example.com/path?q=1", policy()).hostname).toBe("example.com");
  });

  it("honors an explicit allowlist entry for local fixtures", () => {
    expect(() =>
      assertSafeUrlShape("http://127.0.0.1:4100/", policy({ allowHosts: ["127.0.0.1"] })),
    ).not.toThrow();
  });
});

describe("assertPublicUrl (DNS)", () => {
  it("rejects hostnames resolving to private space", async () => {
    const resolver: Resolver = async () => [{ address: "10.0.0.5", family: 4 }];
    await expect(
      assertPublicUrl("https://intranet.example.com/", policy({ resolver })),
    ).rejects.toMatchObject({
      code: "private_address",
    });
  });

  it("rejects when ANY answer is private (mixed records)", async () => {
    const resolver: Resolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    await expect(assertPublicUrl("https://mixed.example.com/", policy({ resolver }))).rejects.toMatchObject({
      code: "private_address",
    });
  });

  it("reports DNS failures distinctly", async () => {
    const resolver: Resolver = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(assertPublicUrl("https://nx.example.com/", policy({ resolver }))).rejects.toMatchObject({
      code: "dns_failure",
    });
  });
});

describe("safeFetch against a local server", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/ok")
        return void res.writeHead(200, { "content-type": "text/html" }).end("<h1>ok</h1>");
      if (req.url === "/to-metadata")
        return void res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end();
      if (req.url === "/to-localhost")
        return void res.writeHead(301, { location: `http://localhost:${port}/ok` }).end();
      if (req.url === "/big") return void res.writeHead(200).end("x".repeat(50_000));
      if (req.url === "/loop") return void res.writeHead(302, { location: "/loop" }).end();
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const fetchWith = (path: string, p: SafetyPolicy, maxBytes = 1_000_000) =>
    safeFetch(`http://127.0.0.1:${port}${path}`, {
      agent: createSafeAgent(p),
      policy: p,
      userAgent: "test",
      timeoutMs: 5_000,
      maxBytes,
    });

  const local = () =>
    policy({ allowHosts: ["127.0.0.1"], resolver: async () => [{ address: "127.0.0.1", family: 4 }] });

  it("blocks the local server when it is not allowlisted", async () => {
    await expect(fetchWith("/ok", policy())).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("fetches an allowlisted fixture", async () => {
    const r = await fetchWith("/ok", local());
    expect(r.status).toBe(200);
    expect(r.body.toString()).toContain("ok");
  });

  it("T06: rejects a redirect into cloud metadata / link-local", async () => {
    await expect(fetchWith("/to-metadata", local())).rejects.toMatchObject({ code: "private_address" });
  });

  it("T06: rejects a redirect to a non-allowlisted loopback name", async () => {
    await expect(fetchWith("/to-localhost", local())).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("caps response bytes", async () => {
    const r = await fetchWith("/big", local(), 1_000);
    expect(r.bytes).toBe(1_000);
    expect(r.truncated).toBe(true);
  });

  it("stops redirect loops", async () => {
    await expect(fetchWith("/loop", local())).rejects.toThrow(/Too many redirects/);
  });

  it("defeats DNS rebinding: connect-time lookup re-validates", async () => {
    let calls = 0;
    const rebinding: Resolver = async () =>
      calls++ === 0 ? [{ address: "93.184.216.34", family: 4 }] : [{ address: "127.0.0.1", family: 4 }];
    const p = policy({ resolver: rebinding });
    await assertPublicUrl(`http://rebind.example.com:${port}/ok`, p); // preflight sees a public IP
    const err = await safeFetch(`http://rebind.example.com:${port}/ok`, {
      agent: createSafeAgent(p),
      policy: p,
      userAgent: "test",
      timeoutMs: 5_000,
      maxBytes: 10_000,
    }).catch((e: unknown) => e);
    expect(describeFetchError(err).unsafe).toBe(true);
  });
});

describe("guard proxy", () => {
  let target: http.Server;
  let tport: number;
  beforeAll(async () => {
    target = http.createServer((_q, s) => s.end("secret-internal"));
    await new Promise<void>((r) => target.listen(0, "127.0.0.1", r));
    tport = (target.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => target.close(() => r())));

  const viaProxy = (proxyPort: number, url: string) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port: proxyPort, path: url, method: "GET" }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
      req.end();
    });

  const connectVia = (proxyPort: number, authority: string) =>
    new Promise<string>((resolve) => {
      const s = net.connect(proxyPort, "127.0.0.1", () => {
        s.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
      });
      s.once("data", (d) => {
        resolve(d.toString().split("\r\n")[0]!);
        s.destroy();
      });
    });

  it("refuses plain HTTP to loopback and records the block", async () => {
    const blocked: string[] = [];
    const proxy = await startGuardProxy({ policy: policy(), onBlocked: (t) => blocked.push(t) });
    const r = await viaProxy(proxy.port, `http://127.0.0.1:${tport}/`);
    expect(r.status).toBe(403);
    expect(r.body).not.toContain("secret-internal");
    expect(blocked).toHaveLength(1);
    await proxy.close();
  });

  it("refuses CONNECT tunnels to private addresses", async () => {
    const proxy = await startGuardProxy({ policy: policy() });
    expect(await connectVia(proxy.port, "10.0.0.1:443")).toContain("403");
    expect(await connectVia(proxy.port, "169.254.169.254:443")).toContain("403");
    await proxy.close();
  });

  it("forwards allowlisted fixture traffic", async () => {
    const proxy = await startGuardProxy({
      policy: policy({
        allowHosts: ["127.0.0.1"],
        resolver: async () => [{ address: "127.0.0.1", family: 4 }],
      }),
    });
    const r = await viaProxy(proxy.port, `http://127.0.0.1:${tport}/`);
    expect(r.status).toBe(200);
    await proxy.close();
  });
});

describe("browserEnv", () => {
  it("passes only allowlisted variables to browser processes", () => {
    const env = browserEnv({
      PATH: "/usr/bin",
      HOME: "/home/u",
      ANTHROPIC_API_KEY: "sk-ant-test",
      OPENAI_API_KEY: "sk-test",
      WEBAUDIT_ACCESS_TOKEN: "t",
      DATABASE_URL: "postgres://x",
      PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
    });
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/home/u", PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" });
  });
});
