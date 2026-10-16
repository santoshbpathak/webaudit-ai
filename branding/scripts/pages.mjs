// Multi-section HTML deliverables: audit-report template (with real fixture data), the three
// brand directions sheet, and the browsable / printable brand book.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CONCEPTS, symbolSvg } from "./logo.mjs";
import { ILLUSTRATIONS, illustrationSvg } from "./illustrations.mjs";
import { ratio } from "./contrast.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tokens = JSON.parse(readFileSync(join(root, "tokens/colors.json"), "utf8"));
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const lucide = (name, size = 20) =>
  readFileSync(join(dirname(require.resolve("lucide-static/package.json")), "icons", `${name}.svg`), "utf8")
    .replace(/width="24"/, `width="${size}"`)
    .replace(/height="24"/, `height="${size}"`)
    .replace(/class="[^"]*"/, 'aria-hidden="true"');

const FONTS = (rel) => `
@font-face{font-family:Inter;font-weight:400;src:url(${rel}/inter-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:500;src:url(${rel}/inter-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:600;src:url(${rel}/inter-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:700;src:url(${rel}/inter-latin-700-normal.woff2) format("woff2")}
@font-face{font-family:"JetBrains Mono";font-weight:400;src:url(${rel}/jetbrains-mono-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:"JetBrains Mono";font-weight:500;src:url(${rel}/jetbrains-mono-latin-500-normal.woff2) format("woff2")}`;

const SEV = Object.fromEntries(
  Object.entries(tokens.status)
    .filter(([k]) => !k.startsWith("$"))
    .map(([k, v]) => [k, v]),
);
const SEV_ICON = {
  critical: "octagon-alert",
  high: "triangle-alert",
  medium: "circle-alert",
  low: "info",
  info: "circle-dot",
  passed: "circle-check",
  notTested: "circle-dashed",
};
const sevBadge = (k, size = 14) =>
  `<span class="sev"><span class="sev-ic" style="color:${SEV[k].$value}">${lucide(SEV_ICON[k], size)}</span>${SEV[k].label}</span>`;

// ------------------------------------------------------------------ report template
function reportHtml(r) {
  const c = r.coverage;
  const sevCount = {};
  for (const b of r.backlog) sevCount[b.severity] = (sevCount[b.severity] ?? 0) + 1;
  const total = r.backlog.length || 1;
  const f = r.findings.find((x) => x.evidence?.selector && x.evidence?.reproSteps?.length) ?? r.findings[0];
  const date = new Date(r.audit.finishedAt ?? r.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const foot = (n) =>
    `<footer class="rfoot"><span>WebAudit AI · ${esc(r.audit.host)} · ${date}</span><span>Page ${n}</span></footer>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Audit report template · WebAudit AI</title>
<style>${FONTS("../fonts")}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0}
body{font-family:Inter,sans-serif;color:#0B1220;background:#e9edf3;font-size:10.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;background:#fff;margin:0 auto 12mm;padding:18mm 18mm 22mm;position:relative;overflow:hidden;page-break-after:always}
@media print{body{background:#fff}.page{margin:0}}
.mono{font-family:"JetBrains Mono",monospace}
h1{font-size:28pt;letter-spacing:-.02em;line-height:1.1;font-weight:600}h2{font-size:15pt;font-weight:600;margin-bottom:4mm;letter-spacing:-.01em}h3{font-size:10.5pt;font-weight:600;margin:5mm 0 2mm}
.kick{display:flex;gap:2mm;align-items:center;color:#0B7A66;font-weight:600;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3mm}.kick i{width:2.2mm;height:2.2mm;background:#0E9478;transform:rotate(45deg);display:inline-block}
.muted{color:#566275}.small{font-size:8.5pt}
.cover{background:#0B1220;color:#F2F6FD;padding:22mm}
.cover .muted{color:#9AABC2}
.cover-grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:9mm 9mm}
.cover-inner{position:relative;height:100%;display:flex;flex-direction:column}
.meta{display:grid;grid-template-columns:auto 1fr;gap:2mm 8mm;margin-top:auto;font-size:9.5pt}
.meta dt{color:#9AABC2}.meta dd{margin:0}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin:5mm 0}
.stat{border:1px solid #DFE5EE;border-radius:3mm;padding:3.5mm}.stat b{display:block;font-size:17pt;font-weight:600;font-variant-numeric:tabular-nums}.stat span{font-size:8pt;color:#566275}
.bar{display:flex;gap:.6mm;height:3mm;border-radius:1mm;overflow:hidden;margin:2mm 0 3mm}
.sev{display:inline-flex;align-items:center;gap:1.4mm;font-weight:500}.sev-ic{display:inline-flex}
.legend{display:flex;gap:6mm;flex-wrap:wrap;font-size:9pt}
table{width:100%;border-collapse:collapse;font-size:9pt}th{text-align:left;font-weight:500;color:#566275;font-size:7.5pt;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #C3CCDA;padding:1.6mm 2mm}td{border-bottom:1px solid #DFE5EE;padding:2mm;vertical-align:top}td.n{text-align:right;font-variant-numeric:tabular-nums}
.meter{height:1.6mm;background:#E7ECF3;border-radius:1mm;overflow:hidden;margin-top:1mm}.meter i{display:block;height:100%;background:#0B7A66}
.conf{border:1px solid #C3CCDA;border-radius:1mm;padding:.3mm 1.6mm;font-size:7.5pt;color:#334155;white-space:nowrap}
.ev{border:1px solid #DFE5EE;border-radius:3mm;overflow:hidden}.ev header{background:#F1F4F9;padding:2.5mm 3.5mm;font-size:8.5pt;display:flex;justify-content:space-between}.ev dl{padding:3.5mm;display:grid;grid-template-columns:28mm 1fr;gap:2mm;font-size:8.5pt}.ev dt{color:#566275}.ev dd{margin:0;word-break:break-all}.ev pre{background:#F6F8FB;border-radius:2mm;padding:2.5mm;white-space:pre-wrap;font-size:7.5pt}
.callout{border-left:2px solid #0E9478;background:#F1F4F9;padding:3mm 4mm;font-size:9pt;margin:4mm 0}
ol.recs{padding-left:5mm;display:grid;gap:3mm}ol.recs li{padding-left:1mm}
.rfoot{position:absolute;left:18mm;right:18mm;bottom:10mm;display:flex;justify-content:space-between;font-size:7.5pt;color:#566275;border-top:1px solid #DFE5EE;padding-top:2.5mm}
.cover .rfoot{display:none}
.sample{position:absolute;top:8mm;right:18mm;font-size:7pt;color:#566275;border:1px solid #DFE5EE;border-radius:1mm;padding:.5mm 2mm}
.cover .sample{color:#9AABC2;border-color:#344660}
</style></head><body>

<section class="page cover"><div class="cover-grid"></div><span class="sample">Template · sample data from the bundled fixture site</span><div class="cover-inner">
<img src="../logos/primary-horizontal-reverse.svg" style="height:11mm;width:auto;align-self:flex-start" alt="WebAudit AI">
<div style="margin-top:58mm"><div class="kick" style="color:#5CE0BE"><i style="background:#5CE0BE"></i>Website audit report</div>
<h1 style="font-size:34pt">${esc(r.audit.host)}</h1><p class="muted" style="font-size:13pt;margin-top:4mm">${esc(r.summary.headline)}</p></div>
<dl class="meta"><dt>Start URL</dt><dd class="mono">${esc(r.audit.url)}</dd><dt>Mode</dt><dd>${esc(r.audit.mode)} · ${esc(r.audit.config.device)}</dd><dt>Completed</dt><dd>${date}</dd><dt>Status</dt><dd>${esc(r.audit.status)}</dd><dt>Engine</dt><dd class="mono">webaudit ${esc(r.audit.engineVersions?.webaudit)} · axe-core ${esc(r.audit.engineVersions?.["axe-core"] ?? "—")} · Lighthouse ${esc(r.audit.engineVersions?.lighthouse ?? "—")}</dd></dl>
</div>${foot(1)}</section>

<section class="page"><span class="sample">Template · sample data</span><div class="kick"><i></i>Executive summary</div><h2>What we found</h2>
<p>${esc(r.summary.headline)}</p><p class="muted small" style="margin-top:2mm">${esc(r.summary.scope)}</p>
<div class="stats"><div class="stat"><b>${r.backlog.length}</b><span>Issue groups</span></div><div class="stat"><b>${c.checked}</b><span>URLs checked</span></div><div class="stat"><b>${c.sampled}</b><span>Browser-sampled</span></div><div class="stat"><b>${r.lighthouse.medianScore ?? "—"}</b><span>Lighthouse lab (median)</span></div></div>
<h3>Issue groups by severity</h3>
<div class="bar">${["critical", "high", "medium", "low", "info"]
    .filter((s) => sevCount[s])
    .map((s) => `<i style="width:${(sevCount[s] / total) * 100}%;background:${SEV[s].$value}"></i>`)
    .join("")}</div>
<div class="legend">${["critical", "high", "medium", "low", "info"]
    .filter((s) => sevCount[s])
    .map((s) => `<span>${sevBadge(s, 12)} <b>${sevCount[s]}</b></span>`)
    .join("")}</div>
<div class="callout">${esc(r.summary.coverageNote)}</div>
<h3>Category results <span class="muted small">— checks passed / checks evaluated</span></h3>
<table><thead><tr><th>Category</th><th class="n">Pages tested</th><th class="n">Groups</th><th style="width:38%">Checks passed</th></tr></thead><tbody>
${r.modules.map((m) => `<tr><td>${esc(m.name)}</td><td class="n">${m.pagesTested}</td><td class="n">${m.groups}</td><td>${m.checksEvaluated ? `${Math.round((m.checksPassed / m.checksEvaluated) * 100)}% <span class="muted small">(${m.checksPassed}/${m.checksEvaluated})</span><div class="meter"><i style="width:${(m.checksPassed / m.checksEvaluated) * 100}%"></i></div>` : `<span class="muted">Not tested</span>`}</td></tr>`).join("")}
</tbody></table>
${foot(2)}</section>

<section class="page"><span class="sample">Template · sample data</span><div class="kick"><i></i>Priorities</div><h2>Top issues and recommendations</h2>
<table><thead><tr><th>#</th><th>Issue</th><th>Severity</th><th>Confidence</th><th class="n">Affected / tested</th></tr></thead><tbody>
${r.backlog
  .slice(0, 10)
  .map(
    (b) =>
      `<tr><td class="n">${b.rank}</td><td>${esc(b.title)}<div class="mono muted small">${esc(b.ruleId)} · ${esc(b.templateHint)}</div></td><td>${sevBadge(b.severity, 12)}</td><td><span class="conf">${{ verified: "Confirmed", heuristic: "Potential", manual_review: "Manual review" }[b.confidence]}</span></td><td class="n">${b.affectedPages} / ${b.testedPages}</td></tr>`,
  )
  .join("")}
</tbody></table>
<h3>Recommended actions</h3>
<ol class="recs">${r.backlog
    .slice(0, 5)
    .map((b) => `<li><b>${esc(b.title)}.</b> ${esc(b.action)}</li>`)
    .join("")}</ol>
${foot(3)}</section>

<section class="page"><span class="sample">Template · sample data</span><div class="kick"><i></i>Evidence</div><h2>How findings are evidenced</h2>
<p class="muted">Every finding records what was observed so a developer can reproduce it. Sensitive parameters are redacted before storage.</p>
<div class="ev" style="margin-top:5mm"><header><span class="mono">${esc(f.url)}</span><span class="mono muted">${esc(f.findingId)}</span></header><dl>
<dt>Rule</dt><dd class="mono">${esc(f.ruleId)}</dd>
${f.evidence.selector ? `<dt>Selector</dt><dd class="mono">${esc(f.evidence.selector)}</dd>` : ""}
${f.evidence.requestUrl ? `<dt>Request</dt><dd class="mono">${esc(f.evidence.requestUrl)}</dd>` : ""}
${f.evidence.snippet ? `<dt>Snippet</dt><dd><pre class="mono">${esc(f.evidence.snippet)}</pre></dd>` : ""}
<dt>Reproduce</dt><dd><ol style="padding-left:4mm">${f.evidence.reproSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></dd>
<dt>Recommended</dt><dd>${esc(f.recommendedAction)}</dd></dl></div>
<h3 style="margin-top:9mm">Methodology</h3>
<p class="small">Pages are discovered from robots.txt, sitemaps and internal links. HTTP checks run on every fetched page; browser checks (performance, accessibility, tags, forms, UX, consent) run on a stratified sample. Issues are grouped by rule and inferred page template and ranked by a transparent priority index: severity × reach × confidence × importance.</p>
<h3>Limitations</h3><ul class="small" style="padding-left:4mm">${r.summary.limitations.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
${foot(4)}</section>
</body></html>`;
}

// ------------------------------------------------------------------ directions sheet
export const DIRECTIONS = [
  {
    id: "A",
    name: "Midnight Intelligence",
    concept:
      "A diagnostics console at night: deep navy, one teal signal colour, precise geometry. Calm enough for long sessions, sharp enough that findings pop.",
    bg: "#0B1220",
    surface: "#111A29",
    line: "#26344A",
    ink: "#F2F6FD",
    muted: "#9AABC2",
    accent: "#5CE0BE",
    accentInk: "#04221B",
    secondary: ["#1D2B40", "#7BE8CB", "#4C8DF6"],
    type: "Inter · JetBrains Mono",
  },
  {
    id: "B",
    name: "Signal & Clarity",
    concept:
      "An enterprise analytics report: white surfaces, confident blue, cyan for signals. Instantly familiar to marketing and BI users.",
    bg: "#F7F9FC",
    surface: "#FFFFFF",
    line: "#DCE3EC",
    ink: "#0F172A",
    muted: "#556274",
    accent: "#1F5BD8",
    accentInk: "#FFFFFF",
    secondary: ["#E8EFFC", "#0E7490", "#64748B"],
    type: "IBM Plex Sans · IBM Plex Mono",
  },
  {
    id: "C",
    name: "Graphite Intelligence",
    concept:
      "A developer tool: graphite neutrals, a single violet accent, monospaced detail. Signals 'built by engineers' immediately.",
    bg: "#111113",
    surface: "#18181B",
    line: "#2A2A2F",
    ink: "#FAFAFA",
    muted: "#A1A1AA",
    accent: "#9D8CFF",
    accentInk: "#140F2E",
    secondary: ["#232327", "#C4B8FF", "#52525B"],
    type: "Geist · Geist Mono",
  },
];

function directionsHtml() {
  const sym = CONCEPTS[0];
  const cards = DIRECTIONS.map((d) => {
    const acc = ratio(d.accent, d.surface).toFixed(1);
    const mut = ratio(d.muted, d.surface).toFixed(1);
    const btn = ratio(d.accentInk, d.accent).toFixed(1);
    return `<section class="dir" style="--bg:${d.bg};--s:${d.surface};--l:${d.line};--i:${d.ink};--m:${d.muted};--a:${d.accent};--ai:${d.accentInk}">
<p class="lbl">Direction ${d.id}</p><h2>${d.name}</h2><p class="c">${d.concept}</p>
<div class="sw">${[d.bg, d.surface, d.line, d.ink, d.muted, d.accent, ...d.secondary].map((x) => `<span style="background:${x}" title="${x}"></span>`).join("")}</div>
<p class="type">${d.type}</p>
<div class="logo">${symbolSvg(sym, { ink: d.ink, signal: d.accent }, { size: 40 })}<b>WebAudit</b><span>AI</span></div>
<div class="ui"><div class="hd"><b>Top issues</b><button>Start audit</button></div>
<div class="r"><i style="background:#EC835A"></i>Tracking before consent<em>9 / 9</em></div>
<div class="r"><i style="background:#FAB219"></i>Missing meta description<em>12 / 122</em></div>
<div class="r"><i style="background:#4C8DF6"></i>No canonical link<em>131 / 131</em></div></div>
<p class="a11y">Contrast — accent on surface ${acc}:1 · muted text ${mut}:1 · button text ${btn}:1</p></section>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Brand directions · WebAudit AI</title><style>${FONTS("../assets/fonts")}
*{box-sizing:border-box;margin:0}body{font-family:Inter,sans-serif;background:#e9edf3;padding:28px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;width:1440px}
.dir{background:var(--bg);color:var(--i);border-radius:14px;padding:26px;border:1px solid var(--l)}
.lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--a);font-weight:600}h2{font-size:24px;letter-spacing:-.02em;margin-top:6px}
.c{color:var(--m);font-size:13px;line-height:1.5;margin-top:8px;min-height:60px}.sw{display:flex;gap:6px;margin-top:16px}.sw span{width:34px;height:34px;border-radius:7px;border:1px solid var(--l)}
.type{font-size:12px;color:var(--m);margin-top:10px}.logo{display:flex;align-items:center;gap:10px;margin-top:18px;font-size:22px;letter-spacing:-.02em}.logo b{font-weight:600}.logo span{color:var(--m);font-weight:500}
.ui{background:var(--s);border:1px solid var(--l);border-radius:10px;margin-top:18px;overflow:hidden}.hd{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--l);font-size:13px}
button{background:var(--a);color:var(--ai);border:0;border-radius:6px;padding:7px 12px;font:600 12px Inter}.r{display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;border-bottom:1px solid var(--l)}.r:last-child{border:0}.r i{width:9px;height:9px;border-radius:2px}.r em{margin-left:auto;font-style:normal;color:var(--m);font-variant-numeric:tabular-nums}
.a11y{font-size:11px;color:var(--m);margin-top:14px}
</style></head><body>${cards}</body></html>`;
}

// ------------------------------------------------------------------ brand book
function brandBookHtml(MASTER) {
  const catalogue = existsSync(join(root, "assets/catalogue.json"))
    ? JSON.parse(readFileSync(join(root, "assets/catalogue.json"), "utf8"))
    : { rasters: [] };
  const t = tokens.theme;
  const swatch = (name, theme) => {
    const v = t[theme][name].$value;
    const surf = t[theme].surface.$value;
    const r = v.startsWith("#") ? ratio(v, surf).toFixed(2) : "—";
    return `<div class="swatch"><span style="background:${v}"></span><b>${name}</b><code>${v}</code><small>${r}:1 on surface</small></div>`;
  };
  const names = [
    "canvas",
    "surface",
    "surface-raised",
    "surface-overlay",
    "border",
    "border-input",
    "text",
    "text-secondary",
    "text-muted",
    "accent",
    "success",
    "warning",
    "danger",
    "info",
  ];
  const cats = [
    ["search", "Technical SEO"],
    ["gauge", "Performance"],
    ["accessibility", "Accessibility"],
    ["chart-column", "Analytics"],
    ["shield-check", "Privacy & consent"],
    ["mouse-pointer-click", "Conversion / UX"],
    ["radar", "Crawling"],
    ["sparkles", "AI interpretation"],
    ["list-checks", "Recommendations"],
    ["file-text", "Reports"],
    ["triangle-alert", "Warnings"],
    ["octagon-alert", "Critical"],
  ];
  const assets = catalogue.rasters
    .map(
      (a) =>
        `<figure><img src="../${a.file}" loading="lazy" alt="${esc(a.title)}"><figcaption>${esc(a.title)} <code>${a.width}×${a.height}</code></figcaption></figure>`,
    )
    .join("");
  const logos = [
    ["primary-horizontal.svg", "Primary horizontal", "light"],
    ["primary-horizontal-reverse.svg", "Reverse (dark backgrounds)", "dark"],
    ["stacked.svg", "Stacked", "light"],
    ["stacked-reverse.svg", "Stacked reverse", "dark"],
    ["symbol.svg", "Symbol", "light"],
    ["symbol-small.svg", "Symbol — small-size master (≤ 32 px)", "light"],
    ["mono-dark-horizontal.svg", "Monochrome dark", "light"],
    ["mono-light-horizontal.svg", "Monochrome light", "dark"],
  ];
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebAudit AI · Brand book</title>
<link rel="stylesheet" href="../tokens/semantic-tokens.css"><link rel="icon" href="../assets/favicons/favicon.svg">
<style>${FONTS("../assets/fonts")}
*{box-sizing:border-box}body{margin:0;background:var(--wa-canvas);color:var(--wa-text);font:15px/1.6 var(--wa-font-sans);-webkit-font-smoothing:antialiased}
code,.mono{font-family:var(--wa-font-mono);font-size:.86em}
.wrap{max-width:1120px;margin:0 auto;padding:40px 24px 80px}
nav.toc{position:sticky;top:0;z-index:5;background:var(--wa-canvas);border-bottom:1px solid var(--wa-border);display:flex;gap:16px;overflow-x:auto;padding:12px 24px;font-size:13px}
nav.toc a{color:var(--wa-text-muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--wa-text)}
nav.toc button{margin-left:auto;background:var(--wa-surface);color:var(--wa-text);border:1px solid var(--wa-border-input);border-radius:6px;padding:4px 10px;font:inherit;cursor:pointer}
h1{font-size:44px;letter-spacing:-.03em;line-height:1.1;margin:28px 0 12px}h2{font-size:26px;letter-spacing:-.02em;margin:64px 0 8px;padding-top:12px;border-top:1px solid var(--wa-border)}h3{font-size:15px;margin:28px 0 10px}
p.lead{font-size:18px;color:var(--wa-text-secondary);max-width:760px}.muted{color:var(--wa-text-muted)}
.prov{display:inline-block;background:var(--wa-success-subtle);color:var(--wa-success);border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600}
.grid{display:grid;gap:16px}.g2{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}.g3{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.g4{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.card{background:var(--wa-surface);border:1px solid var(--wa-border);border-radius:var(--wa-radius-lg);padding:20px}
.logo-tile{border-radius:var(--wa-radius-lg);border:1px solid var(--wa-border);padding:28px;display:grid;place-items:center;min-height:150px}.logo-tile.light{background:#fff}.logo-tile.dark{background:#0B1220}
.logo-tile img{max-width:100%;max-height:80px}
figure{margin:0}figcaption{font-size:12px;color:var(--wa-text-muted);margin-top:6px}
.clear{position:relative;display:inline-block;padding:32px;background:#0B1220;border-radius:10px}.clear::after{content:"";position:absolute;inset:32px;outline:1px dashed #5CE0BE88}.clear img{height:56px;display:block}
.donts{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.dont{background:#fff;border-radius:10px;padding:20px;display:grid;place-items:center;height:120px;position:relative;overflow:hidden}
.dont::before{content:"✕";position:absolute;top:6px;right:10px;color:#B91C1C;font-weight:700}.dont img{height:36px}
.swatch{background:var(--wa-surface);border:1px solid var(--wa-border);border-radius:10px;padding:12px;font-size:12px}.swatch span{display:block;height:56px;border-radius:6px;margin-bottom:10px;border:1px solid var(--wa-border)}.swatch b{display:block;font-size:13px}.swatch small{display:block;color:var(--wa-text-muted)}
.sev{display:inline-flex;align-items:center;gap:6px;font-weight:500;font-size:13px}.sev-ic{display:inline-flex}
.scale{display:flex;flex-wrap:wrap;gap:18px}
.chart{display:flex;gap:4px}.chart span{width:48px;height:36px;border-radius:4px}
.spec{display:grid;grid-template-columns:150px 1fr;gap:6px 18px;align-items:baseline}.spec dt{color:var(--wa-text-muted);font-size:12px}.spec dd{margin:0}
.icons{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.icons div{display:flex;align-items:center;gap:10px;background:var(--wa-surface);border:1px solid var(--wa-border);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--wa-text-secondary)}.icons svg{color:var(--wa-accent)}
.illus{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.illus figure{background:var(--wa-surface);border:1px solid var(--wa-border);border-radius:10px;padding:16px;text-align:center}
.btn{display:inline-flex;align-items:center;gap:8px;border-radius:6px;padding:8px 14px;font:500 13px var(--wa-font-sans);border:1px solid transparent;cursor:pointer}
.btn.primary{background:var(--wa-accent);color:var(--wa-on-accent)}.btn.primary:hover{background:var(--wa-accent-hover)}.btn.secondary{background:var(--wa-surface);color:var(--wa-text);border-color:var(--wa-border-strong)}.btn.ghost{background:transparent;color:var(--wa-text-secondary)}.btn.danger{background:var(--wa-danger-subtle);color:var(--wa-danger);border-color:var(--wa-danger)}
.btn:focus-visible,.input:focus-visible{outline:2px solid var(--wa-focus-ring);outline-offset:2px}.btn[disabled]{opacity:.5;cursor:not-allowed}
.input{background:var(--wa-surface);border:1px solid var(--wa-border-input);border-radius:6px;padding:9px 12px;color:var(--wa-text);font:14px var(--wa-font-sans);width:100%}
.url{display:flex;gap:8px}.url .input{height:46px;font-size:15px}
table.dt{width:100%;border-collapse:collapse;font-size:13px}.dt th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--wa-text-muted);font-weight:500;border-bottom:1px solid var(--wa-border);padding:8px 12px}.dt td{border-bottom:1px solid var(--wa-border);padding:9px 12px}.dt tr:hover td{background:var(--wa-surface-raised)}.n{text-align:right;font-variant-numeric:tabular-nums}
.conf{border:1px solid var(--wa-border-strong);border-radius:4px;padding:1px 6px;font-size:11px;color:var(--wa-text-secondary)}
.prog{height:6px;background:var(--wa-surface-overlay);border-radius:99px;overflow:hidden}.prog i{display:block;height:100%;width:62%;background:var(--wa-accent);border-radius:99px}
.toast{display:flex;gap:10px;align-items:flex-start;background:var(--wa-surface-overlay);border:1px solid var(--wa-border-strong);border-radius:10px;padding:12px 14px;box-shadow:var(--wa-shadow-overlay);font-size:13px;max-width:420px}
.callout{border:1px solid var(--wa-border);border-left:3px solid var(--wa-warning);background:var(--wa-warning-subtle);padding:12px 14px;border-radius:8px;font-size:13px}
.voice td{vertical-align:top;font-size:13px}.voice td:first-child{color:var(--wa-danger)}.voice td:last-child{color:var(--wa-success)}
.assets{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}.assets img{width:100%;border-radius:8px;border:1px solid var(--wa-border);display:block}
@media print{nav.toc{display:none}body{background:#fff}h2{break-before:page}.wrap{padding:0 12mm}}
</style></head><body>
<nav class="toc" aria-label="Contents"><a href="#overview">Overview</a><a href="#logo">Logo</a><a href="#colour">Colour</a><a href="#type">Typography</a><a href="#icons">Iconography</a><a href="#illustrations">Illustrations</a><a href="#data">Data viz</a><a href="#ui">UI</a><a href="#voice">Voice</a><a href="#assets">Assets</a>
<button type="button" onclick="var h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark'">Toggle theme</button></nav>
<main class="wrap">
<section id="overview"><span class="prov">Version 1.0 · approved 16 October 2026</span>
<h1>WebAudit AI brand book</h1>
<p class="lead">Open-source website intelligence for marketers and developers. The identity is built to be read under pressure: calm surfaces, one signal colour, and evidence in every frame.</p>
<div class="grid g3" style="margin-top:24px">
<div class="card"><b>Positioning</b><p class="muted">An open-source, locally hosted platform that finds, explains and prioritises website quality issues — with evidence.</p></div>
<div class="card"><b>Personality</b><p class="muted">Precise · evidence-led · calm · technical but approachable · honest about uncertainty.</p></div>
<div class="card"><b>Tagline</b><p class="muted">“Evidence for every fix.” — brand promise: “Turn website complexity into actionable clarity.”</p></div></div></section>

<section id="logo"><h2>Logo</h2><p class="muted">Concept: <b>${esc(CONCEPTS.find((c) => c.id === MASTER).name)}</b>. ${esc(CONCEPTS.find((c) => c.id === MASTER).idea)}</p>
<div class="grid g2" style="margin-top:16px">${logos.map(([f, l, bg]) => `<figure><div class="logo-tile ${bg}"><img src="../assets/logos/${f}" alt="${esc(l)}"></div><figcaption>${esc(l)} · <code>${f}</code></figcaption></figure>`).join("")}</div>
<h3>Clear space & minimum size</h3><div style="display:flex;gap:28px;flex-wrap:wrap;align-items:center"><div class="clear"><img src="../assets/logos/primary-horizontal-reverse.svg" alt="Logo with clear-space guide"></div>
<dl class="spec"><dt>Clear space</dt><dd>Half the symbol height on every side.</dd><dt>Minimum size</dt><dd>Horizontal lockup 24 px tall (screen) / 8 mm (print). Symbol 16 px — use the small-size master at ≤ 32 px.</dd><dt>Colour</dt><dd>Two-tone on navy or white; single-colour when printing one ink.</dd></dl></div>
<h3>Don’t</h3><div class="donts">
<div class="dont"><img src="../assets/logos/primary-horizontal.svg" style="transform:scaleX(1.5)" alt=""><figcaption style="position:absolute;bottom:6px;color:#566275">Stretch or distort</figcaption></div>
<div class="dont"><img src="../assets/logos/primary-horizontal.svg" style="filter:hue-rotate(160deg)" alt=""><figcaption style="position:absolute;bottom:6px;color:#566275">Recolour the signal</figcaption></div>
<div class="dont"><img src="../assets/logos/primary-horizontal.svg" style="transform:rotate(-10deg)" alt=""><figcaption style="position:absolute;bottom:6px;color:#566275">Rotate</figcaption></div>
<div class="dont"><img src="../assets/logos/primary-horizontal.svg" style="filter:drop-shadow(0 4px 6px #0008)" alt=""><figcaption style="position:absolute;bottom:6px;color:#566275">Add effects or shadows</figcaption></div>
<div class="dont" style="background:#FAB219"><img src="../assets/logos/primary-horizontal.svg" alt=""><figcaption style="position:absolute;bottom:6px;color:#3b2a00">Place on busy or low-contrast colour</figcaption></div>
</div></section>

<section id="colour"><h2>Colour</h2><p class="muted">Semantic tokens from <code>tokens/colors.json</code>; ratios computed live against <code>surface</code>. Toggle the theme to see light values. All 60 required WCAG 2.2 AA pairs pass (<code>qa/contrast-report.md</code>).</p>
<div class="grid g4" style="margin-top:16px" data-theme="dark">${names.map((n) => swatch(n, "dark")).join("")}</div>
<h3>Light theme</h3><div class="grid g4">${names.map((n) => swatch(n, "light")).join("")}</div>
<h3>Severity & status — never colour alone</h3><div class="scale">${Object.keys(SEV)
    .map((k) => sevBadge(k, 16))
    .join("")}</div>
<p class="muted" style="font-size:13px;margin-top:8px">Fixed scale in both themes. Every use pairs a distinct icon with its label; "Not tested" additionally uses a dashed outline / 45° hatch in charts.</p></section>

<section id="type"><h2>Typography</h2><p class="muted">Inter for interface and reports; JetBrains Mono for URLs, rule ids, selectors and logs. Both SIL OFL 1.1 — bundled in <code>assets/fonts</code> with licences.</p>
<div class="card" style="margin-top:16px">
<div style="font-size:44px;font-weight:600;letter-spacing:-.03em;line-height:1.1">Display 44 · Actionable clarity</div>
<div style="font-size:28px;font-weight:600;letter-spacing:-.02em;margin-top:14px">H1 28 · Audit overview</div>
<div style="font-size:20px;font-weight:600;letter-spacing:-.01em;margin-top:10px">H2 20 · Issues in this category</div>
<div style="font-size:16px;font-weight:600;margin-top:10px">H3 16 · Evidence</div>
<p style="font-size:14px;color:var(--wa-text-secondary);max-width:680px">Body 14/21 — Findings are grouped by rule and inferred template, ranked by severity, reach and confidence, and always show the pages they were tested on.</p>
<p style="font-size:12px;color:var(--wa-text-muted)">Caption 12 — Lighthouse lab data with simulated throttling.</p>
<p class="mono" style="color:var(--wa-text-secondary)">Mono 13 — M08-TRACKING-BEFORE-CONSENT · https://example.com/pricing?utm=REDACTED</p>
<p style="font-variant-numeric:tabular-nums;font-size:20px;font-weight:600">1,491 / 2,016 · 74%</p></div></section>

<section id="icons"><h2>Iconography</h2><p class="muted">Lucide (ISC licence), 1.5–2 px stroke, 16/20/24 px. Category icons below; AI uses one restrained mark and only on AI-generated content.</p>
<div class="icons" style="margin-top:16px">${cats.map(([i, l]) => `<div>${lucide(i, 20)}${l}</div>`).join("")}</div></section>

<section id="illustrations"><h2>Illustrations</h2><p class="muted">Built from the logo’s primitives — window bar, inspection brackets, signal diamond. One accent element per illustration.</p>
<div class="illus" style="margin-top:16px">${Object.entries(ILLUSTRATIONS)
    .map(
      ([id, il]) =>
        `<figure>${illustrationSvg(id)}<figcaption>${esc(il.title)} · <code>${id}.svg</code></figcaption></figure>`,
    )
    .join("")}</div></section>

<section id="data"><h2>Data visualisation</h2><p class="muted">Categorical order is fixed and validated (adjacent CVD ΔE ≥ 8, normal-vision ΔE ≥ 15) in both modes. Light slots 1, 5 and 6 are under 3:1 on white — charts always carry visible labels or a table view.</p>
<h3>Categorical — dark</h3><div class="chart">${tokens.chart.dark.map((c) => `<span style="background:${c}" title="${c}"></span>`).join("")}</div>
<h3>Categorical — light</h3><div class="chart">${tokens.chart.light.map((c) => `<span style="background:${c}" title="${c}"></span>`).join("")}</div>
<h3>Sequential (magnitude)</h3><div class="chart">${tokens.chart.sequential.map((c) => `<span style="background:${c}" title="${c}"></span>`).join("")}</div></section>

<section id="ui"><h2>Application UI</h2><p class="muted">Live components styled only with semantic tokens. The production app implements these in <code>apps/web/src/components</code>.</p>
<div class="grid g2" style="margin-top:16px">
<div class="card"><h3 style="margin-top:0">Buttons</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary">Start audit</button><button class="btn secondary">Export</button><button class="btn ghost">Cancel</button><button class="btn danger">Delete audit</button><button class="btn primary" disabled>Disabled</button></div></div>
<div class="card"><h3 style="margin-top:0">URL input</h3><label for="bb-url" style="font-size:12px;color:var(--wa-text-secondary)">Website URL</label><div class="url" style="margin-top:6px"><input id="bb-url" class="input" placeholder="https://www.example.com"><button class="btn primary">Start</button></div></div>
<div class="card"><h3 style="margin-top:0">Scan progress</h3><div style="display:flex;justify-content:space-between;font-size:13px"><span>Discovery · 87 of 140 URLs</span><span class="muted mono">01:42</span></div><div class="prog" style="margin-top:8px" role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100" aria-label="Audit progress"><i></i></div></div>
<div class="card"><h3 style="margin-top:0">Notification</h3><div class="toast">${lucide("circle-check", 18).replace("<svg", '<svg style="color:var(--wa-success)"')}<div><b>Audit complete</b><div class="muted">47 issue types across 138 pages. Review the top priorities first.</div></div></div></div>
<div class="card" style="grid-column:1/-1"><h3 style="margin-top:0">Data table</h3><table class="dt"><thead><tr><th>Issue</th><th>Severity</th><th>Confidence</th><th class="n">Affected / tested</th></tr></thead><tbody>
<tr><td>Marketing/analytics requests fire before consent<div class="muted mono" style="font-size:11px">M08-TRACKING-BEFORE-CONSENT</div></td><td>${sevBadge("high")}</td><td><span class="conf">Potential</span></td><td class="n">9 / 9</td></tr>
<tr><td>Missing meta description<div class="muted mono" style="font-size:11px">M01-META-DESC-MISSING</div></td><td>${sevBadge("medium")}</td><td><span class="conf">Confirmed</span></td><td class="n">12 / 122</td></tr>
<tr><td>Main landmark missing<div class="muted mono" style="font-size:11px">M03-AXE-LANDMARK-ONE-MAIN</div></td><td>${sevBadge("low")}</td><td><span class="conf">Confirmed</span></td><td class="n">5 / 25</td></tr>
<tr><td>Lighthouse lab performance score<div class="muted mono" style="font-size:11px">M02-LH-PERFORMANCE</div></td><td>${sevBadge("notTested")}</td><td><span class="conf">—</span></td><td class="n">0 / 1</td></tr>
</tbody></table><p class="muted" style="font-size:12px">Component demo: rule names are real engine rules; counts are illustrative, not scan results.</p></div>
<div class="card"><h3 style="margin-top:0">Partial result</h3><div class="callout"><b>Partial results.</b> The audit was cancelled after 87 URLs; findings cover only the pages checked before it stopped.</div></div>
<div class="card"><h3 style="margin-top:0">Empty state</h3><div style="text-align:center">${illustrationSvg("no-results")}<p style="margin:6px 0 0;font-weight:500">No issues match these filters</p><p class="muted" style="font-size:13px;margin:2px 0 0">Remove a filter or search for a rule id.</p></div></div>
</div></section>

<section id="voice"><h2>Voice & messaging</h2><p class="muted">Intelligent but understandable. Evidence-led. Honest about uncertainty. Helpful, never judgmental.</p>
<table class="dt voice" style="margin-top:12px"><thead><tr><th>Avoid</th><th>Prefer</th></tr></thead><tbody>
<tr><td>“Your site scores 62/100.”</td><td>“47 issue types across 138 tested pages; 16 rated high.”</td></tr>
<tr><td>“GA4 is missing.”</td><td>“GA4 was not observed on 16 tested pages.”</td></tr>
<tr><td>“You are not GDPR compliant.”</td><td>“Trackers fired before any consent choice on 9 pages — an indicator worth reviewing.”</td></tr>
<tr><td>“AI found every problem.”</td><td>“AI suggestions — hypotheses grounded in the findings above.”</td></tr>
<tr><td>“Scan failed.”</td><td>“We couldn’t reach that address. Check the URL is public and try again.”</td></tr>
</tbody></table></section>

<section id="assets"><h2>Digital assets</h2><p class="muted">Rendered by Chromium from HTML sources in <code>assets/*/src</code>. Regenerate with <code>pnpm --filter @webaudit/branding build</code>.</p>
<div class="assets" style="margin-top:16px">${assets}</div></section>
</main></body></html>`;
}

// ------------------------------------------------------------------ build
export async function buildPages({ write, out, MASTER }) {
  const report = JSON.parse(readFileSync(join(root, "../examples/fernhill/report.json"), "utf8"));
  write("assets/reports/report-template.html", reportHtml(report));
  write("previews/directions.html", directionsHtml());
  write("previews/brand-book.html", brandBookHtml(MASTER));
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pg.goto("file://" + out("assets/reports/report-template.html"), { waitUntil: "networkidle" });
  await pg.evaluate(() => document.fonts.ready);
  await pg.pdf({
    path: out("assets/reports/report-template.pdf"),
    format: "A4",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await pg.setViewportSize({ width: 794, height: 1123 });
  await pg.screenshot({
    path: out("assets/reports/report-cover.png"),
    clip: { x: (794 - 794) / 2, y: 0, width: 794, height: 1123 },
  });
  await pg.goto("file://" + out("previews/directions.html"), { waitUntil: "networkidle" });
  await pg.setViewportSize({ width: 1440, height: 800 });
  await pg.screenshot({ path: out("previews/directions.png"), fullPage: true });
  await pg.goto("file://" + out("previews/brand-book.html"), { waitUntil: "networkidle" });
  await pg.evaluate(() => document.fonts.ready);
  await pg.pdf({
    path: out("previews/brand-book.pdf"),
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", bottom: "12mm", left: "0", right: "0" },
  });
  await browser.close();
}
