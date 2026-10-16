import type { AuditModule, PageContext, RuleResult, SiteContext } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { jaccardEstimate } from "@webaudit/crawler";
import { check, fail, na, naAll, notHtmlReason, pass, repro, rules } from "./helpers";

const THIN_WORDS = 150;
const NEAR_DUP_JACCARD = 0.8;

const R = rules([
  {
    id: "M09-THIN-CONTENT",
    module: "M09",
    title: "Thin main content",
    severity: "low",
    confidence: "heuristic",
    layer: "http",
    rationale:
      "Pages with very little unique main content struggle to rank and rarely answer a visitor's question fully.",
    remediation:
      "Expand the page with useful, specific content, or consolidate it into a stronger page. Main content: {words} words.",
    caveat: `Threshold is ${THIN_WORDS} words of main content; some pages (contact, tools) are legitimately short.`,
    applicability: "HTML pages except the home page",
  },
  {
    id: "M09-LANG-MISSING",
    module: "M09",
    title: "Missing <html lang> attribute",
    severity: "medium",
    confidence: "verified",
    layer: "http",
    rationale:
      "The lang attribute tells screen readers how to pronounce text and helps search engines and translators.",
    remediation: 'Add lang to the <html> element, e.g. <html lang="en">.',
    applicability: "HTML pages",
  },
  {
    id: "M09-EXACT-DUPLICATE",
    module: "M09",
    title: "Main content identical to another page",
    severity: "medium",
    confidence: "verified",
    layer: "site",
    rationale: "Identical pages split authority and confuse search engines about which to show.",
    remediation:
      "Consolidate duplicates with a 301 redirect or a canonical to the preferred URL. Duplicates: {others}",
    applicability: "HTML pages checked in this audit",
  },
  {
    id: "M09-NEAR-DUPLICATE",
    module: "M09",
    title: "Main content nearly identical to another page",
    severity: "low",
    confidence: "heuristic",
    layer: "site",
    rationale:
      "Near-copies (templated or lightly edited pages) compete with each other and add little for visitors.",
    remediation: "Differentiate the pages or merge them and redirect. Similar to: {others}",
    caveat: `Similarity is an estimated Jaccard index ≥ ${NEAR_DUP_JACCARD} over word 3-shingles of main content (MinHash); review before merging.`,
    applicability: "HTML pages checked in this audit",
  },
  {
    id: "M09-BROKEN-IMAGE",
    module: "M09",
    title: "Images fail to load",
    severity: "medium",
    confidence: "verified",
    layer: "browser",
    rationale:
      "Broken images look unprofessional and remove information (pricing charts, product shots) from the page.",
    remediation: "Fix or replace the image sources: {sources}",
    applicability: "Pages that received browser checks",
  },
]);

function runPage(ctx: PageContext): RuleResult[] {
  const url = ctx.url;
  const reason = notHtmlReason(ctx);
  if (reason) return naAll(["M09-THIN-CONTENT", "M09-LANG-MISSING", "M09-BROKEN-IMAGE"], url, reason);
  const p = ctx.parsed!;
  const out: RuleResult[] = [];
  const isHome = new URL(url).pathname === "/";
  out.push(
    isHome
      ? na("M09-THIN-CONTENT", url, "Home page")
      : check(p.wordCount < THIN_WORDS, "M09-THIN-CONTENT", url, {
          observed: { words: p.wordCount },
          reproSteps: [`Open ${url}`, "Read the main content area (excluding navigation and footer)"],
        }),
  );
  out.push(
    check(!p.lang, "M09-LANG-MISSING", url, {
      selector: "html",
      snippet: "<html>",
      reproSteps: repro.viewSource(url, "<html"),
    }),
  );
  if (ctx.browser) {
    const broken = ctx.browser.brokenImages;
    out.push(
      check(broken.length > 0, "M09-BROKEN-IMAGE", url, {
        selector: broken
          .map((b) => b.selector)
          .slice(0, 3)
          .join(", "),
        observed: {
          sources: broken
            .map((b) => b.src)
            .slice(0, 5)
            .join(", "),
          count: broken.length,
        },
        reproSteps: [`Open ${url}`, "DevTools → Network → filter Img, look for failed requests"],
      }),
    );
  }
  return out;
}

function runSite(site: SiteContext): RuleResult[] {
  const pages = site.pages.filter((p) => !notHtmlReason(p) && (p.parsed?.wordCount ?? 0) >= 20);
  const out: RuleResult[] = [];
  const byHash = new Map<string, string[]>();
  for (const p of pages) byHash.set(p.parsed!.textHash, [...(byHash.get(p.parsed!.textHash) ?? []), p.url]);

  for (const p of pages) {
    const same = byHash.get(p.parsed!.textHash)!.filter((u) => u !== p.url);
    out.push(
      same.length
        ? fail("M09-EXACT-DUPLICATE", p.url, {
            observed: { others: same.slice(0, 5).join(", "), count: same.length + 1 },
            reproSteps: [`Compare the main content of ${p.url} and ${same[0]}`],
          })
        : pass("M09-EXACT-DUPLICATE", p.url),
    );
  }

  // Near-duplicates: O(n²) on ≤ a few thousand pages is fine.
  const near = new Map<string, string[]>();
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const a = pages[i]!;
      const b = pages[j]!;
      if (a.parsed!.textHash === b.parsed!.textHash) continue;
      if (jaccardEstimate(a.parsed!.minhash, b.parsed!.minhash) >= NEAR_DUP_JACCARD) {
        near.set(a.url, [...(near.get(a.url) ?? []), b.url]);
        near.set(b.url, [...(near.get(b.url) ?? []), a.url]);
      }
    }
  }
  for (const p of pages) {
    const sims = near.get(p.url) ?? [];
    out.push(
      sims.length
        ? fail("M09-NEAR-DUPLICATE", p.url, {
            observed: { others: sims.slice(0, 5).join(", "), count: sims.length },
            reproSteps: [`Compare ${p.url} with ${sims[0]}`],
          })
        : pass("M09-NEAR-DUPLICATE", p.url),
    );
  }
  for (const p of site.pages.filter((x) => !notHtmlReason(x) && (x.parsed?.wordCount ?? 0) < 20)) {
    out.push(na("M09-EXACT-DUPLICATE", p.url, "Too little text to compare"));
    out.push(na("M09-NEAR-DUPLICATE", p.url, "Too little text to compare"));
  }
  return out;
}

export const m09Content: AuditModule = {
  id: "M09",
  name: "Content",
  version: "1.0.0",
  rules: R,
  runPage,
  runSite,
  explain: explainFrom(R),
};
