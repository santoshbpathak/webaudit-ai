import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleSlash } from "lucide-react";
import { Meter } from "@/components/audit/charts";
import { NotFinished } from "@/components/audit/not-finished";
import { getAuditRow, getReport, isFinished } from "@/lib/audit";
import { issueTypes } from "@/lib/issues";
import { MODULE_META } from "@/lib/modules-meta";
import { pct } from "@/lib/utils";

export const metadata = { title: "Categories" };

export default async function CategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAuditRow(id);
  if (!audit) notFound();
  if (!isFinished(audit)) return <NotFinished id={id} />;
  const data = getReport(id);
  const issues = issueTypes(data.groups);
  const byId = new Map<string, (typeof data.modules)[number]>(data.modules.map((m) => [m.id, m]));
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {MODULE_META.map((m) => {
        const s = byId.get(m.id);
        const enabled = (audit.config.modules as string[]).includes(m.id);
        const evaluated = s?.checksEvaluated ?? 0;
        const n = issues.filter((i) => i.module === m.id).length;
        return (
          <Link
            key={m.id}
            href={`/audits/${id}/categories/${m.slug}`}
            className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
          >
            <div className="flex items-center gap-2">
              <m.icon className="size-4 text-muted" aria-hidden />
              <h2 className="text-[13px] font-semibold text-ink">{m.name}</h2>
              <span className="ml-auto font-mono text-[11px] text-muted">{m.id}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{m.summary}</p>
            {!enabled || evaluated === 0 ? (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                <CircleSlash className="size-3.5" aria-hidden />{" "}
                {enabled ? "No checks could be evaluated" : "Module disabled for this audit"}
              </p>
            ) : (
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-2">
                    <span className="tabular text-base font-semibold text-ink">
                      {pct(s!.checksPassed, evaluated)}%
                    </span>{" "}
                    checks passed
                  </span>
                  <span className="tabular text-muted">
                    {s!.checksPassed.toLocaleString()} / {evaluated.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter value={s!.checksPassed} max={evaluated} label={`${m.name} checks passed`} />
                </div>
                <p className="mt-2.5 text-[11px] text-muted">
                  {n} issue type{n === 1 ? "" : "s"} · {s!.pagesTested} pages tested
                </p>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
