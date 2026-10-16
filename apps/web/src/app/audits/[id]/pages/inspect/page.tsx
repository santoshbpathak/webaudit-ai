import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ImageOff } from "lucide-react";
import type { LighthouseSummary } from "@webaudit/core";
import { getSnapshot, getUrl, listFindings } from "@webaudit/db";
import { getRule, observeTrackers } from "@webaudit/modules";
import { groupSignature } from "@webaudit/scoring";
import { ConfidenceBadge, SeverityBadge } from "@/components/audit/badges";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { getAuditRow } from "@/lib/audit";
import { moduleById } from "@/lib/modules-meta";
import { services } from "@/lib/server";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Page inspector" };

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function Metric({
  label,
  value,
  status,
}: {
  label: string;
  value: React.ReactNode;
  status?: "good" | "warn" | "poor";
}) {
  return (
    <div className="rounded-md border border-line p-2.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd
        className={cn(
          "tabular mt-0.5 text-sm font-semibold",
          status === "poor" ? "text-sev-critical" : status === "warn" ? "text-sev-medium" : "text-ink",
        )}
      >
        {value}
        {status && (
          <span className="ml-1.5 text-[10px] font-normal text-muted">
            {status === "good" ? "good" : status === "warn" ? "needs improvement" : "poor"}
          </span>
        )}
      </dd>
    </div>
  );
}

const rate = (v: number | undefined, good: number, poor: number) =>
  v === undefined ? undefined : v <= good ? "good" : v <= poor ? "warn" : "poor";

export default async function InspectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ url?: string }>;
}) {
  const { id } = await params;
  const { url } = await searchParams;
  const audit = getAuditRow(id);
  if (!audit || !url) notFound();
  const { db } = services();
  const row = getUrl(db, id, url);
  if (!row) notFound();
  const snap = getSnapshot(db, id, url);
  const all = listFindings(db, id, { url });
  const fails = all
    .filter((f) => f.status === "fail")
    .sort((a, b) => SEV_RANK[a.severity]! - SEV_RANK[b.severity]!);
  const inconclusive = all.filter((f) => f.status === "inconclusive").length;
  const notTested = all.filter((f) => f.status === "not_tested").length;
  const passed = all.filter((f) => f.status === "pass").length;
  const b = snap?.browser;
  const f = snap?.features;
  const lh = b?.lighthouse && !("error" in b.lighthouse) ? (b.lighthouse as LighthouseSummary) : undefined;
  const lhError =
    b?.lighthouse && "error" in b.lighthouse ? (b.lighthouse as { error: string }).error : undefined;
  const trackers = b ? observeTrackers(b.requests) : [];
  const shot = b?.screenshotRef
    ? `/api/audits/${id}/artifacts/by-path?path=${encodeURIComponent(b.screenshotRef)}`
    : undefined;

  return (
    <div className="space-y-5">
      <Link
        href={`/audits/${id}/pages`}
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> All pages
      </Link>
      <div>
        <h2 className="break-all font-mono text-sm font-medium text-ink">{url}</h2>
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span>HTTP {row.httpStatus ?? "—"}</span>
          <span>depth {row.depth}</span>
          <span>
            found via {row.source}
            {row.inSitemap ? " · in sitemap" : ""}
          </span>
          <span>
            {row.sampled ? `browser-sampled (${row.sampleReason?.replace("_", " ")})` : "HTTP checks only"}
          </span>
          {row.checkedAt && <span>checked {formatDate(row.checkedAt)}</span>}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Open page <ExternalLink className="size-3" aria-hidden />
          </a>
        </p>
      </div>
      {!row.sampled && row.state === "checked" && (
        <Callout tone="info">
          This page was not in the browser sample, so {notTested} browser-based checks (performance,
          accessibility, tags, forms, UX, consent) were not run on it.
        </Callout>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Technical summary" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metric label="HTTP status" value={snap?.status ?? row.httpStatus ?? "—"} />
                <Metric label="Response time" value={snap ? `${snap.elapsedMs} ms` : "—"} />
                <Metric label="Transfer size" value={snap ? `${(snap.bytes / 1024).toFixed(1)} KB` : "—"} />
                <Metric label="Main-content words" value={f?.wordCount ?? "—"} />
                {lh && (
                  <>
                    <Metric
                      label="Lighthouse lab score"
                      value={lh.performanceScore === null ? "—" : Math.round(lh.performanceScore * 100)}
                    />
                    <Metric
                      label="LCP (lab)"
                      value={lh.metrics.lcpMs ? `${(lh.metrics.lcpMs / 1000).toFixed(1)} s` : "—"}
                      status={rate(lh.metrics.lcpMs, 2500, 4000)}
                    />
                    <Metric
                      label="CLS (lab)"
                      value={lh.metrics.cls?.toFixed(3) ?? "—"}
                      status={rate(lh.metrics.cls, 0.1, 0.25)}
                    />
                    <Metric
                      label="TBT (lab)"
                      value={lh.metrics.tbtMs !== undefined ? `${Math.round(lh.metrics.tbtMs)} ms` : "—"}
                      status={rate(lh.metrics.tbtMs, 200, 600)}
                    />
                  </>
                )}
              </dl>
              {lhError && (
                <p className="mt-3 text-xs text-warn">Lighthouse did not complete on this page: {lhError}</p>
              )}
              {lh && (
                <p className="mt-3 text-[11px] text-muted">
                  Lighthouse {lh.version} lab data with simulated throttling — not field Core Web Vitals.
                </p>
              )}
              <dl className="mt-4 divide-y divide-line border-t border-line text-xs">
                {(
                  [
                    ["Title", f?.title],
                    ["Meta description", f?.metaDescription],
                    ["H1", f?.h1?.join(" · ")],
                    ["Canonical", f?.canonical],
                    ["Language", f?.lang],
                    ["Final URL", snap?.finalUrl !== url ? snap?.finalUrl : undefined],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className={cn("break-words", v ? "text-ink-2" : "text-muted")}>{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`Issues on this page (${fails.length})`}
              description={`${passed} checks passed · ${inconclusive} inconclusive · ${notTested} not tested`}
            />
            {fails.length === 0 ? (
              <EmptyState illustration="no-issues" title="No failing checks on this page" />
            ) : (
              <ul>
                {fails.map((x) => {
                  const r = getRule(x.ruleId);
                  return (
                    <li key={x.findingId} className="border-b border-line last:border-0">
                      <Link
                        href={`/audits/${id}/issues/${groupSignature(x.ruleId, x.url)}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/60"
                      >
                        <SeverityBadge severity={x.severity} className="mt-0.5 w-20 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-ink">{r?.title ?? x.ruleId}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{x.recommendedAction}</p>
                          <p className="mt-1 text-[11px] text-muted">
                            <span className="font-mono">{x.ruleId}</span> · {moduleById(x.module)?.name}
                          </p>
                        </div>
                        <ConfidenceBadge
                          confidence={x.confidence}
                          className="hidden shrink-0 sm:inline-flex"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Rendered page"
              description={
                b ? `${b.viewport.width}×${b.viewport.height} viewport, above the fold` : "Not captured"
              }
            />
            <CardBody>
              {shot ? (
                <img
                  src={shot}
                  alt={`Rendered above-the-fold view of ${url}`}
                  className="mx-auto w-full max-w-[260px] rounded-md border border-line"
                />
              ) : (
                <EmptyState icon={ImageOff} title="No screenshot">
                  Screenshots are captured for browser-sampled pages only.
                </EmptyState>
              )}
            </CardBody>
          </Card>
          {b && (
            <Card>
              <CardHeader title="Observed tags & consent" />
              <CardBody className="space-y-3 text-xs">
                {trackers.length === 0 ? (
                  <p className="text-muted">No analytics or advertising tags observed in this page load.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {trackers.map((t) => (
                      <li key={t.tracker.id} className="flex items-center justify-between gap-2">
                        <span className="text-ink-2">{t.tracker.vendor}</span>
                        <span className="tabular text-muted">
                          {t.libraryLoads.length} load · {t.hits.length} hit
                          {t.hits.some((h) => h.beforeConsent) ? " · pre-consent" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <dl className="grid grid-cols-2 gap-2 border-t border-line pt-3">
                  <div>
                    <dt className="text-[11px] text-muted">Consent banner</dt>
                    <dd className="mt-0.5 text-ink-2">
                      {b.consent.bannerDetected ? `Detected (${b.consent.cmp})` : "Not detected"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Requests</dt>
                    <dd className="tabular mt-0.5 text-ink-2">{b.requests.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Cookies</dt>
                    <dd className="tabular mt-0.5 text-ink-2">{b.cookies.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Forms</dt>
                    <dd className="tabular mt-0.5 text-ink-2">{b.forms.length}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
