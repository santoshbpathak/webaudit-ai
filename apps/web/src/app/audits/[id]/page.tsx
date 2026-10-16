import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleSlash, OctagonAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { buildExecutiveSummary, isPartial } from "@webaudit/report";
import { ConfidenceBadge, SeverityBadge } from "@/components/audit/badges";
import { CoverageFunnel, Meter, SeverityBar } from "@/components/audit/charts";
import { LiveCrawl } from "@/components/audit/live-crawl";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { getAuditRow, getReport, isFinished } from "@/lib/audit";
import { issueTypes, severityCounts } from "@/lib/issues";
import { MODULE_META } from "@/lib/modules-meta";
import { cn, pathOf, pct } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: getAuditRow(id)?.host ?? "Audit" };
}

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAuditRow(id);
  if (!audit) notFound();

  if (audit.status === "failed") {
    return (
      <Card>
        <EmptyState illustration="audit-failed" title="The audit could not run">
          {audit.error ?? "No error details were recorded."}
        </EmptyState>
      </Card>
    );
  }
  if (!isFinished(audit)) return <LiveCrawl id={id} />;

  const data = getReport(id);
  const summary = buildExecutiveSummary(data);
  const issues = issueTypes(data.groups);
  const sev = severityCounts(issues);
  const c = data.coverage;
  const pagesWithIssues = new Set(data.failures.map((f) => f.url)).size;
  const verdict =
    (sev.critical ?? 0) > 0
      ? { tone: "text-sev-critical", icon: OctagonAlert, text: "Critical issues need attention" }
      : (sev.high ?? 0) > 0
        ? { tone: "text-sev-high", icon: TriangleAlert, text: "High-priority issues found" }
        : issues.length
          ? { tone: "text-sev-low", icon: ShieldCheck, text: "Only medium and low-priority issues" }
          : { tone: "text-ok", icon: ShieldCheck, text: "No failing checks in the tested scope" };
  const topPages = [...data.pages]
    .filter((p) => p.failures > 0)
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 6);
  const modulesById = new Map<string, (typeof data.modules)[number]>(data.modules.map((m) => [m.id, m]));
  const base = `/audits/${id}`;
  const enabled = MODULE_META.filter((m) => (audit.config.modules as string[]).includes(m.id));

  return (
    <div className="space-y-5">
      {isPartial(data) && <Callout title="Partial results">{summary.limitations[0]}</Callout>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3">
              <verdict.icon className={cn("mt-0.5 size-5 shrink-0", verdict.tone)} aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-ink">{verdict.text}</h2>
                <p className="mt-1 text-[13px] text-ink-2">
                  {issues.length
                    ? `${issues.length} issue types (${data.groups.length} template-level groups) across ${pagesWithIssues} pages; ${(sev.critical ?? 0) + (sev.high ?? 0)} rated high or critical.`
                    : `All evaluated checks passed on the ${c.checked} checked URLs.`}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Assessment derived from issue severities on tested pages — not a site quality score.
                </p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                Issue types by severity
              </p>
              <SeverityBar counts={sev} unit="issue types" />
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
              {(
                [
                  ["Issue types", issues.length],
                  ["Pages with issues", pagesWithIssues],
                  ["URLs checked", c.checked],
                  ["Lighthouse lab (median)", data.lighthouse.medianScore ?? "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] text-muted">{k}</dt>
                  <dd className="tabular mt-0.5 text-lg font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Scope & coverage"
            description={`${data.audit.mode} mode · ${data.audit.config.device}`}
          />
          <CardBody>
            <CoverageFunnel
              max={c.discovered}
              rows={[
                { label: "Discovered", value: c.discovered, kind: "stage" },
                { label: "Checked (HTTP)", value: c.checked, kind: "stage" },
                {
                  label: "Browser-sampled",
                  value: c.sampled,
                  kind: "stage",
                  hint: "browser-check denominator",
                },
                { label: "Blocked by robots.txt", value: c.blockedRobots, kind: "excluded" },
                { label: "Skipped", value: c.skipped, kind: "excluded", hint: "limits or scope" },
                { label: "Failed to fetch", value: c.failed, kind: "excluded" },
              ]}
            />
            <Link
              href={`${base}/pages`}
              className="mt-4 inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Explore all URLs <ArrowRight className="size-3" aria-hidden />
            </Link>
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="cat-h">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="cat-h" className="text-[13px] font-semibold text-ink">
            Categories
          </h2>
          <span className="text-xs text-muted">checks passed / checks evaluated</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {enabled.map((m) => {
            const s = modulesById.get(m.id);
            const evaluated = s?.checksEvaluated ?? 0;
            const passed = s?.checksPassed ?? 0;
            const modIssues = issues.filter((i) => i.module === m.id);
            return (
              <Link
                key={m.id}
                href={`${base}/categories/${m.slug}`}
                className="rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
              >
                <div className="flex items-center gap-2">
                  <m.icon className="size-4 text-muted" aria-hidden />
                  <span className="truncate text-[13px] font-medium text-ink">{m.name}</span>
                </div>
                {evaluated === 0 ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    <CircleSlash className="size-3.5" aria-hidden /> Not tested in this audit
                  </p>
                ) : (
                  <>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="tabular text-lg font-semibold text-ink">
                        {pct(passed, evaluated)}%
                      </span>
                      <span className="tabular text-[11px] text-muted">
                        {passed.toLocaleString()} / {evaluated.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Meter value={passed} max={evaluated} label={`${m.name} checks passed`} />
                    </div>
                    <p className="mt-2.5 truncate text-[11px] text-muted">
                      {modIssues.length
                        ? `${modIssues.length} issue type${modIssues.length === 1 ? "" : "s"} · ${modIssues[0]!.title}`
                        : "No failing checks"}
                    </p>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            title="Top issues"
            description="Ranked by priority index (severity × reach × confidence × importance)"
            action={
              <Link href={`${base}/issues`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                All issues <ArrowRight />
              </Link>
            }
          />
          {issues.length === 0 ? (
            <EmptyState illustration="no-issues" title="No failing checks">
              Nothing failed within the tested scope. Review coverage and limitations before concluding the
              site is issue-free.
            </EmptyState>
          ) : (
            <ul>
              {issues.slice(0, 6).map((it) => (
                <li key={it.ruleId} className="border-b border-line last:border-0">
                  <Link
                    href={`${base}/issues/${it.templates[0]!.signature}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/60"
                  >
                    <SeverityBadge severity={it.severity} className="w-20 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{it.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <span className="font-mono">{it.ruleId}</span>
                        <span aria-hidden>·</span>
                        {it.templates.length} template{it.templates.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ConfidenceBadge confidence={it.confidence} className="hidden sm:inline-flex" />
                    <span className="tabular w-24 shrink-0 text-right text-xs text-ink-2">
                      {it.affectedPages}/{it.testedPages} pages
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Most impacted pages"
              action={
                <Link href={`${base}/pages?sort=failures`} className="text-xs text-accent hover:underline">
                  All pages
                </Link>
              }
            />
            {topPages.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No page has failing checks.</p>
            ) : (
              <ul>
                {topPages.map((p) => (
                  <li key={p.url} className="border-b border-line last:border-0">
                    <Link
                      href={`${base}/pages/inspect?url=${encodeURIComponent(p.url)}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2/60"
                    >
                      <span className="min-w-0 truncate font-mono text-xs text-ink-2">{pathOf(p.url)}</span>
                      <span className="tabular shrink-0 text-xs text-ink">{p.failures} failing checks</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader
              title="Recommended next steps"
              action={
                <Link href={`${base}/recommendations`} className="text-xs text-accent hover:underline">
                  Full backlog
                </Link>
              }
            />
            <CardBody>
              <ol className="list-decimal space-y-2 pl-4 text-xs text-ink-2 marker:text-muted">
                {issues.slice(0, 3).map((it) => (
                  <li key={it.ruleId}>
                    <span className="font-medium text-ink">{it.title}.</span> {it.recommendedAction}
                  </li>
                ))}
                {issues.length === 0 && (
                  <li>Re-run with a larger page limit or Deep mode to widen coverage.</li>
                )}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Limitations" description="What this audit cannot tell you" />
        <CardBody>
          <ul className="grid gap-x-8 gap-y-1.5 text-xs text-ink-2 md:grid-cols-2">
            {[...summary.limitations, summary.coverageNote].map((l) => (
              <li key={l} className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
                {l}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
