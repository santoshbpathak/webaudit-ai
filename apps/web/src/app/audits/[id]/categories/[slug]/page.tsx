import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import type { LighthouseSummary } from "@webaudit/core";
import { listSnapshots } from "@webaudit/db";
import { ALL_MODULES, getRule, observeTrackers } from "@webaudit/modules";
import { ConfidenceBadge, SeverityBadge } from "@/components/audit/badges";
import { Meter } from "@/components/audit/charts";
import { NotFinished } from "@/components/audit/not-finished";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { getAuditRow, getReport, isFinished } from "@/lib/audit";
import { issueTypes } from "@/lib/issues";
import { MODULE_META, moduleBySlug } from "@/lib/modules-meta";
import { services } from "@/lib/server";
import { pathOf, pct } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: moduleBySlug(slug)?.name ?? "Category" };
}

export default async function CategoryPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const audit = getAuditRow(id);
  const meta = moduleBySlug(slug);
  if (!audit || !meta) notFound();
  if (!isFinished(audit)) return <NotFinished id={id} />;
  const data = getReport(id);
  const summary = data.modules.find((m) => m.id === meta.id);
  const issues = issueTypes(data.groups).filter((i) => i.module === meta.id);
  const mod = ALL_MODULES.find((m) => m.id === meta.id)!;
  const coverage = data.ruleCoverage.filter((r) => getRule(r.ruleId)?.module === meta.id);
  // Static rules first (documented order), then any dynamic ones (axe) seen in this audit.
  const ruleIds = [...new Set([...mod.rules.map((r) => r.id), ...coverage.map((r) => r.ruleId)])];
  const covBy = new Map(coverage.map((r) => [r.ruleId, r]));
  const issueBy = new Map(issues.map((i) => [i.ruleId, i]));
  const enabled = (audit.config.modules as string[]).includes(meta.id);
  const evaluated = summary?.checksEvaluated ?? 0;
  const base = `/audits/${id}`;
  const caveat = mod.rules.find((r) => r.caveat)?.caveat;

  const snaps = ["M02", "M04", "M05", "M08"].includes(meta.id)
    ? listSnapshots(services().db, id).filter((s) => s.browser)
    : [];
  const lhRows =
    meta.id === "M02"
      ? snaps
          .filter((s) => s.browser?.lighthouse && !("error" in s.browser.lighthouse))
          .map((s) => ({ url: s.url, lh: s.browser!.lighthouse as LighthouseSummary }))
      : [];
  const category =
    meta.id === "M04"
      ? ["analytics", "tag_manager"]
      : meta.id === "M05"
        ? ["advertising"]
        : ["analytics", "advertising", "session_replay"];
  const tags = data.tagInventory.filter((t) => category.includes(t.category));
  const banners = snaps.filter((s) => s.browser?.consent.bannerDetected).length;
  const preConsent = snaps.filter((s) =>
    observeTrackers((s.browser?.requests ?? []).filter((r) => r.beforeConsent)).some(
      (o) => o.hits.length && o.tracker.category !== "tag_manager",
    ),
  ).length;

  return (
    <div className="space-y-5">
      <nav aria-label="Categories" className="flex gap-1 overflow-x-auto pb-1">
        {MODULE_META.map((m) => (
          <Link
            key={m.slug}
            href={`${base}/categories/${m.slug}`}
            aria-current={m.slug === slug ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${m.slug === slug ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:text-ink"}`}
          >
            <m.icon className="size-3.5" aria-hidden /> {m.name}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            <meta.icon className="size-5 text-muted" aria-hidden /> {meta.name}
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">{meta.summary}</p>
        </div>
      </div>

      {!enabled ? (
        <Card>
          <EmptyState icon={CircleSlash} title="This module was disabled for this audit">
            Enable it under Advanced crawler controls when starting a new audit.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-3.5">
              <p className="text-[11px] text-muted">Checks passed</p>
              <p className="tabular mt-1 text-xl font-semibold">
                {evaluated ? `${pct(summary!.checksPassed, evaluated)}%` : "—"}
              </p>
              {evaluated > 0 && (
                <div className="mt-2">
                  <Meter value={summary!.checksPassed} max={evaluated} label="Checks passed" />
                </div>
              )}
              <p className="tabular mt-1.5 text-[11px] text-muted">
                {summary?.checksPassed ?? 0} of {evaluated} evaluated
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[11px] text-muted">Issue types</p>
              <p className="tabular mt-1 text-xl font-semibold">{issues.length}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[11px] text-muted">Pages tested</p>
              <p className="tabular mt-1 text-xl font-semibold">{summary?.pagesTested ?? 0}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[11px] text-muted">Not tested · inconclusive</p>
              <p className="tabular mt-1 text-xl font-semibold">
                {summary?.notTested ?? 0} · {summary?.inconclusive ?? 0}
              </p>
              <p className="mt-1.5 text-[11px] text-muted">rule evaluations without a verdict</p>
            </Card>
          </div>

          {caveat && <Callout tone="info">{caveat}</Callout>}

          {meta.id === "M02" && (
            <Card>
              <CardHeader
                title="Lighthouse lab results"
                description="Sampled pages only · simulated throttling · not field data"
              />
              {lhRows.length === 0 ? (
                <EmptyState title="Lighthouse did not run">
                  Lighthouse runs on up to the configured number of sampled pages. It may have been disabled
                  or failed — see the audit log.
                </EmptyState>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Page</TH>
                      <TH className="text-right">Score</TH>
                      <TH className="text-right">LCP</TH>
                      <TH className="text-right">CLS</TH>
                      <TH className="text-right">TBT</TH>
                      <TH className="text-right">Weight</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {lhRows.map(({ url, lh }) => (
                      <TR key={url}>
                        <TD>
                          <Link
                            href={`${base}/pages/inspect?url=${encodeURIComponent(url)}`}
                            className="font-mono text-xs hover:text-accent"
                          >
                            {pathOf(url)}
                          </Link>
                        </TD>
                        <TD className="tabular text-right font-medium">
                          {lh.performanceScore === null ? "—" : Math.round(lh.performanceScore * 100)}
                        </TD>
                        <TD className="tabular text-right">
                          {lh.metrics.lcpMs ? `${(lh.metrics.lcpMs / 1000).toFixed(1)} s` : "—"}
                        </TD>
                        <TD className="tabular text-right">{lh.metrics.cls?.toFixed(3) ?? "—"}</TD>
                        <TD className="tabular text-right">
                          {lh.metrics.tbtMs !== undefined ? `${Math.round(lh.metrics.tbtMs)} ms` : "—"}
                        </TD>
                        <TD className="tabular text-right">
                          {lh.metrics.totalByteWeight
                            ? `${(lh.metrics.totalByteWeight / 1048576).toFixed(2)} MB`
                            : "—"}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          )}

          {["M04", "M05", "M08"].includes(meta.id) && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title="Tags observed"
                  description={`Across ${snaps.length} browser-sampled pages`}
                />
                {tags.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted">
                    No matching tags observed on sampled pages.
                  </p>
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Vendor</TH>
                        <TH>Type</TH>
                        <TH className="text-right">Pages</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {tags.map((t) => (
                        <TR key={t.vendor}>
                          <TD>{t.vendor}</TD>
                          <TD className="text-xs text-muted">{t.category.replace("_", " ")}</TD>
                          <TD className="tabular text-right">
                            {t.pages} / {t.sampledPages}
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
              {meta.id === "M08" && (
                <Card>
                  <CardHeader
                    title="Consent behaviour"
                    description="Observed before any banner interaction"
                  />
                  <CardBody>
                    <dl className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <dt className="text-muted">Pages with a detected banner</dt>
                        <dd className="tabular mt-0.5 text-lg font-semibold">
                          {banners} / {snaps.length}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Pages with tracking hits pre-consent</dt>
                        <dd className="tabular mt-0.5 text-lg font-semibold">
                          {preConsent} / {snaps.length}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-[11px] text-muted">
                      Google Consent Mode “denied” pings are excluded. Indicators only — not a legal
                      determination.
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardHeader
              title="Issues in this category"
              action={
                <Link
                  href={`${base}/issues?module=${meta.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  Open in Issue explorer
                </Link>
              }
            />
            {issues.length === 0 ? (
              <EmptyState illustration="no-issues" title="No failing checks in this category" />
            ) : (
              <ul>
                {issues.map((it) => (
                  <li key={it.ruleId} className="border-b border-line last:border-0">
                    <Link
                      href={`${base}/issues/${it.templates[0]!.signature}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/60"
                    >
                      <SeverityBadge severity={it.severity} className="w-20 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                        {it.title}
                      </span>
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

          <Card>
            <CardHeader
              title="Rule coverage"
              description="Every rule in this category with its exact denominator"
            />
            <Table>
              <THead>
                <tr>
                  <TH>Rule</TH>
                  <TH>Result</TH>
                  <TH className="text-right">Failed</TH>
                  <TH className="text-right">Tested</TH>
                  <TH className="text-right">Not tested</TH>
                  <TH className="text-right">Inconclusive</TH>
                </tr>
              </THead>
              <tbody>
                {ruleIds.map((rid) => {
                  const cv = covBy.get(rid);
                  const r = getRule(rid);
                  const it = issueBy.get(rid);
                  const tested = cv?.tested ?? 0;
                  return (
                    <TR key={rid}>
                      <TD className="max-w-md">
                        <p className="text-[13px] text-ink">{r?.title ?? rid}</p>
                        <p className="font-mono text-[11px] text-muted">{rid}</p>
                      </TD>
                      <TD>
                        {it ? (
                          <Link
                            href={`${base}/issues/${it.templates[0]!.signature}`}
                            className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
                          >
                            <XCircle className="size-3.5" aria-hidden /> Failing
                          </Link>
                        ) : tested > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-ok">
                            <CheckCircle2 className="size-3.5" aria-hidden /> Passing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <CircleSlash className="size-3.5" aria-hidden /> No verdict
                          </span>
                        )}
                      </TD>
                      <TD className="tabular text-right text-xs">{cv?.failed ?? 0}</TD>
                      <TD className="tabular text-right text-xs">{tested}</TD>
                      <TD className="tabular text-right text-xs text-muted">{cv?.notTested ?? 0}</TD>
                      <TD className="tabular text-right text-xs text-muted">{cv?.inconclusive ?? 0}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
