import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { ParsedHtml, ParsedLink } from "@webaudit/core";
import { sha1 } from "@webaudit/core";
import { normalizeUrl, siteHost } from "./normalize";
import { minhashSketch, simhash } from "./simhash";

function cssPath($: cheerio.CheerioAPI, el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.type === "tag" && parts.length < 5) {
    const id = $(cur).attr("id");
    if (id) {
      parts.unshift(`${cur.tagName}#${id}`);
      break;
    }
    const parent: Element | null = cur.parent && cur.parent.type === "tag" ? (cur.parent as Element) : null;
    const siblings = parent ? $(parent).children(cur.tagName) : $(cur.tagName);
    const idx = siblings.index(cur);
    parts.unshift(siblings.length > 1 ? `${cur.tagName}:nth-of-type(${idx + 1})` : cur.tagName);
    cur = parent;
  }
  return parts.join(" > ");
}

/** Template fingerprint: the set of distinct tag.class paths to depth 4, independent of content length. */
function domSignature($: cheerio.CheerioAPI): string {
  const paths = new Set<string>();
  const walk = (el: Element, prefix: string, depth: number) => {
    if (depth > 4) return;
    for (const child of $(el).children().toArray()) {
      if (child.type !== "tag" || ["script", "style", "noscript", "svg"].includes(child.tagName)) continue;
      const cls = ($(child).attr("class") ?? "").split(/\s+/).filter(Boolean).sort()[0];
      const key = `${prefix}/${child.tagName}${cls ? "." + cls : ""}`;
      paths.add(key);
      walk(child, key, depth + 1);
    }
  };
  const body = $("body").get(0);
  if (body) walk(body, "", 0);
  return sha1([...paths].sort().join("|")).slice(0, 12);
}

export function parseHtml(
  html: string,
  pageUrl: string,
  opts: { stripParams?: string[]; xRobotsTag?: string } = {},
): ParsedHtml {
  const $ = cheerio.load(html);
  const base = $("base[href]").attr("href");
  const resolveBase = base ? (normalizeUrl(base, pageUrl) ?? pageUrl) : pageUrl;
  const pageHost = siteHost(new URL(pageUrl).hostname);

  const links: ParsedLink[] = $("a[href], area[href]")
    .toArray()
    .map((el) => {
      const raw = $(el).attr("href") ?? "";
      const url = normalizeUrl(raw, resolveBase, opts);
      return {
        url,
        raw: raw.slice(0, 500),
        text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 120),
        rel: ($(el).attr("rel") ?? "").toLowerCase(),
        internal: url ? siteHost(new URL(url).hostname) === pageHost : false,
      };
    });

  const jsonLd = $('script[type="application/ld+json"]')
    .toArray()
    .map((el) => {
      const raw = $(el).text().trim();
      try {
        const data = JSON.parse(raw) as unknown;
        const nodes = Array.isArray(data) ? data : ((data as { "@graph"?: unknown[] })["@graph"] ?? [data]);
        const types = (nodes as { "@type"?: string | string[] }[])
          .flatMap((n) => (n && n["@type"] ? [n["@type"]].flat() : []))
          .map(String);
        return { valid: true, types, excerpt: raw.slice(0, 200) };
      } catch (e) {
        return {
          valid: false,
          error: (e as Error).message.slice(0, 200),
          types: [],
          excerpt: raw.slice(0, 200),
        };
      }
    });

  // Main-content text: shared navigation/footer boilerplate would make every page of a
  // site look like a near-duplicate of every other.
  const $text = cheerio.load(html);
  $text("script, style, noscript, template, svg, iframe").remove();
  const main = $text("main, article, [role=main]").first();
  if (!main.length)
    $text("nav, header, footer, aside, [role=navigation], [role=banner], [role=contentinfo]").remove();
  const text = (main.length ? main : $text("body")).text().replace(/\s+/g, " ").trim();
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];

  return {
    titles: $("title")
      .toArray()
      .filter((el) => $(el).closest("svg").length === 0)
      .map((el) => $(el).text().replace(/\s+/g, " ").trim()),
    metaDescriptions: $('meta[name="description" i]')
      .toArray()
      .map((el) => ($(el).attr("content") ?? "").trim()),
    canonicals: $('link[rel="canonical" i]')
      .toArray()
      .map((el) => normalizeUrl($(el).attr("href") ?? "", resolveBase) ?? $(el).attr("href") ?? ""),
    robotsMeta: $('meta[name="robots" i], meta[name="googlebot" i]')
      .toArray()
      .map((el) => ($(el).attr("content") ?? "").toLowerCase()),
    xRobotsTag: opts.xRobotsTag,
    lang: $("html").attr("lang")?.trim() || undefined,
    viewport: $('meta[name="viewport" i]').attr("content") ?? undefined,
    charset: $("meta[charset]").attr("charset") ?? undefined,
    headings: $("h1, h2, h3, h4, h5, h6")
      .toArray()
      .map((el) => ({
        level: Number(el.tagName[1]),
        text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 200),
      })),
    hreflang: $('link[rel="alternate" i][hreflang]')
      .toArray()
      .map((el) => ({ lang: $(el).attr("hreflang") ?? "", href: $(el).attr("href") ?? "" })),
    jsonLd,
    links,
    images: $("img")
      .toArray()
      .slice(0, 300)
      .map((el) => ({
        src: $(el).attr("src") ?? $(el).attr("data-src") ?? "",
        alt: $(el).attr("alt") ?? null,
        selector: cssPath($, el),
      })),
    scriptSrcs: $("script[src]")
      .toArray()
      .map((el) => $(el).attr("src") ?? ""),
    inlineScripts: $("script:not([src])")
      .toArray()
      .map((el) => $(el).text())
      .join("\n")
      .slice(0, 50_000),
    wordCount: words.length,
    textHash: sha1(words.join(" ").toLowerCase()),
    simhash: simhash(text),
    minhash: minhashSketch(text),
    domSignature: domSignature($),
    formCount: $("form").length,
  };
}
