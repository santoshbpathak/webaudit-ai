// HTML sources for raster assets (GitHub, social, OG, report). Each template is a standalone
// HTML file kept in assets/<group>/src/ so it can be edited and re-rendered. Copy describes
// implemented features only; product mock-ups show rule names and severities, never invented
// audit metrics.
const FONT_CSS = (fontsRel) => `
@font-face{font-family:Inter;font-weight:400;src:url(${fontsRel}/inter-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:500;src:url(${fontsRel}/inter-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:600;src:url(${fontsRel}/inter-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:700;src:url(${fontsRel}/inter-latin-700-normal.woff2) format("woff2")}
@font-face{font-family:"JetBrains Mono";font-weight:400;src:url(${fontsRel}/jetbrains-mono-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:"JetBrains Mono";font-weight:500;src:url(${fontsRel}/jetbrains-mono-latin-500-normal.woff2) format("woff2")}`;

const BASE = `
*{box-sizing:border-box;margin:0}
html,body{width:var(--w);height:var(--h);overflow:hidden}
body{font-family:Inter,system-ui,sans-serif;background:#0B1220;color:#F2F6FD;-webkit-font-smoothing:antialiased;font-feature-settings:"cv11","ss01"}
.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff07 1px,transparent 1px),linear-gradient(90deg,#ffffff07 1px,transparent 1px);background-size:48px 48px}
.frame{position:relative;width:100%;height:100%;padding:var(--pad,64px);display:flex;flex-direction:column}
.logo{height:var(--logo,40px);width:auto;display:block;align-self:flex-start;flex:none}
h1{font-weight:600;letter-spacing:-.025em;line-height:1.08;color:#F2F6FD}
.lede{color:#C3CEDD;line-height:1.45}
.muted{color:#9AABC2}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace}
.chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #26344A;background:#111A29;color:#C3CEDD;border-radius:6px;padding:6px 12px;font-size:var(--chip,16px);font-weight:500}
.chip i{width:8px;height:8px;transform:rotate(45deg);background:#5CE0BE;display:inline-block}
.panel{background:#111A29;border:1px solid #26344A;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.row{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid #26344A}
.row:last-child{border-bottom:0}
.sev{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:500;color:#C3CEDD;width:110px;flex:none}
.sev b{width:10px;height:10px;border-radius:2px;display:inline-block}
.t{font-size:16px;color:#F2F6FD;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rid{font-size:12px;color:#9AABC2}
.conf{font-size:12px;color:#C3CEDD;border:1px solid #344660;border-radius:5px;padding:3px 8px;flex:none}
.kicker{display:inline-flex;align-items:center;gap:10px;color:#5CE0BE;font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:var(--kick,15px)}
.kicker i{width:9px;height:9px;transform:rotate(45deg);background:#5CE0BE;display:inline-block}
.foot{margin-top:auto;display:flex;align-items:center;gap:24px;color:#9AABC2;font-size:var(--foot,16px)}
.dot{width:4px;height:4px;border-radius:50%;background:#566275}
`;

export const SEV = {
  critical: ["#D03B3B", "Critical"],
  high: ["#EC835A", "High"],
  medium: ["#FAB219", "Medium"],
  low: ["#4C8DF6", "Low"],
};

const issueRows = (rows, scale = 1) =>
  rows
    .map(
      ([sev, title, rule, conf]) => `<div class="row" style="padding:${14 * scale}px ${18 * scale}px">
  <span class="sev" style="font-size:${15 * scale}px;width:${110 * scale}px"><b style="background:${SEV[sev][0]};width:${10 * scale}px;height:${10 * scale}px"></b>${SEV[sev][1]}</span>
  <span class="t" style="font-size:${16 * scale}px">${title}<br><span class="rid mono" style="font-size:${12 * scale}px">${rule}</span></span>
  <span class="conf" style="font-size:${12 * scale}px">${conf}</span></div>`,
    )
    .join("");

/** Real rule titles from the engine; no counts. */
export const SAMPLE_ISSUES = [
  ["high", "Marketing/analytics requests fire before consent", "M08-TRACKING-BEFORE-CONSENT", "Potential"],
  ["high", "No GA4 tag or hit observed on this page", "M04-GA4-NOT-OBSERVED", "Potential"],
  ["high", "Duplicate GA4 page_view hits", "M04-GA4-DUPLICATE-PAGEVIEW", "Confirmed"],
  ["medium", "Missing meta description", "M01-META-DESC-MISSING", "Confirmed"],
  ["medium", "Form fields without an accessible label", "M06-FIELD-NO-LABEL", "Confirmed"],
];

const MODULES = [
  "Technical SEO",
  "Performance",
  "Accessibility",
  "GA4 / GTM",
  "Ad pixels",
  "Lead forms",
  "CRO / UX",
  "Consent",
  "Content",
  "Architecture",
];

export function page({ w, h, title, fontsRel, body, extraCss = "" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${FONT_CSS(fontsRel)}:root{--w:${w}px;--h:${h}px}${BASE}${extraCss}</style></head><body>${body}</body></html>`;
}

// ---- individual templates (return {w,h,title,body,extraCss}) ----

export const TEMPLATES = {
  "github/social-preview": ({ logo }) => ({
    w: 1280,
    h: 640,
    title: "GitHub social preview",
    body: `<div class="grid"></div><div class="frame" style="--pad:72px">
  <img class="logo" src="${logo.horizontalDark}" style="height:44px" alt="WebAudit AI">
  <div style="display:flex;gap:56px;margin-top:64px;align-items:flex-start">
    <div style="flex:1">
      <h1 style="font-size:58px">Website intelligence<br>for marketers.</h1>
      <p class="lede" style="font-size:23px;margin-top:22px;max-width:520px">Evidence-backed audits for SEO, accessibility, analytics, consent and UX. Open source, local-first, AI optional.</p>
    </div>
    <div class="panel" style="width:520px;margin-top:6px">${issueRows(SAMPLE_ISSUES.slice(0, 4), 0.92)}</div>
  </div>
  <div class="foot"><span>Open source · Apache-2.0</span><span class="dot"></span><span>Runs on your machine</span><span class="dot"></span><span>No API key required</span></div>
</div>`,
  }),

  "github/readme-hero": ({ logo }) => ({
    w: 1600,
    h: 520,
    title: "README hero banner",
    body: `<div class="grid"></div><div class="frame" style="--pad:72px;flex-direction:row;align-items:center;gap:72px">
  <div style="flex:1">
    <img class="logo" src="${logo.horizontalDark}" style="height:48px" alt="WebAudit AI">
    <h1 style="font-size:54px;margin-top:40px">Turn website complexity<br>into actionable clarity.</h1>
    <p class="lede" style="font-size:22px;margin-top:20px;max-width:640px">Crawl a site, run repeatable checks and get a prioritised, evidence-backed backlog — on your own machine.</p>
  </div>
  <div class="panel" style="width:600px">${issueRows(SAMPLE_ISSUES, 0.95)}</div>
</div>`,
  }),

  "github/feature-evidence": ({ logo }) => ({
    w: 1200,
    h: 600,
    title: "Feature graphic — evidence",
    body: `<div class="grid"></div><div class="frame">
  <span class="kicker"><i></i>Evidence, not opinions</span>
  <h1 style="font-size:46px;margin-top:18px;max-width:900px">Every finding links to what was actually observed.</h1>
  <div class="panel mono" style="margin-top:36px;padding:26px 30px;font-size:17px;line-height:1.75;color:#C3CEDD">
    <div><span class="muted">selector</span>&nbsp;&nbsp; form#quote-form &gt; input:nth-of-type(2)</div>
    <div><span class="muted">request</span>&nbsp;&nbsp;&nbsp; https://www.google-analytics.com/g/collect?…&amp;cid=REDACTED</div>
    <div><span class="muted">reproduce</span>&nbsp; Open the page in a private window → DevTools → Network → filter “collect”</div>
  </div>
  <div class="foot"><img src="${logo.symbolDark}" style="height:28px" alt=""><span>Sensitive parameters are redacted before anything is stored.</span></div>
</div>`,
  }),

  "github/feature-coverage": ({ logo }) => ({
    w: 1200,
    h: 600,
    title: "Feature graphic — coverage",
    extraCss: `.bar{height:12px;border-radius:6px;background:#1D2B40;overflow:hidden}.bar i{display:block;height:100%;border-radius:6px}`,
    body: `<div class="grid"></div><div class="frame">
  <span class="kicker"><i></i>Honest coverage</span>
  <h1 style="font-size:46px;margin-top:18px;max-width:940px">See what was checked, sampled, skipped — and why.</h1>
  <div class="panel" style="margin-top:36px;padding:26px 30px;display:grid;gap:18px;font-size:18px;color:#C3CEDD">
    ${[
      ["Discovered", 100, "#5CE0BE"],
      ["Checked over HTTP", 88, "#5CE0BE"],
      ["Browser-sampled", 32, "#5CE0BE"],
      ["Blocked by robots.txt", 6, "#566275"],
      ["Skipped, with a reason", 10, "#566275"],
    ]
      .map(
        ([l, v, c]) =>
          `<div style="display:grid;grid-template-columns:260px 1fr;align-items:center;gap:20px"><span>${l}</span><div class="bar"><i style="width:${v}%;background:${c}"></i></div></div>`,
      )
      .join("")}
  </div>
  <div class="foot"><img src="${logo.symbolDark}" style="height:28px" alt=""><span>Illustrative proportions. Every finding states its tested denominator.</span></div>
</div>`,
  }),

  "github/feature-martech": ({ logo }) => ({
    w: 1200,
    h: 600,
    title: "Feature graphic — MarTech",
    body: `<div class="grid"></div><div class="frame">
  <span class="kicker"><i></i>Built for marketing teams</span>
  <h1 style="font-size:46px;margin-top:18px;max-width:960px">GA4, tag manager, ad pixels, forms and consent — checked in a real browser.</h1>
  <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:40px;--chip:19px">${["Google Analytics 4", "Google Tag Manager", "Meta Pixel", "Google Ads", "LinkedIn Insight", "TikTok Pixel", "Microsoft UET", "Consent banners", "Lead forms"].map((x) => `<span class="chip"><i></i>${x}</span>`).join("")}</div>
  <div class="foot"><img src="${logo.symbolDark}" style="height:28px" alt=""><span>Findings say “not observed in the tested flow” — never “missing site-wide”.</span></div>
</div>`,
  }),

  "github/contributor-banner": ({ logo }) => ({
    w: 1280,
    h: 400,
    title: "Contributor banner",
    body: `<div class="grid"></div><div class="frame" style="--pad:56px">
  <img class="logo" src="${logo.horizontalDark}" style="height:36px" alt="WebAudit AI">
  <h1 style="font-size:44px;margin-top:34px">Built in the open. Contributions welcome.</h1>
  <p class="lede" style="font-size:20px;margin-top:12px">New rules, tag signatures, fixtures, docs and translations — see CONTRIBUTING.md.</p>
  <div class="foot" style="gap:10px;--chip:14px">${MODULES.map((m) => `<span class="chip">${m}</span>`).join("")}</div>
</div>`,
  }),

  "github/release": ({ logo, version, highlights }) => ({
    w: 1200,
    h: 630,
    title: "Release announcement",
    body: `<div class="grid"></div><div class="frame">
  <div style="display:flex;align-items:center;justify-content:space-between"><img class="logo" src="${logo.horizontalDark}" style="height:38px" alt="WebAudit AI"><span class="chip mono" style="--chip:18px">${version}</span></div>
  <span class="kicker" style="margin-top:48px"><i></i>New release</span>
  <h1 style="font-size:50px;margin-top:14px">${version === "v0.1.0" ? "First public release" : "What’s new"}</h1>
  <ul style="margin-top:28px;padding:0;list-style:none;display:grid;gap:14px;font-size:21px;color:#C3CEDD">${highlights.map((h) => `<li style="display:flex;gap:14px;align-items:baseline"><i style="width:8px;height:8px;transform:rotate(45deg);background:#5CE0BE;flex:none;display:inline-block;margin-top:9px"></i>${h}</li>`).join("")}</ul>
  <div class="foot"><span>Release notes in CHANGELOG.md</span></div>
</div>`,
  }),

  "social/linkedin-launch": ({ logo }) => ({
    w: 1200,
    h: 627,
    title: "LinkedIn launch post",
    body: `<div class="grid"></div><div class="frame">
  <img class="logo" src="${logo.horizontalDark}" style="height:40px" alt="WebAudit AI">
  <div style="display:flex;gap:48px;margin-top:52px">
    <div style="flex:1"><span class="kicker"><i></i>Now open source</span><h1 style="font-size:50px;margin-top:16px">Audit your website the way your team actually works.</h1>
    <p class="lede" style="font-size:21px;margin-top:18px">SEO, accessibility, analytics, consent and UX — grouped into a prioritised backlog with evidence.</p></div>
    <div class="panel" style="width:430px;align-self:center">${issueRows(SAMPLE_ISSUES.slice(0, 3), 0.85)}</div>
  </div>
  <div class="foot"><span>Local-first</span><span class="dot"></span><span>No API key required</span><span class="dot"></span><span>AI optional</span></div>
</div>`,
  }),

  "social/square-announcement": ({ logo }) => ({
    w: 1080,
    h: 1080,
    title: "Square announcement",
    body: `<div class="grid"></div><div class="frame" style="--pad:80px">
  <img class="logo" src="${logo.horizontalDark}" style="height:44px" alt="WebAudit AI">
  <span class="kicker" style="margin-top:110px;--kick:18px"><i></i>Now open source</span>
  <h1 style="font-size:72px;margin-top:22px">Website intelligence for marketers.</h1>
  <p class="lede" style="font-size:28px;margin-top:28px">Evidence-backed audits that run on your own machine.</p>
  <div class="panel" style="margin-top:56px">${issueRows(SAMPLE_ISSUES.slice(0, 3), 1.1)}</div>
  <div class="foot" style="--foot:20px"><span>Apache-2.0</span><span class="dot"></span><span>AI optional</span></div>
</div>`,
  }),

  "social/vertical-announcement": ({ logo }) => ({
    w: 1080,
    h: 1350,
    title: "Vertical announcement",
    body: `<div class="grid"></div><div class="frame" style="--pad:80px">
  <img class="logo" src="${logo.horizontalDark}" style="height:46px" alt="WebAudit AI">
  <span class="kicker" style="margin-top:150px;--kick:19px"><i></i>Now open source</span>
  <h1 style="font-size:84px;margin-top:26px">Turn website complexity into actionable clarity.</h1>
  <p class="lede" style="font-size:29px;margin-top:30px">Crawl, check and prioritise — SEO, accessibility, analytics, consent and UX.</p>
  <div class="panel" style="margin-top:80px">${issueRows(SAMPLE_ISSUES, 1.12)}</div>
  <div class="foot" style="--foot:21px"><span>Local-first</span><span class="dot"></span><span>No API key required</span><span class="dot"></span><span>AI optional</span></div>
</div>`,
  }),

  "social/showcase-card": ({ logo }) => ({
    w: 1200,
    h: 675,
    title: "Product showcase card",
    body: `<div class="grid"></div><div class="frame" style="flex-direction:row;gap:56px;align-items:center">
  <div style="width:420px"><img class="logo" src="${logo.horizontalDark}" style="height:36px" alt="WebAudit AI"><h1 style="font-size:44px;margin-top:36px">One backlog. Every finding with evidence.</h1>
  <p class="lede" style="font-size:20px;margin-top:16px">Grouped by template, ranked by severity, reach and confidence.</p></div>
  <div class="panel" style="flex:1">${issueRows(SAMPLE_ISSUES, 0.9)}</div>
</div>`,
  }),

  "social/template-feature": ({ logo }) => ({
    w: 1200,
    h: 627,
    title: "New feature announcement (template)",
    body: `<div class="grid"></div><div class="frame">
  <img class="logo" src="${logo.horizontalDark}" style="height:36px" alt="WebAudit AI">
  <span class="kicker" style="margin-top:72px"><i></i>New feature</span>
  <h1 style="font-size:54px;margin-top:16px" data-slot="headline">Consent Mode–aware tracking checks</h1>
  <p class="lede" style="font-size:22px;margin-top:18px;max-width:900px" data-slot="body">Google Consent Mode “denied” pings are no longer reported as tracking before consent.</p>
  <div class="foot"><span data-slot="meta">Available in WebAudit AI · see CHANGELOG.md</span></div>
</div>`,
  }),

  "social/template-update": ({ logo }) => ({
    w: 1200,
    h: 627,
    title: "Product update (template)",
    body: `<div class="grid"></div><div class="frame">
  <div style="display:flex;justify-content:space-between;align-items:center"><img class="logo" src="${logo.horizontalDark}" style="height:36px" alt="WebAudit AI"><span class="chip mono" data-slot="version">v0.x.0</span></div>
  <span class="kicker" style="margin-top:64px"><i></i>Product update</span>
  <h1 style="font-size:50px;margin-top:16px" data-slot="headline">[Update headline — one benefit, plainly stated]</h1>
  <ul style="margin-top:26px;padding:0;list-style:none;display:grid;gap:12px;font-size:21px;color:#C3CEDD" data-slot="items"><li>· [Change 1]</li><li>· [Change 2]</li><li>· [Change 3]</li></ul>
  <div class="foot"><span>Template — replace bracketed text before publishing</span></div>
</div>`,
  }),

  "social/template-contributor": ({ logo }) => ({
    w: 1080,
    h: 1080,
    title: "Contributor appreciation (template)",
    body: `<div class="grid"></div><div class="frame" style="--pad:80px;align-items:flex-start">
  <img class="logo" src="${logo.horizontalDark}" style="height:44px" alt="WebAudit AI">
  <span class="kicker" style="margin-top:150px;--kick:18px"><i></i>Thank you</span>
  <h1 style="font-size:76px;margin-top:22px" data-slot="name">@[contributor]</h1>
  <p class="lede" style="font-size:30px;margin-top:26px" data-slot="body">for [contribution — e.g. a new tag signature, fixture or translation].</p>
  <div class="foot" style="--foot:20px"><span>Template — replace bracketed text before publishing</span></div>
</div>`,
  }),

  "social/og-default": ({ logo }) => ({
    w: 1200,
    h: 630,
    title: "Default Open Graph image",
    body: `<div class="grid"></div><div class="frame" style="justify-content:center;align-items:flex-start">
  <img src="${logo.symbolDark}" style="height:96px" alt="">
  <h1 style="font-size:64px;margin-top:40px">WebAudit AI</h1>
  <p class="lede" style="font-size:26px;margin-top:14px">Open-source website intelligence for marketers.</p>
</div>`,
  }),
};
