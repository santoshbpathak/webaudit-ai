// Empty-state and status illustrations. Built from the logo's primitives (window chrome bar,
// inspection brackets, signal diamond) so they read as one family. 160×120 viewBox, 3-unit
// strokes. Colours are CSS variables with mid-tone fallbacks that work on light and dark.
const LINE = "var(--wa-illus-line, #7F8FA6)";
const FAINT = "var(--wa-illus-faint, #7F8FA6)";
const SIGNAL = "var(--wa-illus-signal, #2EC9A3)";
const DANGER = "var(--wa-illus-danger, #E5484D)";
const OK = "var(--wa-illus-ok, #16A06B)";

const p = (d, stroke = LINE, w = 3, extra = "") =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const dashed = ' stroke-dasharray="6 7"';
const windowFrame = (x = 30, y = 18, w = 100, h = 78, stroke = LINE, extra = "") =>
  [
    p(
      `M${x + 8} ${y} H${x + w - 8} a8 8 0 0 1 8 8 V${y + h - 8} a8 8 0 0 1 -8 8 H${x + 8} a8 8 0 0 1 -8 -8 V${y + 8} a8 8 0 0 1 8 -8 Z`,
      stroke,
      3,
      extra,
    ),
    p(`M${x} ${y + 18} H${x + w}`, stroke, 3, extra),
  ].join("");
const diamond = (cx, cy, r, fill = SIGNAL) =>
  `<path d="M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z" fill="${fill}"/>`;
const dots = (x, y) =>
  [0, 1, 2].map((i) => `<circle cx="${x + i * 8}" cy="${y}" r="2" fill="${FAINT}"/>`).join("");

export const ILLUSTRATIONS = {
  "no-audit": {
    title: "No audit created",
    alt: "An empty browser window outline with an outlined signal diamond.",
    body: () =>
      [
        windowFrame(30, 18, 100, 78, LINE, dashed),
        dots(40, 27),
        p("M80 48 L92 60 L80 72 L68 60 Z", SIGNAL, 3),
      ].join(""),
  },
  scanning: {
    title: "Website scan in progress",
    alt: "A browser window with a horizontal scan line moving down its content.",
    body: () =>
      [
        windowFrame(),
        dots(40, 27),
        p("M42 50 H96", FAINT, 3),
        p("M42 62 H84", FAINT, 3),
        p("M42 74 H72", FAINT, 3),
        p("M36 68 H124", SIGNAL, 3),
        diamond(124, 68, 6),
      ].join(""),
  },
  "audit-complete": {
    title: "Audit complete",
    alt: "A browser window framed by inspection brackets with a signal diamond at its centre.",
    body: () =>
      [
        p("M38 18 H122 a8 8 0 0 1 8 8 V36 H30 V26 a8 8 0 0 1 8 -8 Z", LINE),
        p("M30 70 V88 a8 8 0 0 0 8 8 H54", LINE),
        p("M130 70 V88 a8 8 0 0 1 -8 8 H106", LINE),
        diamond(80, 66, 14),
      ].join(""),
  },
  "no-issues": {
    title: "No issues found",
    alt: "A browser window with a check mark, indicating no failing checks in the tested scope.",
    body: () =>
      [
        windowFrame(),
        dots(40, 27),
        `<circle cx="80" cy="66" r="16" fill="none" stroke="${OK}" stroke-width="3"/>`,
        p("M72 66 L78 72 L89 60", OK, 3),
      ].join(""),
  },
  "audit-failed": {
    title: "Audit failed",
    alt: "A browser window with a broken frame edge and a warning symbol.",
    body: () =>
      [
        p("M38 18 H122 a8 8 0 0 1 8 8 V54", LINE),
        p("M130 70 V88 a8 8 0 0 1 -8 8 H38 a8 8 0 0 1 -8 -8 V26 a8 8 0 0 1 8 -8", LINE),
        p("M30 36 H130", LINE),
        p("M80 52 L96 80 H64 Z", DANGER, 3),
        p("M80 61 V69", DANGER, 3),
        `<circle cx="80" cy="74.5" r="1.8" fill="${DANGER}"/>`,
      ].join(""),
  },
  "ai-disabled": {
    title: "AI disabled",
    alt: "An outlined signal diamond with a diagonal line, indicating optional AI is turned off.",
    body: () =>
      [
        p("M80 28 L112 60 L80 92 L48 60 Z", FAINT, 3, dashed),
        p("M60 40 L100 80", LINE, 3),
        diamond(80, 60, 6, LINE),
      ].join(""),
  },
  "network-error": {
    title: "Network error",
    alt: "Two browser windows with a broken connection between them.",
    body: () =>
      [
        windowFrame(14, 34, 52, 44),
        windowFrame(94, 34, 52, 44),
        p("M68 56 H74", LINE),
        p("M86 56 H92", LINE),
        p("M76 50 L84 62", DANGER, 3),
      ].join(""),
  },
  "no-results": {
    title: "No search results",
    alt: "Inspection brackets framing an empty dashed area.",
    body: () =>
      [
        p("M36 34 V26 a8 8 0 0 1 8 -8 H54", LINE),
        p("M124 34 V26 a8 8 0 0 0 -8 -8 H106", LINE),
        p("M36 84 V92 a8 8 0 0 0 8 8 H54", LINE),
        p("M124 84 V92 a8 8 0 0 1 -8 8 H106", LINE),
        `<rect x="56" y="44" width="48" height="32" rx="6" fill="none" stroke="${FAINT}" stroke-width="3" stroke-dasharray="6 7"/>`,
      ].join(""),
  },
  "empty-history": {
    title: "Empty history",
    alt: "Three stacked browser window outlines, the front one dashed and empty.",
    // Back layers are drawn as offset top/right edges only, so nothing shows through the front window.
    body: () =>
      [
        p("M54 16 H122 a8 8 0 0 1 8 8 V68", FAINT),
        p("M46 26 H114 a8 8 0 0 1 8 8 V80", LINE),
        windowFrame(30, 36, 84, 60, LINE, dashed),
        dots(40, 45),
      ].join(""),
  },
};

export function illustrationSvg(id) {
  const il = ILLUSTRATIONS[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120" role="img" aria-labelledby="t-${id} d-${id}"><title id="t-${id}">${il.title}</title><desc id="d-${id}">${il.alt}</desc>${il.body()}</svg>`;
}
