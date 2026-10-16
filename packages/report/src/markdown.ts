import type { ReportData } from "./model";
import { buildBacklog, buildExecutiveSummary } from "./summary";

const SEV_ICON: Record<string, string> = { critical: "🟥", high: "🟧", medium: "🟨", low: "🟦", info: "⬜" };
const md = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Compact Markdown summary — used for GitHub Action job summaries and PR comments. */
export function renderMarkdown(d: ReportData, opts: { maxRows?: number; reportLink?: string } = {}): string {
  const s = buildExecutiveSummary(d);
  const backlog = buildBacklog(d).slice(0, opts.maxRows ?? 15);
  const c = d.coverage;
  const lines = [
    `## WebAudit AI — ${d.audit.host}`,
    "",
    `**${s.headline}**`,
    "",
    `| Discovered | Checked | Browser-sampled | Blocked (robots) | Skipped | Failed |`,
    `|---:|---:|---:|---:|---:|---:|`,
    `| ${c.discovered} | ${c.checked} | ${c.sampled} | ${c.blockedRobots} | ${c.skipped} | ${c.failed} |`,
    "",
  ];
  if (d.lighthouse.medianScore !== null)
    lines.push(
      `Lighthouse lab performance (median of ${d.lighthouse.pages}): **${d.lighthouse.medianScore}**`,
      "",
    );
  if (backlog.length) {
    lines.push(
      "### Top issues",
      "",
      "| # | Issue | Severity | Pages (affected/tested) | Template |",
      "|---:|---|---|---:|---|",
    );
    for (const b of backlog) {
      lines.push(
        `| ${b.rank} | ${md(b.title)} \`${b.ruleId}\` | ${SEV_ICON[b.severity]} ${b.severity} | ${b.affectedPages}/${b.testedPages} | \`${b.templateHint}\` |`,
      );
    }
    lines.push("");
  }
  if (s.martech.length) {
    lines.push("### MarTech signals", "", ...s.martech.map((m) => `- ${md(m.text)}`), "");
  }
  lines.push(
    "<details><summary>Limitations</summary>",
    "",
    ...s.limitations.map((l) => `- ${l}`),
    "",
    "</details>",
  );
  if (opts.reportLink) lines.push("", `[Full report](${opts.reportLink})`);
  return lines.join("\n") + "\n";
}
