import http from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { BLOCKING_JS, HERO_SVG, PAGES, largePage } from "./pages";

export interface FixtureOptions {
  port?: number;
  host?: string;
  /** Number of generated /large/N pages listed in sitemap-large.xml (0 = disabled). */
  largePages?: number;
}

export interface FixtureServer {
  origin: string;
  port: number;
  close(): Promise<void>;
  /** Request log, for asserting the crawler never fetched blocked URLs. */
  requests: string[];
}

/** URLs in the main sitemap. /landing/offer is an orphan (no internal link). */
const SITEMAP_PAGES = [
  "/",
  "/products/term-plan",
  "/products/health-plan",
  "/about",
  "/contact",
  "/pricing",
  "/landing/offer",
];
const SITEMAP_BLOG = ["/blog/", "/blog/first-post", "/blog/second-post"];

function urlset(origin: string, paths: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join("\n")}
</urlset>`;
}

export async function startFixtureServer(opts: FixtureOptions = {}): Promise<FixtureServer> {
  const requests: string[] = [];
  const large = opts.largePages ?? 0;
  let origin = "";

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", origin);
    requests.push(url.pathname + url.search);
    const send = (
      status: number,
      type: string,
      body: string | Buffer,
      headers: Record<string, string> = {},
    ) => {
      res.writeHead(status, { "content-type": type, ...headers });
      res.end(body);
    };
    const p = url.pathname;

    if (p === "/robots.txt") {
      const sitemaps = [`Sitemap: ${origin}/sitemap.xml`];
      if (large) sitemaps.push(`Sitemap: ${origin}/sitemap-large.xml`);
      return send(
        200,
        "text/plain",
        `User-agent: *\nDisallow: /private/\nDisallow: /*?sessionid=\n\n${sitemaps.join("\n")}\n`,
      );
    }
    if (p === "/sitemap.xml") {
      return send(
        200,
        "application/xml",
        `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${origin}/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>${origin}/sitemap-blog.xml.gz</loc></sitemap>
</sitemapindex>`,
      );
    }
    if (p === "/sitemap-pages.xml") return send(200, "application/xml", urlset(origin, SITEMAP_PAGES));
    if (p === "/sitemap-blog.xml.gz") {
      return send(200, "application/x-gzip", gzipSync(urlset(origin, SITEMAP_BLOG)));
    }
    if (p === "/sitemap-large.xml" && large) {
      // Planted duplicates: trailing slash, uppercase host-insensitive path variant, tracking params.
      const paths: string[] = [];
      for (let i = 1; i <= large; i++) paths.push(`/large/${i}`);
      paths.push(
        "/large/1/",
        "/large/2?utm_source=sitemap",
        "/large/3#top",
        "/large/4?utm_campaign=x&utm_medium=y",
      );
      return send(200, "application/xml", urlset(origin, paths));
    }

    // Redirect chain: /old-offer → /offer-2025 → /landing/offer
    if (p === "/old-offer") return send(301, "text/plain", "", { location: "/offer-2025" });
    if (p === "/offer-2025") return send(302, "text/plain", "", { location: "/landing/offer" });
    // SSRF trap: redirect into link-local metadata space (T06).
    if (p === "/redirect-private") {
      return send(302, "text/plain", "", { location: "http://169.254.169.254/latest/meta-data/" });
    }
    // Infinite parameter trap (T04).
    if (p === "/trap/calendar") {
      const page = Number(url.searchParams.get("page") ?? "1");
      return send(
        200,
        "text/html",
        `<!doctype html><html lang="en"><head><title>Events page ${page}</title><meta name="description" content="Calendar"></head><body><h1>Events</h1><a href="/trap/calendar?page=${page + 1}">Next</a><a href="/trap/calendar?page=${page + 1}&sort=asc">Sorted</a><a href="/trap/calendar?page=${page}&view=list&sessionid=abc${page}">List</a></body></html>`,
      );
    }
    if (p === "/files/brochure.pdf") {
      return send(200, "application/pdf", Buffer.from("%PDF-1.4\n% fixture\n"));
    }
    if (p === "/js/blocking.js") return send(200, "application/javascript", BLOCKING_JS);
    if (p === "/img/hero.svg") return send(200, "image/svg+xml", HERO_SVG);

    const largeMatch = /^\/large\/(\d+)\/?$/.exec(p);
    if (largeMatch && large) {
      const n = Number(largeMatch[1]);
      if (n >= 1 && n <= large) return send(200, "text/html; charset=utf-8", largePage(n));
    }

    const page = PAGES[p];
    if (page) {
      const r = page(origin);
      return send(r.status ?? 200, "text/html; charset=utf-8", r.html, r.headers);
    }
    return send(
      404,
      "text/html; charset=utf-8",
      `<!doctype html><html lang="en"><head><title>Not found</title></head><body><h1>404</h1></body></html>`,
    );
  });

  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, opts.host ?? "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  origin = `http://${opts.host ?? "127.0.0.1"}:${port}`;
  return {
    origin,
    port,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
