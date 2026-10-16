import type { Finding } from "@webaudit/core";
import { getRule } from "@webaudit/modules";
import { CONFIDENCE_FACTOR, PAGE_FACTOR_CAP, SEVERITY_WEIGHT, groupSignature } from "@webaudit/scoring";
import type { ReportData } from "./model";
import { buildBacklog, buildExecutiveSummary, isPartial } from "./summary";

export const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Brand v1.0 (branding/WEBAUDIT_AI_BRAND_GUIDELINES.md): light for stakeholders, dark when
// the reader prefers it. Fonts are referenced, not embedded, to keep the file small.
const CSS = `
:root{--bg:#f6f8fb;--card:#fff;--raised:#f1f4f9;--ink:#0b1220;--ink2:#334155;--muted:#566275;--line:#dfe5ee;--accent:#0b7a66;--signal:#0e9478;
--crit:#d03b3b;--high:#ec835a;--med:#fab219;--low:#4c8df6;--info:#8a94a6;--ok:#03644a;--warnbg:rgba(202,138,4,.12);--warnline:#e9c46a;--warn:#8a4b06}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#111a29;--raised:#162133;--ink:#f2f6fd;--ink2:#c3cedd;--muted:#9aabc2;--line:#26344a;--accent:#5ce0be;--signal:#5ce0be;
--ok:#4ade9f;--warnbg:rgba(251,191,36,.12);--warnline:#5c4a12;--warn:#fbbf24}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-feature-settings:"cv11","ss01"}
.wrap{max-width:1100px;margin:0 auto;padding:28px 16px 64px}h1{font-size:28px;letter-spacing:-.02em;margin:10px 0 4px}h2{font-size:19px;letter-spacing:-.01em;margin:40px 0 12px}
h3{font-size:16px;margin:0 0 6px}.muted{color:var(--muted)}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:12px 0}
.brand{display:flex;align-items:center;gap:10px;font-size:15px;letter-spacing:-.02em}.brand b{font-weight:600}.brand span{color:var(--muted);font-weight:500}
.kicker{display:inline-flex;align-items:center;gap:8px;margin-top:22px;color:var(--accent);font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.kicker i{width:8px;height:8px;background:var(--signal);transform:rotate(45deg);display:inline-block}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.stat b{display:block;font-size:24px;font-variant-numeric:tabular-nums}.banner{background:var(--warnbg);border:1px solid var(--warnline);border-radius:10px;padding:12px 16px;margin:16px 0}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:500}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.sev{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--ink2);white-space:nowrap}.sev svg{flex:none}
.tag{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:0 6px;font-size:12px;color:var(--muted)}
code,pre{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}pre{white-space:pre-wrap;word-break:break-word;background:var(--raised);border:1px solid var(--line);border-radius:8px;padding:8px;margin:6px 0}
.bar{height:10px;background:var(--line);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent)}
details{margin:8px 0}summary{cursor:pointer;font-weight:600}a{color:var(--accent)}.wf td:first-child{width:180px}
.scroll{overflow-x:auto}ol.refs li{margin:4px 0}footer{margin-top:48px;font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}
@media print{body{background:#fff}.card,.stat{break-inside:avoid}}
`;

/** "Inspected Window" symbol (brand v1.0), inline so the report stays self-contained. */
const LOGO = `<svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><path d="M9 23 V14 a5 5 0 0 1 5 -5 H50 a5 5 0 0 1 5 5 V23 M9 23 H55 M9 39 V50 a5 5 0 0 0 5 5 H21 M55 39 V50 a5 5 0 0 1 -5 5 H43" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 30 L40 38 L32 46 L24 38 Z" fill="var(--signal)"/></svg>`;

/** Severity is never colour alone: a distinct shape per level plus its label. */
const SEV_SHAPE: Record<string, [string, string]> = {
  critical: ["var(--crit)", `<path d="M5 1h6l4 4v6l-4 4H5l-4-4V5z"/>`],
  high: ["var(--high)", `<path d="M8 1.5 15 14H1z"/>`],
  medium: ["var(--med)", `<circle cx="8" cy="8" r="6.5"/>`],
  low: ["var(--low)", `<rect x="2" y="2" width="12" height="12" rx="2"/>`],
  info: ["var(--info)", `<circle cx="8" cy="8" r="3.5"/>`],
};
const SEV_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Informational",
};
const CONF_LABEL: Record<string, string> = {
  verified: "Confirmed",
  heuristic: "Potential",
  manual_review: "Manual review",
};

/** Human-readable UTC timestamp (reports are shared across time zones). */
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—";

function sevBadge(s: string) {
  const [color, shape] = SEV_SHAPE[s] ?? SEV_SHAPE.info!;
  return `<span class="sev"><svg width="12" height="12" viewBox="0 0 16 16" fill="${color}" aria-hidden="true">${shape}</svg>${esc(SEV_LABEL[s] ?? s)}</span>`;
}

function evidenceBlock(f: Finding): string {
  const e = f.evidence;
  const parts: string[] = [
    `<div><a href="${esc(f.url)}" rel="noopener noreferrer">${esc(f.url)}</a> <span class="tag">${esc(f.findingId)}</span></div>`,
  ];
  if (e.selector) parts.push(`<div class="muted">Selector: <code>${esc(e.selector)}</code></div>`);
  if (e.httpStatus) parts.push(`<div class="muted">HTTP ${esc(e.httpStatus)}</div>`);
  if (e.requestUrl) parts.push(`<div class="muted">Request: <code>${esc(e.requestUrl)}</code></div>`);
  if (e.snippet) parts.push(`<pre>${esc(e.snippet)}</pre>`);
  if (e.reproSteps.length)
    parts.push(
      `<div class="muted">Reproduce:</div><ol>${e.reproSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`,
    );
  return `<div class="card">${parts.join("")}</div>`;
}

export interface HtmlOptions {
  /** Optional AI section, rendered separately and labelled as AI suggestion. */
  aiSections?: { title: string; html: string }[];
  /** Resolve artifact refs (screenshots) to URLs; omitted = not linked. */
  artifactUrl?: (ref: string) => string | undefined;
}

/** Self-contained stakeholder report: no external assets, works offline, prints cleanly. */
export function renderHtml(d: ReportData, opts: HtmlOptions = {}): string {
  const s = buildExecutiveSummary(d);
  const backlog = buildBacklog(d);
  const c = d.coverage;
  const a = d.audit;
  const failByGroup = new Map<string, Finding[]>();
  for (const f of d.failures) {
    const sig = groupSignature(f.ruleId, f.url);
    failByGroup.set(sig, [...(failByGroup.get(sig) ?? []), f]);
  }
  const pct = (n: number) => (c.discovered ? Math.round((n / c.discovered) * 100) : 0);
  const wf = [
    ["Discovered", c.discovered],
    ["Checked (HTTP)", c.checked],
    ["Browser-sampled", c.sampled],
    ["Blocked by robots.txt", c.blockedRobots],
    ["Skipped (limits/scope)", c.skipped],
    ["Failed to fetch", c.failed],
  ] as const;

  const sections: string[] = [];
  sections.push(`
<header>
  <div class="brand">${LOGO}<b>WebAudit</b><span>AI</span></div>
  <div class="kicker"><i></i>Website audit report</div>
  <h1>${esc(a.host)}</h1>
  <div class="muted">${esc(a.url)} · ${esc(a.mode)} mode · started ${esc(fmtDate(a.startedAt ?? a.createdAt))} · finished ${esc(fmtDate(a.finishedAt))} · status <b>${esc(a.status)}</b></div>
</header>`);
  if (isPartial(d)) sections.push(`<div class="banner"><b>Partial audit.</b> ${esc(s.limitations[0])}</div>`);

  sections.push(`
<h2>Executive summary</h2>
<div class="card"><p><b>${esc(s.headline)}</b></p><p>${esc(s.scope)}</p><p class="muted">${esc(s.coverageNote)}</p>
${s.topIssues.length ? `<h3>Top priorities</h3><ol class="refs">${s.topIssues.map((t) => `<li>${esc(t.text)} <span class="tag">${esc(t.refs[0])}</span></li>`).join("")}</ol>` : ""}
${s.martech.length ? `<h3>MarTech signals</h3><ul>${s.martech.map((m) => `<li>${esc(m.text)}</li>`).join("")}</ul>` : ""}
</div>`);

  sections.push(`
<div class="grid">
  <div class="stat"><span class="muted">Issue groups</span><b>${d.groups.length}</b></div>
  <div class="stat"><span class="muted">High/critical groups</span><b>${d.groups.filter((g) => g.severity === "high" || g.severity === "critical").length}</b></div>
  <div class="stat"><span class="muted">URLs checked</span><b>${c.checked}</b></div>
  <div class="stat"><span class="muted">Browser-sampled</span><b>${c.sampled}</b></div>
  <div class="stat"><span class="muted">Lighthouse lab (median)</span><b>${d.lighthouse.medianScore ?? "—"}</b></div>
</div>`);

  if (opts.aiSections?.length) {
    sections.push(
      `<h2>AI suggestions</h2><div class="banner">Generated by an optional language model from the findings below. Hypotheses, not verified observations; they do not change any finding, severity or score.</div>` +
        opts.aiSections.map((x) => `<div class="card"><h3>${esc(x.title)}</h3>${x.html}</div>`).join(""),
    );
  }

  sections.push(`
<h2>Coverage</h2>
<div class="card"><table class="wf">${wf
    .map(
      ([label, n]) =>
        `<tr><td>${label}</td><td class="num" style="width:70px">${n}</td><td><div class="bar"><i style="width:${pct(n)}%"></i></div></td></tr>`,
    )
    .join("")}</table>
<p class="muted">Outcomes across all rule evaluations: ${Object.entries(d.outcomeCounts)
    .map(([k, v]) => `${esc(k.replace("_", " "))} ${v}`)
    .join(" · ")}.</p></div>`);

  sections.push(`
<h2>Prioritized backlog</h2>
<div class="card scroll"><table><thead><tr><th class="num">#</th><th>Issue</th><th>Severity</th><th class="num">Affected / tested</th><th>Inferred template</th><th class="num">Priority</th></tr></thead><tbody>
${backlog
  .map(
    (b) =>
      `<tr><td class="num">${b.rank}</td><td><a href="#g-${esc(b.signature)}">${esc(b.title)}</a><div class="muted"><code>${esc(b.ruleId)}</code> · ${esc(CONF_LABEL[b.confidence] ?? b.confidence)}${b.enoughEvidence ? "" : " · <b>not enough evidence</b>"}</div></td><td>${sevBadge(b.severity)}</td><td class="num">${b.affectedPages} / ${b.testedPages}</td><td><code>${esc(b.templateHint)}</code><div class="muted">${esc(b.fixScope)}</div></td><td class="num">${b.priority}</td></tr>`,
  )
  .join("")}
</tbody></table>${backlog.length ? "" : `<p>No failing checks within the tested scope.</p>`}</div>`);

  sections.push(`<h2>Module overview</h2><div class="card scroll"><table><thead><tr><th>Module</th><th class="num">Rules evaluated</th><th class="num">Pages tested</th><th class="num">Failures</th><th class="num">Groups</th><th class="num">Not tested</th><th class="num">Inconclusive</th></tr></thead><tbody>
${d.modules.map((m) => `<tr><td>${esc(m.id)} ${esc(m.name)}</td><td class="num">${m.rulesEvaluated}</td><td class="num">${m.pagesTested}</td><td class="num">${m.failures}</td><td class="num">${m.groups}</td><td class="num">${m.notTested}</td><td class="num">${m.inconclusive}</td></tr>`).join("")}
</tbody></table></div>`);

  sections.push(`<h2>Issue details</h2>`);
  for (const g of d.groups) {
    const rule = getRule(g.ruleId);
    const fs = failByGroup.get(g.signature) ?? [];
    const shot = fs.find((f) => f.evidence.screenshotRef)?.evidence.screenshotRef;
    const shotUrl = shot && opts.artifactUrl?.(shot);
    sections.push(`
<div class="card" id="g-${esc(g.signature)}">
  <h3>${esc(g.title)} ${sevBadge(g.severity)}</h3>
  <div class="muted"><code>${esc(g.ruleId)}</code> · ${esc(CONF_LABEL[g.confidence] ?? g.confidence)} · ${g.affectedPages} affected of ${g.testedPages} tested in <code>${esc(g.templateHint)}</code> (inferred) · group <code>${esc(g.signature)}</code></div>
  ${rule ? `<p>${esc(rule.rationale)}</p>` : ""}
  <p><b>Recommended action:</b> ${esc(g.recommendedAction)}</p>
  ${rule?.caveat ? `<p class="muted"><b>Caveat:</b> ${esc(rule.caveat)}</p>` : ""}
  <p class="muted">Priority ${g.priority} = severity ${g.priorityComponents.severityWeight} × pages ${g.priorityComponents.pageFactor} × confidence ${g.priorityComponents.confidenceFactor} × importance ${g.priorityComponents.importanceFactor}</p>
  ${shotUrl ? `<p><img src="${esc(shotUrl)}" alt="Screenshot of ${esc(fs[0]?.url)}" style="max-width:320px;border:1px solid var(--line);border-radius:8px"></p>` : ""}
  <details><summary>Evidence (${Math.min(fs.length, 5)} of ${fs.length})</summary>${fs.slice(0, 5).map(evidenceBlock).join("")}</details>
</div>`);
  }

  if (d.tagInventory.length) {
    sections.push(`<h2>Tag inventory (sampled pages)</h2><div class="card scroll"><table><thead><tr><th>Vendor</th><th>Category</th><th class="num">Pages observed</th></tr></thead><tbody>
${d.tagInventory.map((t) => `<tr><td>${esc(t.vendor)}</td><td>${esc(t.category.replace("_", " "))}</td><td class="num">${t.pages} / ${t.sampledPages}</td></tr>`).join("")}
</tbody></table><p class="muted">Observed during a single page load per sampled page, before consent interaction (plus after accepting, where a banner was found). Absence here is not proof of absence site-wide.</p></div>`);
  }

  sections.push(`<h2>URL inventory</h2><details class="card"><summary>${d.pages.length} URLs</summary><div class="scroll"><table><thead><tr><th>URL</th><th>State</th><th class="num">HTTP</th><th>Source</th><th class="num">Depth</th><th>Sampled</th><th class="num">Failures</th></tr></thead><tbody>
${d.pages
  .slice(0, 2_000)
  .map(
    (p) =>
      `<tr><td>${esc(p.url)}</td><td>${esc(p.state)}${p.reason ? `<div class="muted">${esc(p.reason)}</div>` : ""}</td><td class="num">${esc(p.status ?? "")}</td><td>${esc(p.source)}${p.inSitemap ? " · sitemap" : ""}</td><td class="num">${p.depth}</td><td>${p.sampled ? "yes" : ""}</td><td class="num">${p.failures}</td></tr>`,
  )
  .join("")}
</tbody></table></div></details>`);

  const policy = a.samplingPolicy as { sampling?: { description?: string } } | null;
  sections.push(`
<h2>Methodology</h2>
<div class="card">
<p><b>Sampling.</b> ${esc(policy?.sampling?.description ?? "—")}</p>
<p><b>Priority index.</b> severity weight (${Object.entries(SEVERITY_WEIGHT)
    .map(([k, v]) => `${k} ${v}`)
    .join(
      ", ",
    )}) × page factor (1 + log₂ affected pages, capped at ${PAGE_FACTOR_CAP}) × confidence (${Object.entries(
    CONFIDENCE_FACTOR,
  )
    .map(([k, v]) => `${k.replace("_", " ")} ${v}`)
    .join(
      ", ",
    )}) × importance (1, start URL 1.25, user priority paths 1.5). It ranks work; it is not a quality percentage or ROI prediction.</p>
<p><b>Confidence.</b> Confirmed = directly observed. Potential = likely issue inferred from signals; verify first. Manual review = needs human judgement.</p>
<p><b>Engine versions.</b> ${Object.entries(a.engineVersions ?? {})
    .map(([k, v]) => `${esc(k)} ${esc(v)}`)
    .join(" · ")}</p>
<details><summary>Audit configuration</summary><pre>${esc(JSON.stringify(a.config, null, 2))}</pre></details>
</div>
<h2>Limitations</h2><div class="card"><ul>${s.limitations.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`);

  if (d.warnings.length) {
    sections.push(
      `<h2>Warnings during the audit</h2><details class="card"><summary>${d.warnings.length} warning(s)</summary><ul>${d.warnings
        .slice(0, 100)
        .map((w) => `<li><span class="muted">${esc(w.at)}</span> ${esc(w.message)}</li>`)
        .join("")}</ul></details>`,
    );
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebAudit AI — ${esc(a.host)}</title><meta name="generator" content="WebAudit AI"><style>${CSS}</style></head>
<body><div class="wrap">${sections.join("\n")}
<footer>Generated ${esc(d.generatedAt)} by WebAudit AI — evidence for every fix. Findings are evidence-backed observations and heuristics; they are not legal, accessibility-conformance or performance guarantees.</footer>
</div></body></html>`;
}
