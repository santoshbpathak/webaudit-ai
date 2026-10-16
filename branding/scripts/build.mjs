// Builds the WebAudit AI brand asset library from source definitions.
//   pnpm --filter @webaudit/branding build            # everything
//   BRAND_LOGO=b-coverage-grid pnpm ... build          # build with a different master concept
// Every PNG is rendered from SVG/HTML by Chromium (Playwright) — no placeholder rasters.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CONCEPTS, horizontalSvg, stackedSvg, symbolSvg } from "./logo.mjs";
import { ILLUSTRATIONS, illustrationSvg } from "./illustrations.mjs";
import { TEMPLATES, page } from "./templates.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (...p) => {
  const f = join(root, ...p);
  mkdirSync(dirname(f), { recursive: true });
  return f;
};
const write = (rel, content) => writeFileSync(out(rel), content);
const tokens = JSON.parse(readFileSync(join(root, "tokens/colors.json"), "utf8"));
const T = (theme, k) => tokens.theme[theme][k].$value;

export const MASTER = process.env.BRAND_LOGO ?? "a-inspected-window";
export const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

export const PALETTE = {
  dark: {
    ink: T("dark", "text"),
    signal: T("dark", "accent"),
    text: T("dark", "text"),
    muted: T("dark", "text-muted"),
    bg: T("dark", "canvas"),
  },
  light: {
    ink: T("light", "text"),
    signal: "#0E9478",
    text: T("light", "text"),
    muted: T("light", "text-muted"),
    bg: T("light", "surface"),
  },
  monoDark: { ink: "#0B1220", signal: "#0B1220", text: "#0B1220", muted: "#0B1220" },
  monoLight: { ink: "#FFFFFF", signal: "#FFFFFF", text: "#FFFFFF", muted: "#FFFFFF" },
};

let browser;
async function render(html, file, width, height, { transparent = false } = {}) {
  browser ??= await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({
    path: out(file),
    omitBackground: transparent,
    clip: { x: 0, y: 0, width, height },
  });
  await page.close();
}
const svgPage = (svg, bg = "transparent") =>
  `<!doctype html><html><head><style>html,body{margin:0;background:${bg}}svg{display:block;width:100vw;height:100vh}</style></head><body>${svg}</body></html>`;

// ---------------------------------------------------------------- 1. logo concepts
async function buildConcepts() {
  for (const c of CONCEPTS) {
    const dir = `assets/logos/concepts/${c.id}`;
    write(`${dir}/symbol-dark-bg.svg`, symbolSvg(c, PALETTE.dark));
    write(`${dir}/symbol-light-bg.svg`, symbolSvg(c, PALETTE.light));
    write(`${dir}/horizontal-dark-bg.svg`, horizontalSvg(c, PALETTE.dark));
    write(`${dir}/horizontal-light-bg.svg`, horizontalSvg(c, PALETTE.light));
    for (const s of SIZES) {
      const small = s <= 32;
      await render(
        svgPage(symbolSvg(c, PALETTE.dark, { size: s, small }), PALETTE.dark.bg),
        `${dir}/test/dark-${s}.png`,
        s,
        s,
      );
      await render(
        svgPage(symbolSvg(c, PALETTE.light, { size: s, small }), "#ffffff"),
        `${dir}/test/light-${s}.png`,
        s,
        s,
      );
    }
  }
}

const SCORES = {
  // 1–5 per criterion, weights below. Scored by eye on the rendered test sheet.
  "a-inspected-window": { distinct: 4, small: 4, meaning: 5, versatile: 5, timeless: 4 },
  "b-coverage-grid": { distinct: 3, small: 4, meaning: 4, versatile: 4, timeless: 4 },
  "c-ranked-signal": { distinct: 2, small: 5, meaning: 3, versatile: 4, timeless: 4 },
  "d-w-pulse": { distinct: 3, small: 4, meaning: 3, versatile: 4, timeless: 3 },
  "e-sweep": { distinct: 1, small: 3, meaning: 3, versatile: 3, timeless: 3 },
};
export const WEIGHTS = { distinct: 0.3, small: 0.25, meaning: 0.2, versatile: 0.15, timeless: 0.1 };
export const scoreOf = (id) => Object.entries(WEIGHTS).reduce((a, [k, w]) => a + w * SCORES[id][k], 0);

function comparisonHtml() {
  const rel = (c, f) => `../assets/logos/concepts/${c.id}/${f}`;
  const rows = CONCEPTS.map((c) => {
    const score = scoreOf(c.id).toFixed(2);
    const s = SCORES[c.id];
    const pixel = [16, 24, 32]
      .map(
        (n) =>
          `<figure><img class="px" src="${rel(c, `test/dark-${n}.png`)}" width="${n * 4}" height="${n * 4}" alt="${c.name} at ${n}px, dark, magnified 4×"><figcaption>${n}px ×4</figcaption></figure>`,
      )
      .join("");
    const scale = SIZES.filter((n) => n <= 256)
      .map(
        (n) =>
          `<figure><img src="${rel(c, `test/dark-${n}.png`)}" width="${n}" height="${n}" alt="${c.name} ${n}px"><figcaption>${n}</figcaption></figure>`,
      )
      .join("");
    const scaleLight = SIZES.filter((n) => n <= 128)
      .map(
        (n) =>
          `<figure><img src="${rel(c, `test/light-${n}.png`)}" width="${n}" height="${n}" alt="${c.name} ${n}px light"><figcaption>${n}</figcaption></figure>`,
      )
      .join("");
    return `<section class="concept${c.id === MASTER ? " rec" : ""}">
  <header><h2>${c.name}${c.id === MASTER ? ` <span class="tag">Approved master</span>` : ""}</h2><p>${c.idea}</p>
  ${c.caution ? `<p class="warn">⚠ ${c.caution}</p>` : ""}${c.drawSmall ? `<p class="meta">Includes an optical small-size master used at ≤ 32 px.</p>` : ""}
  <p class="meta">Communicates: ${c.meaning.join(" · ")} — weighted score <b>${score}</b> / 5 (distinctiveness ${s.distinct}, small-size ${s.small}, meaning ${s.meaning}, versatility ${s.versatile}, timelessness ${s.timeless})</p></header>
  <div class="lockups"><div class="dk"><img src="${rel(c, "horizontal-dark-bg.svg")}" height="48" alt="${c.name} horizontal lockup on dark"></div><div class="lt"><img src="${rel(c, "horizontal-light-bg.svg")}" height="48" alt="${c.name} horizontal lockup on light"></div></div>
  <h3>Rendered pixels (dark)</h3><div class="row px-row">${pixel}</div>
  <h3>Scale 16 → 256 (dark)</h3><div class="row dk">${scale}</div>
  <h3>Scale 16 → 128 (light)</h3><div class="row lt">${scaleLight}</div>
  <h3>In context</h3>
  <div class="ctx">
    <div class="tab"><img src="${rel(c, "test/light-16.png")}" width="16" height="16" alt="">WebAudit AI · Overview<span>×</span></div>
    <div class="side"><img src="${rel(c, "test/dark-24.png")}" width="24" height="24" alt=""><b>WebAudit AI</b></div>
    <div class="avatar"><img src="${rel(c, "symbol-dark-bg.svg")}" alt=""></div>
  </div>
</section>`;
  }).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logo comparison · WebAudit AI</title>
<style>
:root{--bg:#0B1220;--s:#111A29;--ink:#F2F6FD;--ink2:#C3CEDD;--mut:#9AABC2;--line:#26344A;--acc:#5CE0BE}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 Inter,system-ui,sans-serif;padding:32px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:0}h3{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin:18px 0 8px;font-weight:600}
.intro{color:var(--ink2);max-width:880px}.concept{background:var(--s);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin:20px 0}
.concept.rec{border-color:var(--acc)}.tag{font-size:11px;background:rgba(92,224,190,.12);color:var(--acc);padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle}
.concept p{color:var(--ink2);margin:6px 0 0;max-width:880px}.meta{font-size:12px;color:var(--mut)!important}.warn{font-size:12px;color:#FBBF24!important}
.row{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;padding:14px;border-radius:8px}.dk{background:#0B1220}.lt{background:#fff;color:#0B1220}
figure{margin:0;text-align:center}figcaption{font-size:10px;color:var(--mut);margin-top:4px}.lt figcaption{color:#566275}
.px{image-rendering:pixelated;border:1px solid var(--line)}.px-row{background:transparent;padding:0}
.lockups{display:flex;gap:12px;margin-top:14px;flex-wrap:wrap}.lockups>div{padding:16px 20px;border-radius:8px}
.ctx{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.tab{display:flex;gap:8px;align-items:center;background:#e9edf3;color:#334155;font-size:12px;padding:6px 12px;border-radius:8px 8px 0 0;width:240px}.tab span{margin-left:auto}
.side{display:flex;gap:8px;align-items:center;background:#111A29;border:1px solid var(--line);padding:10px 14px;border-radius:8px;font-size:13px}
.avatar{width:96px;height:96px;border-radius:50%;overflow:hidden;background:#0B1220;border:1px solid var(--line);display:grid;place-items:center}.avatar img{width:64px;height:64px}
table{border-collapse:collapse;margin-top:8px;font-size:13px}td,th{border-bottom:1px solid var(--line);padding:6px 12px;text-align:left}th{color:var(--mut);font-weight:500}
</style></head><body>
<h1>WebAudit AI — logo exploration</h1>
<p class="intro">Five original concepts, each rasterised by Chromium at 16–512&nbsp;px on light and dark. Approved master (A) highlighted — selected by the owner on 2026-10-16. Scoring weights: distinctiveness 30%, small-size legibility 25%, meaning 20%, versatility 15%, timelessness 10%.</p>
<table><tr><th>Concept</th><th>Score</th></tr>${CONCEPTS.map((c) => `<tr><td>${c.name}</td><td>${scoreOf(c.id).toFixed(2)}</td></tr>`).join("")}</table>
${rows}
</body></html>`;
}

// ---------------------------------------------------------------- 2. tokens → CSS
function buildTokensCss() {
  const vars = (theme) =>
    Object.entries(tokens.theme[theme])
      .map(([k, v]) => `  --wa-${k}: ${v.$value};`)
      .join("\n");
  const status = Object.entries(tokens.status)
    .filter(([k]) => !k.startsWith("$"))
    .map(([k, v]) => `  --wa-severity-${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}: ${v.$value};`)
    .join("\n");
  const chart = (theme) => tokens.chart[theme].map((c, i) => `  --wa-chart-${i + 1}: ${c};`).join("\n");
  const seq = tokens.chart.sequential.map((c, i) => `  --wa-seq-${i + 1}: ${c};`).join("\n");
  write(
    "tokens/semantic-tokens.css",
    `/* WebAudit AI semantic tokens — GENERATED from tokens/colors.json by scripts/build.mjs. Do not edit by hand. */
/* Dark ("Midnight Intelligence") is the default; set data-theme="light" for the light theme. */
:root {
${status}
${seq}
  --wa-radius-sm: 4px;
  --wa-radius-md: 6px;
  --wa-radius-lg: 10px;
  --wa-radius-xl: 14px;
  --wa-font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --wa-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
:root,
[data-theme="dark"] {
${vars("dark")}
${chart("dark")}
  --wa-shadow-overlay: 0 16px 40px rgb(0 0 0 / 0.45);
  color-scheme: dark;
}
[data-theme="light"] {
${vars("light")}
${chart("light")}
  --wa-shadow-overlay: 0 16px 40px rgb(15 23 42 / 0.12);
  color-scheme: light;
}
`,
  );
}

// ---------------------------------------------------------------- 3. master logo variants
export const master = () => CONCEPTS.find((c) => c.id === MASTER);
function logoAssets() {
  const c = master();
  const L = "assets/logos";
  const files = {
    "primary-horizontal.svg": horizontalSvg(c, PALETTE.light),
    "primary-horizontal-reverse.svg": horizontalSvg(c, PALETTE.dark),
    "stacked.svg": stackedSvg(c, PALETTE.light),
    "stacked-reverse.svg": stackedSvg(c, PALETTE.dark),
    "symbol.svg": symbolSvg(c, PALETTE.light),
    "symbol-reverse.svg": symbolSvg(c, PALETTE.dark),
    "symbol-small.svg": symbolSvg(c, PALETTE.light, { small: true }),
    "symbol-small-reverse.svg": symbolSvg(c, PALETTE.dark, { small: true }),
    "mono-dark-horizontal.svg": horizontalSvg(c, PALETTE.monoDark),
    "mono-light-horizontal.svg": horizontalSvg(c, PALETTE.monoLight),
    "mono-dark-symbol.svg": symbolSvg(c, PALETTE.monoDark),
    "mono-light-symbol.svg": symbolSvg(c, PALETTE.monoLight),
  };
  for (const [f, svg] of Object.entries(files)) write(`${L}/${f}`, svg);
  return files;
}

/** App-icon style: symbol on a rounded navy tile. */
const tile = (size, { radius = 0.22, pad = 0.2, small } = {}) => {
  const c = master();
  const p = (64 * pad) / (1 - 2 * pad);
  return symbolSvg(c, PALETTE.dark, {
    size,
    bg: PALETTE.dark.bg,
    radius: (64 + 2 * p) * radius,
    padding: p,
    small: small ?? size <= 32,
  });
};

/** Minimal ICO writer: PNG-compressed entries (supported by all current browsers). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, buf }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

async function iconAssets() {
  const c = master();
  const F = "assets/favicons";
  write(
    `${F}/favicon.svg`,
    symbolSvg(c, PALETTE.dark, { small: true, bg: PALETTE.dark.bg, radius: 14, padding: 4 }),
  );
  for (const s of [16, 32, 48])
    await render(svgPage(tile(s, { radius: 0.18, pad: 0.06 })), `${F}/favicon-${s}.png`, s, s, {
      transparent: true,
    });
  writeFileSync(
    out(`${F}/favicon.ico`),
    ico([16, 32, 48].map((s) => ({ size: s, buf: readFileSync(out(`${F}/favicon-${s}.png`)) }))),
  );
  await render(svgPage(tile(180, { radius: 0, pad: 0.2 })), `${F}/apple-touch-icon.png`, 180, 180);
  for (const s of [192, 512]) {
    await render(svgPage(tile(s, { radius: 0.22, pad: 0.2 })), `${F}/icon-${s}.png`, s, s, {
      transparent: true,
    });
    // Maskable: full-bleed background, symbol inside the 80% safe zone.
    await render(svgPage(tile(s, { radius: 0, pad: 0.28 })), `${F}/icon-maskable-${s}.png`, s, s);
  }
  write(
    `${F}/site.webmanifest`,
    JSON.stringify(
      {
        name: "WebAudit AI",
        short_name: "WebAudit",
        description: "Open-source website intelligence for marketers.",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        theme_color: PALETTE.dark.bg,
        background_color: PALETTE.dark.bg,
        display: "standalone",
      },
      null,
      2,
    ),
  );
  const I = "assets/icons";
  write(`${I}/app-icon.svg`, tile(512));
  await render(svgPage(tile(1024)), `${I}/app-icon-1024.png`, 1024, 1024, { transparent: true });
  // GitHub avatars are cropped to a circle: full-bleed tile, generous padding.
  await render(svgPage(tile(500, { radius: 0, pad: 0.24 })), `assets/github/avatar-500.png`, 500, 500);
  await render(svgPage(tile(400, { radius: 0, pad: 0.24 })), `assets/social/profile-400.png`, 400, 400);
  for (const s of SIZES)
    await render(
      svgPage(symbolSvg(c, PALETTE.dark, { size: s, small: s <= 32 }), PALETTE.dark.bg),
      `assets/logos/test/master-dark-${s}.png`,
      s,
      s,
    );
  for (const s of SIZES)
    await render(
      svgPage(symbolSvg(c, PALETTE.light, { size: s, small: s <= 32 }), "#ffffff"),
      `assets/logos/test/master-light-${s}.png`,
      s,
      s,
    );
}

// ---------------------------------------------------------------- 4. illustrations
function illustrationAssets() {
  for (const id of Object.keys(ILLUSTRATIONS)) write(`assets/illustrations/${id}.svg`, illustrationSvg(id));
}

// ---------------------------------------------------------------- 5. raster templates
async function templateAssets() {
  const changelog = readFileSync(join(root, "../CHANGELOG.md"), "utf8");
  const version = "v" + (changelog.match(/^## (\d+\.\d+\.\d+)/m)?.[1] ?? "0.1.0");
  const highlights = [
    "Ten audit modules: SEO, performance, accessibility, GA4/GTM, pixels, forms, UX, consent, content, architecture",
    "Template-level grouping with a transparent priority index",
    "SSRF-safe crawling with honest coverage accounting",
    "Web UI, CLI, GitHub Action and HTML / JSON / CSV exports",
    "Optional AI (Claude or OpenAI-compatible) with citation checks",
  ];
  const catalogue = [];
  for (const [key, fn] of Object.entries(TEMPLATES)) {
    const [group, name] = key.split("/");
    const srcRel = `assets/${group}/src/${name}.html`;
    const logo = {
      horizontalDark: "../../logos/primary-horizontal-reverse.svg",
      symbolDark: "../../logos/symbol-reverse.svg",
    };
    const t = fn({ logo, version, highlights });
    write(srcRel, page({ ...t, fontsRel: "../../fonts" }));
    browser ??= await chromium.launch();
    const pg = await browser.newPage({ viewport: { width: t.w, height: t.h } });
    await pg.goto("file://" + out(srcRel), { waitUntil: "networkidle" });
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: out(`assets/${group}/${name}.png`) });
    await pg.close();
    catalogue.push({
      file: `assets/${group}/${name}.png`,
      source: srcRel,
      width: t.w,
      height: t.h,
      title: t.title,
    });
  }
  write(
    "assets/catalogue.json",
    JSON.stringify(
      { master: MASTER, version: "1.0", generated: new Date().toISOString(), rasters: catalogue },
      null,
      2,
    ),
  );
}

// ---------------------------------------------------------------- main
const stage = process.argv[2] ?? "all";
if (stage === "concepts" || stage === "all") {
  await buildConcepts();
  write("previews/logo-comparison.html", comparisonHtml());
  console.log(`Concepts built (${CONCEPTS.length}); master = ${MASTER}`);
}
if (stage === "tokens" || stage === "all") {
  buildTokensCss();
  console.log("Tokens CSS generated");
}
if (stage === "assets" || stage === "all") {
  logoAssets();
  await iconAssets();
  illustrationAssets();
  await templateAssets();
  console.log("Logo variants, icons, favicons, illustrations and templates built");
}
if (stage === "pages" || stage === "all") {
  const { buildPages } = await import("./pages.mjs");
  await buildPages({ render, out, write, MASTER });
  console.log("Report template, directions sheet and brand book built");
}
await browser?.close();
