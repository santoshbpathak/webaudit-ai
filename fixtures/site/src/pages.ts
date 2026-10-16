/**
 * Fernhill Finance — a fictional brand. Every page plants specific, documented defects.
 * The planted defects are listed in PLANTED (see expected.ts) and asserted by tests.
 */

export interface PageOpts {
  title?: string;
  description?: string;
  lang?: string | null;
  canonical?: string;
  robots?: string;
  head?: string;
  body: string;
  /** Include the standard GTM + GA4 + consent banner stack. */
  tracking?: "full" | "none" | "custom";
  nav?: boolean;
}

const NAV = `
<header class="site-header">
  <a href="/" class="logo">Fernhill Finance</a>
  <nav aria-label="Main">
    <a href="/products/term-plan">Term plan</a>
    <a href="/products/health-plan">Health plan</a>
    <a href="/pricing">Pricing</a>
    <a href="/blog/">Blog</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
  </nav>
</header>`;

const FOOTER = `
<footer>
  <a href="/private/partner-rates">Partner rates</a>
  <a href="/old-offer">Spring offer</a>
  <a href="/files/brochure.pdf">Brochure (PDF)</a>
  <a href="/trap/calendar?page=1">Events calendar</a>
  <a href="https://example.org/regulator">Regulator</a>
  <p>&copy; Fernhill Finance (fictional test site)</p>
</footer>`;

/** Consent banner + GTM + GA4. GA4 fires BEFORE consent (planted M08 defect). */
const TRACKING_FULL = `
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  dataLayer.push({ event: "page_meta", page_type: document.body ? document.body.dataset.type : "unknown" });
</script>
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-FERN01"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FERN0001"></script>
<script>
  gtag("js", new Date());
  gtag("config", "G-FERN0001");
  navigator.sendBeacon("https://www.google-analytics.com/g/collect?v=2&tid=G-FERN0001&cid=123.456&en=page_view&dl=" + encodeURIComponent(location.href));
  document.cookie = "_ga=GA1.1.123.456; path=/; max-age=63072000";
</script>`;

const CONSENT_BANNER = `
<div id="cookie-banner" class="cookie-banner" role="dialog" aria-label="Cookie consent">
  <p>We use cookies to improve your experience.</p>
  <label><input type="checkbox" name="marketing_cookies" checked> Marketing cookies</label>
  <button id="accept-cookies" onclick="document.getElementById('cookie-banner').remove()">Accept all</button>
  <button id="reject-cookies" onclick="document.getElementById('cookie-banner').remove()">Reject</button>
</div>`;

const STYLE = `
<style>
  body { font-family: system-ui, sans-serif; margin: 0; color: #1d2433; }
  .site-header { display: flex; gap: 1rem; padding: 1rem; background: #f4f6fa; }
  main { max-width: 860px; margin: 0 auto; padding: 1rem; }
  .cta { display: inline-block; background: #0b6bcb; color: #fff; padding: .8rem 1.2rem; border-radius: 6px; text-decoration: none; }
  .cookie-banner { position: fixed; bottom: 0; left: 0; right: 0; background: #222; color: #fff; padding: 1rem; }
  .low-contrast { color: #c7c7c7; background: #ffffff; }
  footer { padding: 2rem 1rem; background: #f4f6fa; display: flex; gap: 1rem; flex-wrap: wrap; }
</style>`;

export function layout(o: PageOpts, type = "page"): string {
  const lang = o.lang === null ? "" : ` lang="${o.lang ?? "en"}"`;
  const tracking = o.tracking ?? "full";
  return `<!doctype html>
<html${lang}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${o.title !== undefined ? `<title>${o.title}</title>` : ""}
${o.description !== undefined ? `<meta name="description" content="${o.description}">` : ""}
${o.canonical ? `<link rel="canonical" href="${o.canonical}">` : ""}
${o.robots ? `<meta name="robots" content="${o.robots}">` : ""}
${STYLE}
${tracking === "full" ? TRACKING_FULL : ""}
${o.head ?? ""}
</head>
<body data-type="${type}">
${o.nav === false ? "" : NAV}
<main>
${o.body}
</main>
${FOOTER}
${tracking === "full" ? CONSENT_BANNER : ""}
</body>
</html>`;
}

const WORDS =
  "cover premium claim policy family nominee rider term health hospital cashless renewal benefit tax savings income protection surrender maturity advisor quote budget monthly annual secure digital process document medical waiting period exclusion network bonus portability deductible copay critical illness accident disability retirement goal plan child education loan home spouse parent senior lifestyle wellness".split(
    " ",
  );

/** Deterministic PRNG (mulberry32) so a page renders identical text on every request. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Page-specific prose: distinct per key so only planted pages look like duplicates. */
function paragraphs(n: number, key: string): string {
  const r = rng(key);
  const sentence = () => {
    const len = 8 + Math.floor(r() * 10);
    const w = Array.from({ length: len }, () => WORDS[Math.floor(r() * WORDS.length)]!);
    return w[0]!.charAt(0).toUpperCase() + w[0]!.slice(1) + " " + w.slice(1).join(" ") + ".";
  };
  return Array.from({ length: n }, () => `<p>${Array.from({ length: 5 }, sentence).join(" ")}</p>`).join(
    "\n",
  );
}

export type PageFn = (origin: string) => { status?: number; headers?: Record<string, string>; html: string };

export const PAGES: Record<string, PageFn> = {
  "/": (origin) => ({
    html: layout(
      {
        title: "Fernhill Finance — Term & Health Insurance Made Simple",
        description:
          "Compare term and health insurance plans from Fernhill Finance. Get a quote in two minutes.",
        canonical: `${origin}/`,
        head: `<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-FERN02"></script>
<script>!function(f,b,e,v,n,t,s){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','111222333444');fbq('track','PageView');</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Fernhill Finance","url":"${origin}/"}</script>`,
        body: `
<h1>Insurance that explains itself</h1>
<p>Protect what matters with plans built around real families.</p>
<a class="cta" href="/contact">Get a free quote</a>
<img src="/img/hero.svg" width="600" height="300">
<h2>Why Fernhill</h2>
${paragraphs(3, "/")}
<a href="/products/term-plan">Explore term plans</a>
<a href="/blog/">Read our guides</a>`,
      },
      "home",
    ),
  }),

  "/products/term-plan": (origin) => ({
    html: layout(
      {
        title: "Term Plan | Fernhill Finance",
        canonical: `${origin}/products/term-plan`,
        body: `
<h1>Term Plan</h1>
<h1>Cover up to 2 crore</h1>
<p>Pure protection with optional riders.</p>
${paragraphs(4, "/products/term-plan")}
<form id="quote-form" action="/api/quote" method="post">
  <input type="text" name="full_name" placeholder="Your name">
  <input type="text" name="email" placeholder="Email">
  <input type="tel" name="phone" placeholder="Mobile">
  <label><input type="checkbox" name="marketing_optin" checked> Send me offers</label>
  <button type="submit">Get my quote</button>
</form>`,
      },
      "product",
    ),
  }),

  "/products/health-plan": () => ({
    html: layout(
      {
        title:
          "Health Plan with Cashless Hospitalisation, Maternity Cover, OPD Benefits and No-Claim Bonus | Fernhill Finance Insurance",
        description: "Family health insurance with cashless hospitalisation across 8,000 hospitals.",
        canonical: "https://www.other-domain.example/health-plan",
        body: `
<h1>Health Plan</h1>
${paragraphs(4, "/products/health-plan")}
<a class="cta" href="/contact">Talk to an advisor</a>`,
      },
      "product",
    ),
  }),

  "/about": () => ({
    html: layout(
      {
        title: "About Fernhill Finance",
        description: "Fernhill Finance is a fictional insurer used to test WebAudit AI.",
        lang: null,
        robots: "noindex, follow",
        body: `<h1>About us</h1>${paragraphs(3, "/about")}<p class="low-contrast">Registered office details.</p>`,
      },
      "about",
    ),
  }),

  "/contact": () => ({
    html: layout(
      {
        title: "Contact Fernhill Finance",
        description: "Talk to a Fernhill advisor.",
        head: `<script>(function(){window._linkedin_data_partner_ids=["7654321"];var s=document.createElement("script");s.async=true;s.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";document.head.appendChild(s);})();</script>`,
        body: `
<h1>Contact us</h1>
<p>Request a callback and an advisor will reach out.</p>
<form id="lead-form" action="/api/lead" method="post" novalidate>
  <label for="name">Name</label>
  <input id="name" name="name" type="text" required autocomplete="name">
  <input name="email" type="text">
  <input name="phone" type="text">
  <select name="product"><option>Term</option><option>Health</option></select>
  <textarea name="message"></textarea>
  <input type="text" name="website_url" style="display:none" tabindex="-1">
  <button type="submit">Request callback</button>
</form>`,
      },
      "contact",
    ),
  }),

  "/blog/": () => ({
    html: layout(
      {
        title: "Guides | Fernhill Finance",
        description: "Plain-language guides to insurance.",
        body: `
<h1>Guides</h1>
<ul>
  <li><a href="/blog/first-post">How much term cover do you need?</a></li>
  <li><a href="/blog/second-post">How much term cover do you need? (updated)</a></li>
  <li><a href="/blog/missing-post">Claims explained</a></li>
  <li><a href="/blog/first-post?utm_source=newsletter&utm_medium=email">Newsletter pick</a></li>
</ul>`,
      },
      "blog-index",
    ),
  }),

  "/blog/first-post": () => ({
    html: layout(
      {
        title: "How much term cover do you need?",
        description: "A simple way to estimate your cover.",
        head: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article", "headline": "How much cover" ,}</script>`,
        body: `<h1>How much term cover do you need?</h1><p>Multiply your annual income by ten and add your loans. That is a starting point, not advice.</p>`,
      },
      "article",
    ),
  }),

  "/blog/second-post": () => ({
    html: layout(
      {
        title: "How much term cover do you need?",
        description: "A simple way to estimate your cover.",
        head: `<link rel="alternate" hreflang="english" href="/blog/second-post"><link rel="alternate" hreflang="hi-IN" href="/hi/blog/second-post">`,
        body: `<h1>How much term cover do you need?</h1><p>Multiply your annual income by ten and add your loans. That is a starting point, not advice. Updated.</p>`,
      },
      "article",
    ),
  }),

  "/pricing": () => ({
    html: layout(
      {
        title: "Pricing | Fernhill Finance",
        description: "Transparent premiums for every plan.",
        head: `<script src="/js/blocking.js"></script>`,
        body: `
<h1>Pricing</h1>
${paragraphs(6, "/pricing")}
<div style="width: 1400px; background:#eef">Comparison table (overflows on mobile)</div>
<p><a href="/contact" style="font-size:10px;padding:0">quote</a> <a href="/about" style="font-size:10px;padding:0">about</a></p>
<img src="/img/broken.png" alt="Premium chart">
<a class="cta" href="/contact">Buy now</a>`,
      },
      "pricing",
    ),
  }),

  "/landing/offer": () => ({
    html: layout(
      {
        title: "Spring Offer — 10% off first year | Fernhill Finance",
        description: "Limited-time offer on term plans.",
        tracking: "custom",
        head: `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var s=d.createElement("script");s.async=true;s.src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CFERN123";d.head.appendChild(s);}(window,document,"ttq");</script>
<script async src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CFERN123"></script>`,
        body: `<h1>Spring offer</h1><p>Save 10% on your first year.</p><a class="cta" href="/contact">Claim offer</a>${paragraphs(2, "/landing/offer")}`,
      },
      "landing",
    ),
  }),

  "/private/partner-rates": () => ({
    html: layout({
      title: "Partner rates",
      description: "Should never be fetched.",
      body: "<h1>Private</h1>",
    }),
  }),
};

export const BLOCKING_JS = `/* render-blocking on purpose */ (function(){ var s = Date.now(); while (Date.now() - s < 120) {} })();`;

export const HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#0b6bcb"/><text x="40" y="160" font-size="36" fill="#fff">Fernhill</text></svg>`;

/** Large-site mode: generated product/article pages with planted duplicates (T02). */
export function largePage(n: number): string {
  const missingDesc = n % 10 === 0;
  return layout(
    {
      title: `Guide ${n} | Fernhill Finance`,
      description: missingDesc ? undefined : `Guide number ${n} about insurance basics.`,
      tracking: "none",
      body: `<h1>Guide ${n}</h1>${paragraphs(2, `large-${n}`)}<a href="/large/${n + 1}">Next guide</a> <a href="/large/${Math.max(1, n - 1)}?ref=prev">Previous</a>`,
    },
    "large",
  );
}
