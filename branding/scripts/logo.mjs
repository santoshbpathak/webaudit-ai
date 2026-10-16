// Logo geometry for WebAudit AI. All symbols are drawn on a 64×64 grid with a 6-unit
// stroke so they survive 16px rendering (1.5px strokes). Two roles per symbol:
// `ink` (structure) and `signal` (the finding). Monochrome variants pass one colour.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import opentype from "opentype.js";

const require = createRequire(import.meta.url);
const fontFile = (w) => require.resolve(`@fontsource/inter/files/inter-latin-${w}-normal.woff`);
const fonts = {};
function font(weight) {
  if (!fonts[weight]) {
    const buf = readFileSync(fontFile(weight));
    fonts[weight] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return fonts[weight];
}

const S = 6; // stroke unit
const line = (d, color, w = S) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const CONCEPTS = [
  {
    id: "a-inspected-window",
    name: "A · Inspected Window",
    idea: "A browser window whose chrome bar is intact but whose lower corners open into inspection brackets; a single signal diamond sits where the evidence is found.",
    meaning: ["website / browser", "scanning and inspection", "the finding (signal)"],
    draw: ({ ink, signal }) =>
      [
        line("M9 23 V14 a5 5 0 0 1 5 -5 H50 a5 5 0 0 1 5 5 V23", ink),
        line("M9 23 H55", ink),
        line("M9 39 V50 a5 5 0 0 0 5 5 H21", ink),
        line("M55 39 V50 a5 5 0 0 1 -5 5 H43", ink),
        `<path d="M32 30 L40 38 L32 46 L24 38 Z" fill="${signal}"/>`,
      ].join(""),
    // Optical small-size master (≤ 32px): solid chrome bar, heavier brackets, larger signal,
    // so the 16px favicon keeps three readable parts instead of blurring the diamond.
    drawSmall: ({ ink, signal }) =>
      [
        `<rect x="6" y="6" width="52" height="18" rx="6" fill="${ink}"/>`,
        line("M10 36 V50 a4 4 0 0 0 4 4 H22", ink, 8),
        line("M54 36 V50 a4 4 0 0 1 -4 4 H42", ink, 8),
        `<path d="M32 28 L43 39 L32 50 L21 39 Z" fill="${signal}"/>`,
      ].join(""),
  },
  {
    id: "b-coverage-grid",
    name: "B · Coverage Grid",
    idea: "Nine cells represent pages and templates: solid cells were verified, one signal cell is the finding, and an outlined cell stays visibly 'not tested' — honesty about coverage, built into the mark.",
    meaning: ["site structure", "audit coverage", "evidence and uncertainty"],
    caution: "At 16–24 px it resembles the generic 'app launcher' grid icon.",
    draw: ({ ink, signal }) => {
      const c = [8, 26, 44];
      const cells = [];
      for (const [i, y] of c.entries())
        for (const [j, x] of c.entries()) {
          const k = i * 3 + j;
          if (k === 4) cells.push(`<rect x="${x}" y="${y}" width="12" height="12" rx="3" fill="${signal}"/>`);
          else if (k === 8)
            cells.push(
              `<rect x="${x + 1.5}" y="${y + 1.5}" width="9" height="9" rx="2" fill="none" stroke="${ink}" stroke-width="3"/>`,
            );
          else cells.push(`<rect x="${x}" y="${y}" width="12" height="12" rx="3" fill="${ink}"/>`);
        }
      return cells.join("");
    },
  },
  {
    id: "c-ranked-signal",
    name: "C · Ranked Signal",
    idea: "Three bars in descending length are a prioritised backlog; the signal node marks the highest-priority finding.",
    meaning: ["prioritised recommendations", "data intelligence", "actionable clarity"],
    caution: "Highly legible but close to the standard list / align-left glyph.",
    draw: ({ ink, signal }) =>
      [
        `<rect x="8" y="12" width="34" height="10" rx="5" fill="${ink}"/>`,
        `<rect x="8" y="27" width="26" height="10" rx="5" fill="${ink}"/>`,
        `<rect x="8" y="42" width="16" height="10" rx="5" fill="${ink}"/>`,
        `<circle cx="51" cy="17" r="7" fill="${signal}"/>`,
      ].join(""),
  },
  {
    id: "d-w-pulse",
    name: "D · W-Pulse",
    idea: "The W of WebAudit drawn as a diagnostic waveform; the signal node sits on the central peak where the anomaly is detected.",
    meaning: ["brand initial", "diagnostic signals", "monitoring"],
    caution: "Letter-plus-dot monograms are common; ownable only with distinctive proportions.",
    draw: ({ ink, signal }) =>
      [
        line("M8 18 L19.5 46 L32 22 L44.5 46 L56 18", ink, 7),
        `<circle cx="32" cy="22" r="6.5" fill="${signal}"/>`,
      ].join(""),
  },
  {
    id: "e-sweep",
    name: "E · Sweep",
    idea: "A page frame with a quarter-circle scan sweeping from one corner: crawling outwards and discovering the site.",
    meaning: ["crawling and discovery", "structural analysis", "website frame"],
    caution: "Rejected: at small sizes the corner arcs read as the RSS feed icon.",
    draw: ({ ink, signal }) =>
      [
        line("M14 9 H50 a5 5 0 0 1 5 5 V50 a5 5 0 0 1 -5 5 H14 a5 5 0 0 1 -5 -5 V14 a5 5 0 0 1 5 -5 Z", ink),
        line("M18 30 A12 12 0 0 1 30 42", ink, 5),
        line("M18 20 A22 22 0 0 1 40 42", ink, 5),
        `<circle cx="18" cy="42" r="5" fill="${signal}"/>`,
      ].join(""),
  },
];

/** Standalone symbol SVG. */
export function symbolSvg(
  concept,
  colors,
  { size = 64, bg, radius = 0, padding = 0, title = "WebAudit AI", small = false } = {},
) {
  const draw = small && concept.drawSmall ? concept.drawSmall : concept.draw;
  const vb = 64 + padding * 2;
  const bgRect = bg ? `<rect width="${vb}" height="${vb}" rx="${radius}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-padding} ${-padding} ${vb} ${vb}" role="img" aria-label="${title}"><title>${title}</title>${bgRect ? bgRect.replace(`<rect `, `<rect x="${-padding}" y="${-padding}" `) : ""}${draw(colors)}</svg>`;
}

/**
 * Lay out text glyph by glyph (advance + kerning + tracking). Avoids the shaping engine,
 * which in opentype.js 2.0 cannot apply one of Inter's GSUB lookups.
 */
function textPath(f, text, x, size, trackingEm) {
  const scale = size / f.unitsPerEm;
  const path = new opentype.Path();
  let cursor = x;
  let prev = null;
  for (const ch of text) {
    const g = f.charToGlyph(ch);
    if (prev) cursor += f.getKerningValue(prev, g) * scale;
    path.extend(g.getPath(cursor, 0, size));
    cursor += g.advanceWidth * scale + trackingEm * size;
    prev = g;
  }
  return path;
}

/** "WebAudit" + " AI" as outlined paths (Inter 600 / 500). AI is set lighter: it is optional. */
export function wordmark({ ink, muted, size = 36 }) {
  const a = textPath(font(600), "WebAudit", 0, size, -0.02);
  const aBox = a.getBoundingBox();
  const gap = size * 0.24;
  const b = textPath(font(500), "AI", aBox.x2 + gap, size, 0.01);
  const bBox = b.getBoundingBox();
  const capH = (font(600).tables.os2.sCapHeight / font(600).unitsPerEm) * size;
  return {
    width: bBox.x2 - Math.min(aBox.x1, 0),
    capHeight: capH,
    svg: (x, baseline) =>
      `<g transform="translate(${x.toFixed(2)} ${baseline.toFixed(2)})"><path d="${a.toPathData(2)}" fill="${ink}"/><path d="${b.toPathData(2)}" fill="${muted}"/></g>`,
  };
}

/** Horizontal lockup: symbol height = 1.75 × cap height; gap = 0.5 × symbol. */
export function horizontalSvg(concept, colors, { height = 64, title = "WebAudit AI" } = {}) {
  const wm = wordmark({ ink: colors.text, muted: colors.muted, size: 36 });
  const sym = 64;
  const gap = 18;
  const w = sym + gap + wm.width;
  const baseline = sym / 2 + wm.capHeight / 2;
  const scale = height / sym;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(w * scale).toFixed(0)}" height="${height}" viewBox="0 0 ${w.toFixed(2)} ${sym}" role="img" aria-label="${title}"><title>${title}</title>${concept.draw(colors)}${wm.svg(sym + gap, baseline)}</svg>`;
}

/** Stacked lockup: symbol centred above the wordmark. */
export function stackedSvg(concept, colors, { width = 220, title = "WebAudit AI" } = {}) {
  const wm = wordmark({ ink: colors.text, muted: colors.muted, size: 30 });
  const w = Math.max(wm.width, 64) + 8;
  const h = 64 + 18 + wm.capHeight + 4;
  const scale = width / w;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${(h * scale).toFixed(0)}" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}" role="img" aria-label="${title}"><title>${title}</title><g transform="translate(${((w - 64) / 2).toFixed(2)} 0)">${concept.draw(colors)}</g>${wm.svg((w - wm.width) / 2, 64 + 18 + wm.capHeight)}</svg>`;
}
