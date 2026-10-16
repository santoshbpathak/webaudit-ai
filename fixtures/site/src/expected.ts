/**
 * Planted defects. Integration tests assert that each (path, ruleId) pair produces a
 * `fail` finding — and that clean controls do not. This file is the contract between
 * the fixture site and the rule engine; update both together.
 */

export interface Planted {
  path: string;
  ruleId: string;
  /** Which layer must run for this to be detectable. */
  layer: "http" | "browser" | "site";
  note: string;
}

export const PLANTED: Planted[] = [
  // M01 Technical SEO
  {
    path: "/products/term-plan",
    ruleId: "M01-META-DESC-MISSING",
    layer: "http",
    note: "T01: no meta description",
  },
  { path: "/products/term-plan", ruleId: "M01-H1-MULTIPLE", layer: "http", note: "two H1 elements" },
  { path: "/products/health-plan", ruleId: "M01-TITLE-LENGTH", layer: "http", note: "title > 60 chars" },
  {
    path: "/products/health-plan",
    ruleId: "M01-CANONICAL-CROSS-HOST",
    layer: "http",
    note: "canonical to other host",
  },
  { path: "/about", ruleId: "M01-NOINDEX-IN-SITEMAP", layer: "http", note: "noindex page listed in sitemap" },
  {
    path: "/blog/first-post",
    ruleId: "M01-JSONLD-INVALID",
    layer: "http",
    note: "trailing comma in JSON-LD",
  },
  { path: "/blog/second-post", ruleId: "M01-HREFLANG-INVALID", layer: "http", note: 'hreflang="english"' },
  {
    path: "/blog/first-post",
    ruleId: "M01-TITLE-DUPLICATE",
    layer: "site",
    note: "same title as second-post",
  },
  {
    path: "/blog/",
    ruleId: "M01-BROKEN-INTERNAL-LINK",
    layer: "site",
    note: "links to /blog/missing-post (404)",
  },
  { path: "/old-offer", ruleId: "M01-REDIRECT-CHAIN", layer: "http", note: "2-hop redirect chain" },
  { path: "/contact", ruleId: "M01-CANONICAL-MISSING", layer: "http", note: "no canonical" },

  // M09 Content
  { path: "/about", ruleId: "M09-LANG-MISSING", layer: "http", note: "<html> without lang" },
  { path: "/blog/first-post", ruleId: "M09-THIN-CONTENT", layer: "http", note: "< 150 words" },
  { path: "/blog/first-post", ruleId: "M09-NEAR-DUPLICATE", layer: "site", note: "near-copy of second-post" },

  // M10 Architecture
  {
    path: "/landing/offer",
    ruleId: "M10-ORPHAN-SITEMAP",
    layer: "site",
    note: "in sitemap, no internal links",
  },

  // M03 Accessibility (axe)
  { path: "/", ruleId: "M03-AXE-IMAGE-ALT", layer: "browser", note: "hero image without alt" },
  // axe accepts placeholders as accessible names, so /products/term-plan passes axe "label";
  // M06-FIELD-NO-LABEL still flags placeholder-only fields there. /contact has bare inputs.
  {
    path: "/contact",
    ruleId: "M03-AXE-LABEL",
    layer: "browser",
    note: "inputs with no label or placeholder",
  },

  // M04 GA4 / GTM
  { path: "/", ruleId: "M04-GTM-MULTIPLE", layer: "browser", note: "GTM-FERN01 and GTM-FERN02" },
  {
    path: "/landing/offer",
    ruleId: "M04-GA4-NOT-OBSERVED",
    layer: "browser",
    note: "no GA4 on landing page",
  },

  // M05 Ad pixels
  {
    path: "/landing/offer",
    ruleId: "M05-PIXEL-DUPLICATE",
    layer: "browser",
    note: "TikTok pixel loaded twice",
  },

  // M06 Forms
  {
    path: "/products/term-plan",
    ruleId: "M06-FIELD-NO-LABEL",
    layer: "browser",
    note: "placeholder-only fields",
  },
  {
    path: "/products/term-plan",
    ruleId: "M06-EMAIL-TYPE",
    layer: "browser",
    note: 'email field type="text"',
  },
  {
    path: "/products/term-plan",
    ruleId: "M06-PRECHECKED-OPTIN",
    layer: "browser",
    note: "pre-checked marketing opt-in",
  },
  { path: "/contact", ruleId: "M06-NOVALIDATE", layer: "browser", note: "form novalidate" },

  // M07 CRO / UX
  { path: "/pricing", ruleId: "M07-HORIZONTAL-OVERFLOW", layer: "browser", note: "1400px element on mobile" },
  { path: "/pricing", ruleId: "M07-SMALL-TAP-TARGETS", layer: "browser", note: "10px links" },

  // M08 Consent
  {
    path: "/",
    ruleId: "M08-TRACKING-BEFORE-CONSENT",
    layer: "browser",
    note: "GA4 beacon before interaction",
  },
  { path: "/", ruleId: "M08-PRECHECKED-OPTIONS", layer: "browser", note: "marketing cookies pre-checked" },

  // M09 browser
  { path: "/pricing", ruleId: "M09-BROKEN-IMAGE", layer: "browser", note: "/img/broken.png 404" },
];

/** Must never be fetched by the auditor (robots Disallow). */
export const ROBOTS_BLOCKED = ["/private/partner-rates"];

/** Clean controls: these rules must NOT fail on these pages. */
export const CLEAN: { path: string; ruleId: string }[] = [
  { path: "/", ruleId: "M01-META-DESC-MISSING" },
  { path: "/", ruleId: "M01-TITLE-LENGTH" },
  { path: "/", ruleId: "M01-CANONICAL-MISSING" },
  { path: "/", ruleId: "M01-H1-MULTIPLE" },
  { path: "/contact", ruleId: "M04-GA4-NOT-OBSERVED" },
  { path: "/products/term-plan", ruleId: "M10-ORPHAN-SITEMAP" },
];
