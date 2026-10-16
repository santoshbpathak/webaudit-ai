import type { AuditModule, PageContext, RuleResult, SiteContext } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { siteHost } from "@webaudit/crawler";
import { check, fail, na, naAll, notHtmlReason, notTested, pass, repro, rules, truncate } from "./helpers";

const R = rules([
  {
    id: "M01-HTTP-ERROR",
    module: "M01",
    title: "Page returns an HTTP error",
    severity: "high",
    confidence: "verified",
    layer: "http",
    rationale:
      "Error pages waste crawl budget, break user journeys and lose any ranking or campaign traffic they receive.",
    remediation:
      "Restore the page, or 301-redirect it to the closest relevant live page and update internal links.",
    applicability: "Every fetched URL",
  },
  {
    id: "M01-REDIRECT-CHAIN",
    module: "M01",
    title: "Redirect chain (more than one hop)",
    severity: "medium",
    confidence: "verified",
    layer: "http",
    rationale:
      "Each extra hop adds latency for visitors and can dilute signals passed to the final URL; campaign links through chains load slower.",
    remediation: "Point the original URL (and internal links) directly at the final destination: {chain}.",
    applicability: "URLs that redirect",
  },
  {
    id: "M01-TITLE-MISSING",
    module: "M01",
    title: "Missing or empty <title>",
    severity: "high",
    confidence: "verified",
    layer: "http",
    rationale:
      "The title is the headline searchers see in results and in browser tabs; without it search engines invent one.",
    remediation:
      "Add a unique, descriptive <title> (roughly 30–60 characters) that leads with the page's main topic.",
    applicability: "HTML pages",
  },
  {
    id: "M01-TITLE-LENGTH",
    module: "M01",
    title: "Title length outside 15–60 characters",
    severity: "low",
    confidence: "heuristic",
    layer: "http",
    rationale: "Very long titles are truncated in results; very short ones rarely describe the page well.",
    remediation: 'Rewrite the title to about 30–60 characters. Current ({length} chars): "{title}"',
    caveat: "Search engines truncate by pixel width, not characters; this is an approximation.",
    applicability: "HTML pages with a title",
  },
  {
    id: "M01-TITLE-MULTIPLE",
    module: "M01",
    title: "Multiple <title> elements",
    severity: "low",
    confidence: "verified",
    layer: "http",
    rationale: "Duplicate title tags are usually a template bug; search engines pick one unpredictably.",
    remediation: "Keep a single <title> in the <head>.",
    applicability: "HTML pages",
  },
  {
    id: "M01-META-DESC-MISSING",
    module: "M01",
    title: "Missing meta description",
    severity: "medium",
    confidence: "verified",
    layer: "http",
    rationale:
      "The meta description is your ad copy in organic results. Without one, search engines pull arbitrary page text, which usually lowers click-through.",
    remediation:
      'Add a <meta name="description"> of roughly 70–160 characters summarising the page and its benefit.',
    applicability: "HTML pages",
  },
  {
    id: "M01-META-DESC-LENGTH",
    module: "M01",
    title: "Meta description length outside 50–160 characters",
    severity: "low",
    confidence: "heuristic",
    layer: "http",
    rationale: "Overlong descriptions are cut off; very short ones under-use the space.",
    remediation: "Rewrite to about 70–160 characters. Current length: {length}.",
    caveat: "Display length varies by device and query.",
    applicability: "HTML pages with a meta description",
  },
  {
    id: "M01-CANONICAL-MISSING",
    module: "M01",
    title: "No canonical link",
    severity: "low",
    confidence: "verified",
    layer: "http",
    rationale:
      "Canonical tags tell search engines which URL to index when parameters or tracking codes create variants.",
    remediation: 'Add <link rel="canonical" href="{url}"> (self-referencing) to the template.',
    applicability: "Indexable HTML pages",
  },
  {
    id: "M01-CANONICAL-CROSS-HOST",
    module: "M01",
    title: "Canonical points to a different host",
    severity: "high",
    confidence: "verified",
    layer: "http",
    rationale:
      "A cross-domain canonical asks search engines to index another site's URL instead of this page — often a copy-paste or staging-domain bug.",
    remediation: "Change the canonical to this site's preferred URL. Currently: {canonical}",
    caveat: "Intentional for syndicated content; verify before changing.",
    applicability: "HTML pages with a canonical",
  },
  {
    id: "M01-CANONICAL-MULTIPLE",
    module: "M01",
    title: "Multiple canonical links",
    severity: "medium",
    confidence: "verified",
    layer: "http",
    rationale: "Conflicting canonicals are ignored by search engines.",
    remediation: "Keep exactly one rel=canonical in the <head>.",
    applicability: "HTML pages",
  },
  {
    id: "M01-NOINDEX-IN-SITEMAP",
    module: "M01",
    title: "Noindex page listed in the sitemap",
    severity: "high",
    confidence: "verified",
    layer: "http",
    rationale:
      "The sitemap says 'index this' while the page says 'do not index' — mixed signals that often hide an accidental noindex on a page you want found.",
    remediation:
      "Decide the intent: remove noindex if the page should rank, or drop it from the sitemap if not.",
    applicability: "Pages listed in a sitemap",
  },
  {
    id: "M01-H1-MISSING",
    module: "M01",
    title: "No H1 heading",
    severity: "medium",
    confidence: "verified",
    layer: "http",
    rationale:
      "The H1 is the visible headline for people and a strong topical signal for search engines and screen readers.",
    remediation: "Add one H1 that states the page's main topic.",
    applicability: "HTML pages",
  },
  {
    id: "M01-H1-MULTIPLE",
    module: "M01",
    title: "Multiple H1 headings",
    severity: "low",
    confidence: "verified",
    layer: "http",
    rationale: "Several H1s blur the page's main message and its document outline.",
    remediation: "Keep one H1; demote the others to H2. Found: {h1s}",
    applicability: "HTML pages",
  },
  {
    id: "M01-HREFLANG-INVALID",
    module: "M01",
    title: "Invalid hreflang value",
    severity: "medium",
    confidence: "verified",
    layer: "http",
    rationale:
      "Search engines ignore hreflang annotations with invalid language/region codes, so the wrong language version may be shown.",
    remediation:
      "Use ISO 639-1 language (and optional ISO 3166-1 region) codes such as en, en-IN, hi-IN, or x-default. Invalid: {invalid}",
    applicability: "Pages with hreflang annotations",
  },
  {
    id: "M01-JSONLD-INVALID",
    module: "M01",
    title: "Structured data (JSON-LD) does not parse",
    severity: "medium",
    confidence: "verified",
    layer: "http",
    rationale: "Broken JSON-LD is ignored entirely, so the page loses eligibility for rich results.",
    remediation: "Fix the JSON syntax ({error}) and validate with a structured-data testing tool.",
    caveat: "Only syntax is checked here, not schema.org vocabulary or rich-result eligibility.",
    applicability: "Pages with JSON-LD",
  },
  {
    id: "M01-VIEWPORT-MISSING",
    module: "M01",
    title: "No mobile viewport meta tag",
    severity: "high",
    confidence: "verified",
    layer: "http",
    rationale:
      "Without a viewport tag mobile browsers render a zoomed-out desktop page — poor UX and a mobile-friendliness failure.",
    remediation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    applicability: "HTML pages",
  },
  {
    id: "M01-TITLE-DUPLICATE",
    module: "M01",
    title: "Duplicate title across pages",
    severity: "medium",
    confidence: "verified",
    layer: "site",
    rationale:
      "Pages competing with identical titles confuse searchers and search engines about which page answers the query.",
    remediation: 'Give each page a unique title. Shared title: "{title}" ({count} pages).',
    applicability: "Indexable HTML pages checked in this audit",
  },
  {
    id: "M01-META-DESC-DUPLICATE",
    module: "M01",
    title: "Duplicate meta description across pages",
    severity: "low",
    confidence: "verified",
    layer: "site",
    rationale:
      "Templated descriptions make every result look the same and are often rewritten by search engines.",
    remediation: "Write page-specific descriptions. Shared by {count} pages.",
    applicability: "HTML pages with a meta description",
  },
  {
    id: "M01-BROKEN-INTERNAL-LINK",
    module: "M01",
    title: "Links to broken internal URLs",
    severity: "high",
    confidence: "verified",
    layer: "site",
    rationale: "Broken links strand visitors mid-journey and waste crawl budget.",
    remediation: "Update or remove the links to: {targets}",
    applicability: "HTML pages with internal links whose targets were checked",
  },
  {
    id: "M01-SITEMAP-NON-200",
    module: "M01",
    title: "Sitemap lists a URL that redirects or errors",
    severity: "medium",
    confidence: "verified",
    layer: "site",
    rationale:
      "Sitemaps should only list final, indexable URLs; non-200 entries reduce trust in the sitemap.",
    remediation: "Replace the entry with its final URL or remove it from the sitemap.",
    applicability: "URLs listed in a sitemap",
  },
]);

const PAGE_RULES = R.filter((r) => r.layer === "http").map((r) => r.id);
const HREFLANG_RE = /^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i;

function isNoindex(ctx: PageContext): boolean {
  return (
    (ctx.parsed?.robotsMeta ?? []).some((r) => r.includes("noindex") || r.includes("none")) ||
    /noindex/i.test(ctx.parsed?.xRobotsTag ?? "")
  );
}

function runPage(ctx: PageContext): RuleResult[] {
  const url = ctx.url;
  const out: RuleResult[] = [];
  const { http } = ctx;

  // Status and redirects apply to every URL.
  out.push(
    check(
      http.status >= 400,
      "M01-HTTP-ERROR",
      url,
      {
        httpStatus: http.status,
        reproSteps: [`Request ${url}`, `Observe HTTP ${http.status}`],
      },
      { severity: http.status >= 500 ? "critical" : "high" },
    ),
  );
  if (http.redirectChain.length) {
    const chain = [...http.redirectChain.map((h) => `${h.url} (${h.status})`), http.finalUrl].join(" → ");
    out.push(
      check(http.redirectChain.length > 1, "M01-REDIRECT-CHAIN", url, {
        httpStatus: http.redirectChain[0]!.status,
        observed: { chain, hops: http.redirectChain.length },
        reproSteps: [`curl -sIL "${url}"`, `Count the Location hops: ${http.redirectChain.length}`],
      }),
    );
  } else out.push(na("M01-REDIRECT-CHAIN", url, "No redirect"));

  const reason = notHtmlReason(ctx);
  if (reason)
    return [
      ...out,
      ...naAll(
        PAGE_RULES.filter((id) => !out.some((o) => o.ruleId === id)),
        url,
        reason,
      ),
    ];
  const p = ctx.parsed!;
  const title = p.titles[0] ?? "";
  const noindex = isNoindex(ctx);

  out.push(check(!title, "M01-TITLE-MISSING", url, { reproSteps: repro.viewSource(url, "<title>") }));
  if (title) {
    out.push(
      check(title.length < 15 || title.length > 60, "M01-TITLE-LENGTH", url, {
        snippet: `<title>${truncate(title, 200)}</title>`,
        observed: { title: truncate(title, 120), length: title.length },
        reproSteps: repro.viewSource(url, "<title>"),
      }),
    );
  } else out.push(na("M01-TITLE-LENGTH", url, "No title"));
  out.push(
    check(p.titles.length > 1, "M01-TITLE-MULTIPLE", url, {
      observed: { count: p.titles.length },
      reproSteps: repro.viewSource(url, "<title>"),
    }),
  );

  const desc = p.metaDescriptions.find((d) => d.trim()) ?? "";
  out.push(
    check(!desc, "M01-META-DESC-MISSING", url, {
      selector: 'head > meta[name="description"]',
      snippet: p.metaDescriptions.length
        ? `<meta name="description" content="">`
        : "(no meta description element)",
      reproSteps: repro.viewSource(url, '<meta name="description"'),
    }),
  );
  if (desc) {
    out.push(
      check(desc.length < 50 || desc.length > 160, "M01-META-DESC-LENGTH", url, {
        snippet: truncate(desc, 200),
        observed: { length: desc.length },
        reproSteps: repro.viewSource(url, '<meta name="description"'),
      }),
    );
  } else out.push(na("M01-META-DESC-LENGTH", url, "No meta description"));

  if (noindex) out.push(na("M01-CANONICAL-MISSING", url, "Page is noindex"));
  else
    out.push(
      check(p.canonicals.length === 0, "M01-CANONICAL-MISSING", url, {
        observed: { url },
        reproSteps: repro.viewSource(url, 'rel="canonical"'),
      }),
    );
  if (p.canonicals.length) {
    let cross: boolean;
    try {
      cross = siteHost(new URL(p.canonicals[0]!).hostname) !== siteHost(new URL(url).hostname);
    } catch {
      cross = false;
    }
    out.push(
      check(cross, "M01-CANONICAL-CROSS-HOST", url, {
        snippet: `<link rel="canonical" href="${p.canonicals[0]}">`,
        observed: { canonical: p.canonicals[0] },
        reproSteps: repro.viewSource(url, 'rel="canonical"'),
      }),
    );
  } else out.push(na("M01-CANONICAL-CROSS-HOST", url, "No canonical"));
  out.push(
    check(p.canonicals.length > 1, "M01-CANONICAL-MULTIPLE", url, {
      observed: { canonicals: p.canonicals },
      reproSteps: repro.viewSource(url, 'rel="canonical"'),
    }),
  );

  if (ctx.inSitemap === undefined)
    out.push(notTested("M01-NOINDEX-IN-SITEMAP", url, "Sitemaps not loaded in this mode"));
  else if (!ctx.inSitemap) out.push(na("M01-NOINDEX-IN-SITEMAP", url, "Not listed in a sitemap"));
  else
    out.push(
      check(noindex, "M01-NOINDEX-IN-SITEMAP", url, {
        snippet: p.robotsMeta.length
          ? `<meta name="robots" content="${p.robotsMeta[0]}">`
          : `X-Robots-Tag: ${p.xRobotsTag}`,
        reproSteps: [...repro.viewSource(url, 'name="robots"'), "Confirm the URL appears in the sitemap"],
      }),
    );

  const h1s = p.headings.filter((h) => h.level === 1).map((h) => h.text);
  out.push(
    check(h1s.length === 0, "M01-H1-MISSING", url, { selector: "h1", reproSteps: repro.inspect(url, "h1") }),
  );
  out.push(
    check(h1s.length > 1, "M01-H1-MULTIPLE", url, {
      selector: "h1",
      observed: { h1s: h1s.map((t) => `"${truncate(t, 60)}"`).join(", "), count: h1s.length },
      reproSteps: repro.inspect(url, "h1"),
    }),
  );

  if (p.hreflang.length) {
    const invalid = p.hreflang.filter((h) => !HREFLANG_RE.test(h.lang)).map((h) => h.lang);
    out.push(
      check(invalid.length > 0, "M01-HREFLANG-INVALID", url, {
        snippet: invalid.map((l) => `hreflang="${l}"`).join(" "),
        observed: { invalid: invalid.join(", ") },
        reproSteps: repro.viewSource(url, "hreflang="),
      }),
    );
  } else out.push(na("M01-HREFLANG-INVALID", url, "No hreflang annotations"));

  if (p.jsonLd.length) {
    const bad = p.jsonLd.find((j) => !j.valid);
    out.push(
      bad
        ? fail("M01-JSONLD-INVALID", url, {
            selector: 'script[type="application/ld+json"]',
            snippet: bad.excerpt,
            observed: { error: bad.error },
            reproSteps: repro.viewSource(url, "application/ld+json"),
          })
        : pass("M01-JSONLD-INVALID", url, { observed: { types: p.jsonLd.flatMap((j) => j.types) } }),
    );
  } else out.push(na("M01-JSONLD-INVALID", url, "No JSON-LD"));

  out.push(
    check(!p.viewport, "M01-VIEWPORT-MISSING", url, {
      selector: 'meta[name="viewport"]',
      reproSteps: repro.viewSource(url, 'name="viewport"'),
    }),
  );
  return out;
}

function htmlPages(site: SiteContext): PageContext[] {
  return site.pages.filter((p) => !notHtmlReason(p));
}

function runSite(site: SiteContext): RuleResult[] {
  const out: RuleResult[] = [];
  const pages = htmlPages(site).filter((p) => !isNoindex(p));

  const dupes = (key: (p: PageContext) => string | undefined, ruleId: string, label: string) => {
    const groups = new Map<string, string[]>();
    for (const p of pages) {
      const k = key(p)?.trim().toLowerCase();
      if (!k) {
        out.push(na(ruleId, p.url, `No ${label}`));
        continue;
      }
      groups.set(k, [...(groups.get(k) ?? []), p.url]);
    }
    for (const [k, urls] of groups) {
      for (const u of urls) {
        out.push(
          urls.length > 1
            ? fail(ruleId, u, {
                observed: {
                  title: truncate(k, 120),
                  count: urls.length,
                  others: urls.filter((x) => x !== u).slice(0, 10),
                },
                reproSteps: [`Compare the ${label} of: ${urls.slice(0, 5).join(", ")}`],
              })
            : pass(ruleId, u),
        );
      }
    }
  };
  dupes((p) => p.parsed?.titles[0], "M01-TITLE-DUPLICATE", "title");
  dupes((p) => p.parsed?.metaDescriptions[0], "M01-META-DESC-DUPLICATE", "meta description");

  // Broken internal links — only targets whose outcome is known count.
  const linksFrom = new Map<string, Set<string>>();
  for (const l of site.links) linksFrom.set(l.from, (linksFrom.get(l.from) ?? new Set()).add(l.to));
  for (const p of htmlPages(site)) {
    const targets = [...(linksFrom.get(p.url) ?? [])];
    const known = targets.filter((t) => site.statusByUrl.has(t));
    if (!known.length) {
      out.push(na("M01-BROKEN-INTERNAL-LINK", p.url, "No checked internal link targets"));
      continue;
    }
    const broken = known.filter((t) => {
      const s = site.statusByUrl.get(t);
      return s === "failed" || (typeof s === "number" && s >= 400);
    });
    out.push(
      broken.length
        ? fail("M01-BROKEN-INTERNAL-LINK", p.url, {
            observed: {
              targets: broken
                .slice(0, 10)
                .map((t) => `${t} (${site.statusByUrl.get(t)})`)
                .join(", "),
              count: broken.length,
            },
            selector: broken
              .slice(0, 3)
              .map((t) => `a[href*="${new URL(t).pathname}"]`)
              .join(", "),
            reproSteps: [
              `Open ${p.url}`,
              `Find links to: ${broken.slice(0, 3).join(", ")}`,
              "Follow them and observe the error",
            ],
          })
        : pass("M01-BROKEN-INTERNAL-LINK", p.url, { observed: { checkedTargets: known.length } }),
    );
  }

  for (const u of site.sitemapUrls) {
    const s = site.statusByUrl.get(u);
    if (s === undefined || s === "skipped" || s === "blocked") continue;
    const page = site.pages.find((p) => p.url === u);
    const redirected = !!page?.http.redirectChain.length;
    const bad = s === "failed" || (typeof s === "number" && s >= 300) || redirected;
    out.push(
      check(bad, "M01-SITEMAP-NON-200", u, {
        httpStatus: typeof s === "number" ? s : undefined,
        reproSteps: [`curl -sI "${u}"`, "Confirm the sitemap entry is not a final 200 URL"],
      }),
    );
  }
  return out;
}

export const m01Seo: AuditModule = {
  id: "M01",
  name: "Technical SEO",
  version: "1.0.0",
  rules: R,
  runPage,
  runSite,
  explain: explainFrom(R),
};
