import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAudit } from "@webaudit/db";
import { diffAudits, loadReportData, type DiffEntry } from "@webaudit/report";
import { SeverityBadge } from "@/components/audit/badges";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { services } from "@/lib/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Compare audits" };

function Section({
  title,
  items,
  hint,
  auditId,
}: {
  title: string;
  items: DiffEntry[];
  hint?: string;
  auditId: string;
}) {
  return (
    <Card>
      <CardHeader title={`${title} (${items.length})`} description={hint} />
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted">None.</p>
      ) : (
        <ul className="max-h-[420px] overflow-y-auto">
          {items.map((x) => (
            <li
              key={x.signature}
              className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0"
            >
              <SeverityBadge severity={x.severity} className="w-20 shrink-0" />
              <Link
                href={`/audits/${auditId}/issues/${x.signature}`}
                className="min-w-0 flex-1 truncate text-ink hover:text-accent"
              >
                {x.title}
              </Link>
              <code className="hidden shrink-0 font-mono text-[11px] text-muted md:inline">
                {x.templateHint}
              </code>
              <span className="tabular w-20 shrink-0 text-right text-xs text-ink-2">
                {x.before} → {x.after}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ base?: string; head?: string }>;
}) {
  const { base, head } = await searchParams;
  const { db } = services();
  const a = base ? getAudit(db, base) : undefined;
  const b = head ? getAudit(db, head) : undefined;
  if (!a || !b) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Card>
          <EmptyState
            illustration="empty-history"
            title="Choose two audits to compare"
            action={
              <Link href="/history" className={buttonVariants()}>
                Go to history
              </Link>
            }
          >
            Select two finished audits of the same site in Audits & history.
          </EmptyState>
        </Card>
      </div>
    );
  }
  const d = diffAudits(loadReportData(db, a.id), loadReportData(db, b.id));
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Compare"
        title={b.host}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link href={`/audits/${a.id}`} className="text-accent hover:underline">
              {formatDate(a.createdAt)}
            </Link>
            <ArrowRight className="size-3.5 text-muted" aria-hidden />
            <Link href={`/audits/${b.id}`} className="text-accent hover:underline">
              {formatDate(b.createdAt)}
            </Link>
          </span>
        }
      />
      {!d.comparable && (
        <Callout title="Scopes differ — some changes reflect coverage, not the site">
          <ul className="list-disc pl-4">
            {d.scopeNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Callout>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="New" items={d.newIssues} auditId={b.id} />
        <Section
          title="Resolved"
          items={d.resolved}
          hint="Re-tested on the affected pages and no longer failing."
          auditId={a.id}
        />
        <Section
          title="Not re-tested"
          items={d.notRetested}
          hint="Absent in the newer audit, but not checked again — not counted as fixed."
          auditId={a.id}
        />
        <Section title="Persisting" items={d.persisting} auditId={b.id} />
      </div>
    </div>
  );
}
