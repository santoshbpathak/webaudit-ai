import { XMLParser } from "fast-xml-parser";
import { gunzipSync } from "node:zlib";
import { describeFetchError, safeFetch, type SafeFetchOptions } from "@webaudit/safety";

export interface SitemapLimits {
  maxSitemaps: number;
  maxUrls: number;
  maxDepth: number;
  maxBytes: number;
}

export const DEFAULT_SITEMAP_LIMITS: SitemapLimits = {
  maxSitemaps: 50,
  maxUrls: 50_000,
  maxDepth: 3,
  maxBytes: 20_000_000,
};

export interface SitemapSource {
  url: string;
  status: number | "error";
  kind: "urlset" | "index" | "invalid" | "error";
  urlCount: number;
  error?: string;
}

export interface SitemapResult {
  urls: { loc: string; sitemap: string }[];
  sources: SitemapSource[];
  /** True when a limit stopped expansion — surfaced in coverage notes. */
  truncated: boolean;
}

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, processEntities: true });

function asArray<T>(x: T | T[] | undefined): T[] {
  return x === undefined ? [] : Array.isArray(x) ? x : [x];
}

function decode(body: Buffer, maxBytes: number): string {
  if (body.length > 2 && body[0] === 0x1f && body[1] === 0x8b) {
    return gunzipSync(body, { maxOutputLength: maxBytes }).toString("utf8");
  }
  return body.toString("utf8");
}

/**
 * Expand sitemaps (indexes, gzip) breadth-first within hard limits (CR-02).
 * `accept` filters URLs (scope); rejected URLs are not counted toward limits.
 */
export async function loadSitemaps(
  seeds: string[],
  fetchOpts: Omit<SafeFetchOptions, "maxBytes" | "accept">,
  accept: (url: string) => boolean,
  limits: SitemapLimits = DEFAULT_SITEMAP_LIMITS,
): Promise<SitemapResult> {
  const queue = [...new Set(seeds)].map((url) => ({ url, depth: 0 }));
  const seen = new Set<string>();
  const sources: SitemapSource[] = [];
  const urls: { loc: string; sitemap: string }[] = [];
  let truncated = false;

  while (queue.length) {
    const { url, depth } = queue.shift()!;
    if (seen.has(url)) continue;
    if (seen.size >= limits.maxSitemaps) {
      truncated = true;
      break;
    }
    seen.add(url);
    try {
      const res = await safeFetch(url, {
        ...fetchOpts,
        maxBytes: limits.maxBytes,
        accept: "application/xml,text/xml,application/x-gzip,*/*;q=0.5",
      });
      if (res.status >= 400) {
        sources.push({ url, status: res.status, kind: "error", urlCount: 0, error: `HTTP ${res.status}` });
        continue;
      }
      if (res.truncated) truncated = true;
      const doc = parser.parse(decode(res.body, limits.maxBytes)) as {
        sitemapindex?: { sitemap?: { loc?: string } | { loc?: string }[] };
        urlset?: { url?: { loc?: string } | { loc?: string }[] };
      };
      if (doc.sitemapindex) {
        const children = asArray(doc.sitemapindex.sitemap)
          .map((s) => String(s.loc ?? "").trim())
          .filter(Boolean);
        sources.push({ url, status: res.status, kind: "index", urlCount: children.length });
        if (depth + 1 > limits.maxDepth) {
          truncated = true;
          continue;
        }
        for (const c of children) queue.push({ url: c, depth: depth + 1 });
      } else if (doc.urlset) {
        let count = 0;
        for (const entry of asArray(doc.urlset.url)) {
          const loc = String(entry.loc ?? "").trim();
          if (!loc || !accept(loc)) continue;
          if (urls.length >= limits.maxUrls) {
            truncated = true;
            break;
          }
          urls.push({ loc, sitemap: url });
          count++;
        }
        sources.push({ url, status: res.status, kind: "urlset", urlCount: count });
      } else {
        sources.push({
          url,
          status: res.status,
          kind: "invalid",
          urlCount: 0,
          error: "Not a sitemap document",
        });
      }
    } catch (e) {
      const { reason, unsafe } = describeFetchError(e);
      sources.push({ url, status: "error", kind: "error", urlCount: 0, error: reason });
      if (unsafe) continue;
    }
  }
  return { urls, sources, truncated };
}
