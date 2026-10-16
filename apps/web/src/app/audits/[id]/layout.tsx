import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { countUrlsByState, listGroups } from "@webaudit/db";
import { StatusBadge } from "@/components/audit/badges";
import { AuditNav } from "@/components/shell/audit-nav";
import { getAuditRow, isFinished } from "@/lib/audit";
import { services } from "@/lib/server";
import { formatDate } from "@/lib/utils";

export default async function AuditLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = getAuditRow(id);
  if (!audit) notFound();
  const finished = isFinished(audit);
  const { db } = services();
  const counts = finished
    ? {
        issues: new Set(listGroups(db, id).map((g) => g.ruleId)).size,
        pages: countUrlsByState(db, id).checked,
      }
    : undefined;

  return (
    <div>
      <header className="border-b border-line bg-surface px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="capitalize">{audit.mode} audit</span>
              <span aria-hidden>·</span>
              <span>{formatDate(audit.createdAt)}</span>
              <span aria-hidden>·</span>
              <span className="capitalize">{audit.config.device}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight">{audit.host}</h1>
              <StatusBadge status={audit.status} />
            </div>
            <a
              href={audit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-accent"
            >
              {audit.url} <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>
        <div className="mt-3">
          <AuditNav id={id} counts={counts} />
        </div>
      </header>
      <div className="px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
