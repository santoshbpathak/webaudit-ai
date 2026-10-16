// Audit workflow illustration for the README and docs (light + dark variants, brand tokens).
//   node branding/scripts/workflow.mjs → docs/images/workflow-{light,dark}.svg
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const THEMES = {
  light: {
    bg: "#F6F8FB",
    card: "#FFFFFF",
    line: "#C3CEDD",
    ink: "#0B1220",
    muted: "#566275",
    accent: "#0B7A66",
  },
  dark: {
    bg: "#0B1220",
    card: "#111A29",
    line: "#344660",
    ink: "#F2F6FD",
    muted: "#9AABC2",
    accent: "#5CE0BE",
  },
};

const STEPS = [
  { n: "1", title: "Discover", lines: ["robots.txt · sitemaps · links", "every URL gets a recorded state"] },
  { n: "2", title: "Inspect", lines: ["HTTP checks on every page", "real browser on sampled templates"] },
  { n: "3", title: "Prioritise", lines: ["group by template", "rank with a transparent index"] },
  { n: "4", title: "Report", lines: ["evidence for every finding", "HTML · CSV · JSON · Markdown"] },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function svg(t) {
  const W = 1200;
  const H = 300;
  const cw = 252;
  const gap = (W - 64 - cw * 4) / 3;
  const font = `font-family="Inter, -apple-system, 'Segoe UI', Roboto, sans-serif"`;
  const cards = STEPS.map((s, i) => {
    const x = 32 + i * (cw + gap);
    const arrow =
      i < STEPS.length - 1
        ? `<path d="M${x + cw + 8} 128 h${gap - 22}" stroke="${t.line}" stroke-width="2"/><path d="M${x + cw + gap - 14} 122 l8 6 -8 6" fill="none" stroke="${t.line}" stroke-width="2"/>`
        : "";
    return `<g>
  <rect x="${x}" y="56" width="${cw}" height="144" rx="12" fill="${t.card}" stroke="${t.line}"/>
  <circle cx="${x + 32}" cy="90" r="14" fill="none" stroke="${t.accent}" stroke-width="2"/>
  <text x="${x + 32}" y="95" text-anchor="middle" ${font} font-size="14" font-weight="600" fill="${t.accent}">${s.n}</text>
  <text x="${x + 56}" y="96" ${font} font-size="20" font-weight="600" fill="${t.ink}">${esc(s.title)}</text>
  <text x="${x + 20}" y="140" ${font} font-size="14" fill="${t.muted}">${esc(s.lines[0])}</text>
  <text x="${x + 20}" y="164" ${font} font-size="14" fill="${t.muted}">${esc(s.lines[1])}</text>
  ${arrow}
</g>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">How a WebAudit AI audit works</title>
<desc id="d">Four steps: Discover pages from robots.txt, sitemaps and links; Inspect with HTTP checks on every page and a real browser on sampled templates; Prioritise by grouping issues by template and ranking them; Report with evidence for every finding. Optional AI can explain results but never changes findings.</desc>
<rect width="${W}" height="${H}" rx="16" fill="${t.bg}"/>
<path d="M32 30 l6 6 -6 6 -6 -6z" fill="${t.accent}"/>
<text x="46" y="41" ${font} font-size="13" font-weight="600" letter-spacing="1.2" fill="${t.accent}">HOW AN AUDIT WORKS</text>
${cards}
<text x="32" y="250" ${font} font-size="14" fill="${t.muted}">Runs on your machine. Deterministic checks — the same audit gives the same findings.</text>
<text x="32" y="274" ${font} font-size="14" fill="${t.muted}">Optional AI can explain the results and draft a roadmap; it never changes a finding.</text>
</svg>
`;
}

for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(join(root, `docs/images/workflow-${name}.svg`), svg(t));
}
console.log("Wrote docs/images/workflow-light.svg and workflow-dark.svg");
