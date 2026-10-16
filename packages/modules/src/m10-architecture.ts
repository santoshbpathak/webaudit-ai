import type { AuditModule, RuleResult, SiteContext } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { check, na, notHtmlReason, rules } from "./helpers";

const MAX_CLICK_DEPTH = 3;

const R = rules([
  {
    id: "M10-ORPHAN-SITEMAP",
    module: "M10",
    title: "Sitemap page with no internal links",
    severity: "medium",
    confidence: "heuristic",
    layer: "site",
    rationale:
      "Pages only reachable from the sitemap get little internal authority and are invisible to visitors browsing the site — common with campaign landing pages.",
    remediation:
      "Link to this page from relevant navigation, hub or related-content sections — or retire it if it is obsolete.",
    caveat:
      "Orphan status is relative to the pages crawled in this audit; links from uncrawled pages are not known.",
    applicability: "Sitemap URLs that were checked",
  },
  {
    id: "M10-DEEP-PAGE",
    module: "M10",
    title: `Page is more than ${MAX_CLICK_DEPTH} clicks from the start URL`,
    severity: "low",
    confidence: "heuristic",
    layer: "site",
    rationale: "Deeply buried pages are crawled less often and are harder for visitors to find.",
    remediation:
      "Flatten the architecture: link to this page from a higher-level hub. Current click depth: {depth}.",
    caveat: "Click depth is measured over links found in this audit.",
    applicability: "HTML pages reachable by links",
  },
  {
    id: "M10-NOT-IN-SITEMAP",
    module: "M10",
    title: "Indexable page missing from the sitemap",
    severity: "low",
    confidence: "heuristic",
    layer: "site",
    rationale:
      "Sitemaps help search engines discover and prioritise pages; omissions often reveal stale sitemap generation.",
    remediation: "Add the page to the XML sitemap, or noindex it if it should not be found.",
    applicability: "Indexable 200 HTML pages, when a sitemap exists",
  },
]);

function runSite(site: SiteContext): RuleResult[] {
  const out: RuleResult[] = [];
  const html = site.pages.filter((p) => !notHtmlReason(p));
  const inlinks = new Map<string, Set<string>>();
  for (const l of site.links) {
    if (l.from === l.to) continue;
    inlinks.set(l.to, (inlinks.get(l.to) ?? new Set()).add(l.from));
  }

  // BFS click depth over the discovered link graph.
  const adj = new Map<string, string[]>();
  for (const l of site.links) adj.set(l.from, [...(adj.get(l.from) ?? []), l.to]);
  const depth = new Map<string, number>([[site.startUrl, 0]]);
  const queue = [site.startUrl];
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of adj.get(u) ?? []) {
      if (!depth.has(v)) {
        depth.set(v, depth.get(u)! + 1);
        queue.push(v);
      }
    }
  }

  const noindex = (p: (typeof html)[number]) =>
    (p.parsed?.robotsMeta ?? []).some((r) => r.includes("noindex"));

  for (const p of html) {
    if (site.sitemapUrls.has(p.url)) {
      const n = inlinks.get(p.url)?.size ?? 0;
      out.push(
        p.url === site.startUrl
          ? na("M10-ORPHAN-SITEMAP", p.url, "Start URL")
          : check(n === 0, "M10-ORPHAN-SITEMAP", p.url, {
              observed: { inlinks: n },
              reproSteps: ["Search the crawled pages for links to this URL", "None were found"],
            }),
      );
    } else out.push(na("M10-ORPHAN-SITEMAP", p.url, "Not listed in a sitemap"));

    const d = depth.get(p.url);
    out.push(
      d === undefined
        ? na("M10-DEEP-PAGE", p.url, "Not reachable via crawled links")
        : check(d > MAX_CLICK_DEPTH, "M10-DEEP-PAGE", p.url, {
            observed: { depth: d },
            reproSteps: [`Shortest link path from ${site.startUrl}: ${d} clicks`],
          }),
    );

    if (!site.sitemapUrls.size) out.push(na("M10-NOT-IN-SITEMAP", p.url, "No sitemap found"));
    else if (noindex(p) || p.http.status !== 200)
      out.push(na("M10-NOT-IN-SITEMAP", p.url, "Not an indexable 200 page"));
    else
      out.push(
        check(!site.sitemapUrls.has(p.url), "M10-NOT-IN-SITEMAP", p.url, {
          reproSteps: ["Open the XML sitemap(s)", `Search for ${p.url}`],
        }),
      );
  }
  return out;
}

export const m10Architecture: AuditModule = {
  id: "M10",
  name: "Architecture",
  version: "1.0.0",
  rules: R,
  runSite,
  explain: explainFrom(R),
};
