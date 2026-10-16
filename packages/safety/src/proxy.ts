import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { assertSafeUrlShape, resolvePublic, type SafetyPolicy } from "./policy";
import { makeSafeLookup } from "./fetch";
import { redactUrl } from "./redact";

export interface GuardProxy {
  /** e.g. http://127.0.0.1:53211 */
  url: string;
  port: number;
  close(): Promise<void>;
  blockedCount(): number;
}

export interface GuardProxyOptions {
  policy: SafetyPolicy;
  onBlocked?: (target: string, reason: string) => void;
}

/**
 * Local forward proxy that every browser (Playwright and Lighthouse's Chrome) is
 * forced through. It resolves destinations itself and connects only to public
 * addresses, so pages cannot reach the host machine, LAN or cloud metadata via
 * subresources, redirects, fetch(), iframes or DNS rebinding.
 */
export async function startGuardProxy(opts: GuardProxyOptions): Promise<GuardProxy> {
  const { policy } = opts;
  const lookup = makeSafeLookup(policy);
  let blocked = 0;
  const sockets = new Set<net.Socket>();

  const reject = (target: string, reason: string) => {
    blocked++;
    opts.onBlocked?.(redactUrl(target), reason);
  };

  const server = http.createServer((req, res) => {
    // Plain-HTTP proxying: req.url is absolute.
    const target = req.url ?? "";
    let u: URL;
    try {
      u = assertSafeUrlShape(target, policy);
    } catch (e) {
      reject(target, (e as Error).message);
      res.writeHead(403, { "content-type": "text/plain" }).end("Blocked by WebAudit safety policy");
      return;
    }
    const headers = { ...req.headers };
    delete headers["proxy-connection"];
    delete headers["proxy-authorization"];
    const upstream = http.request(
      {
        host: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method: req.method,
        headers,
        lookup: lookup as never,
        timeout: 30_000,
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      if ((e as NodeJS.ErrnoException).code === "EUNSAFEADDR") reject(target, e.message);
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
      res.end();
    });
    upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
    req.pipe(upstream);
  });

  server.on("connect", (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    sockets.add(client);
    client.on("close", () => sockets.delete(client));
    client.on("error", () => client.destroy());
    const authority = req.url ?? "";
    const idx = authority.lastIndexOf(":");
    const host = idx > 0 ? authority.slice(0, idx) : authority;
    const port = idx > 0 ? Number(authority.slice(idx + 1)) : 443;
    const pseudo = `https://${authority}/`;
    const deny = (reason: string) => {
      reject(pseudo, reason);
      client.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
    };
    try {
      assertSafeUrlShape(pseudo, policy);
    } catch (e) {
      deny((e as Error).message);
      return;
    }
    resolvePublic(host, policy, port)
      .then((answers) => {
        const addr = answers[0]!.address;
        const upstream = net.connect({ host: addr, port, timeout: 15_000 }, () => {
          client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          if (head.length) upstream.write(head);
          upstream.pipe(client);
          client.pipe(upstream);
        });
        sockets.add(upstream);
        upstream.on("close", () => sockets.delete(upstream));
        upstream.on("timeout", () => upstream.destroy());
        upstream.on("error", () => {
          if (client.writable) client.end("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n");
        });
      })
      .catch((e: Error) => deny(e.message));
  });

  // Plain ws:// upgrades are not proxied.
  server.on("upgrade", (_req, socket: net.Socket) => {
    socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    blockedCount: () => blocked,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}
