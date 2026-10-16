// Generates docs/rules.md from rule metadata (single source of truth). Run: pnpm docs:rules
import { writeFileSync } from "node:fs";
import { ALL_MODULES, TRACKERS } from "../src/index";

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const lines = [
  "# Rule reference",
  "",
  "_Generated from rule metadata by `pnpm docs:rules` — do not edit by hand._",
  "",
  "Confidence: **verified** = directly observed · **heuristic** = likely issue inferred from signals · **manual review** = needs human judgement.",
  "Layer: **http** = every checked page · **browser** = pages in the browser sample · **site** = cross-page analysis.",
  "",
];
for (const m of ALL_MODULES) {
  lines.push(
    `## ${m.id} — ${m.name}`,
    "",
    "| Rule | Severity | Confidence | Layer | Why it matters | Caveat |",
    "|---|---|---|---|---|---|",
  );
  for (const r of m.rules) {
    lines.push(
      `| \`${r.id}\`<br>${esc(r.title)} | ${r.severity} | ${r.confidence.replace("_", " ")} | ${r.layer} | ${esc(r.rationale)} | ${esc(r.caveat ?? "")} |`,
    );
  }
  if (m.id === "M03")
    lines.push(
      "",
      "Every other axe-core rule is reported dynamically as `M03-AXE-<RULE-ID>` with severity mapped from axe impact (critical/serious → high, moderate → medium, minor → low).",
    );
  lines.push("");
}
lines.push(
  "## Tag signatures (M04/M05/M08)",
  "",
  "| Vendor | Category | Library pattern | Hit pattern |",
  "|---|---|---|---|",
);
for (const t of TRACKERS)
  lines.push(
    `| ${t.vendor} | ${t.category.replace("_", " ")} | ${t.library.map((r) => `\`${r.source}\``).join("<br>") || "—"} | ${t.hit.map((r) => `\`${r.source}\``).join("<br>") || "—"} |`,
  );
writeFileSync(new URL("../../../docs/rules.md", import.meta.url), lines.join("\n") + "\n");
console.log("docs/rules.md written");
