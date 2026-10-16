"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { EFFORT_LABEL, type IssueType } from "@/lib/issues-shared";
import { cn } from "@/lib/utils";
import { ConfidenceBadge, SeverityBadge } from "./badges";

const EFFORTS = [
  ["", "Any effort"],
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
] as const;

/** Quick win = verified/heuristic high-or-critical issue with a small estimated fix. */
const isQuickWin = (i: IssueType) =>
  i.effort.level === "small" &&
  (i.severity === "critical" || i.severity === "high") &&
  i.confidence !== "manual_review";

export function RecommendationsTable({ auditId, issues }: { auditId: string; issues: IssueType[] }) {
  const [effort, setEffort] = useState<string>("");
  const [quick, setQuick] = useState(false);
  const rows = useMemo(
    () => issues.filter((i) => (!effort || i.effort.level === effort) && (!quick || isQuickWin(i))),
    [issues, effort, quick],
  );
  const quickCount = issues.filter(isQuickWin).length;

  return (
    <Card>
      <CardHeader
        title="Remediation backlog"
        description="Ordered by priority index. Effort is a heuristic estimate for planning, not a measurement."
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-pressed={quick}
              onClick={() => setQuick((q) => !q)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs",
                quick ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:text-ink",
              )}
            >
              <Zap className="size-3.5" aria-hidden /> Quick wins{" "}
              <span className="tabular">{quickCount}</span>
            </button>
            <div
              role="group"
              aria-label="Effort filter"
              className="inline-flex rounded-md border border-line p-0.5 text-xs"
            >
              {EFFORTS.map(([v, l]) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={effort === v}
                  onClick={() => setEffort(v)}
                  className={cn(
                    "h-7 cursor-pointer rounded px-2",
                    effort === v ? "bg-surface-3 text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          illustration={issues.length ? "no-results" : "no-issues"}
          title={issues.length ? "Nothing matches this filter" : "No remediation needed in the tested scope"}
        />
      ) : (
        <Table>
          <caption className="sr-only">Prioritised remediation backlog</caption>
          <THead>
            <tr>
              <TH className="text-right">#</TH>
              <TH>Action</TH>
              <TH>Severity</TH>
              <TH className="text-right">Pages</TH>
              <TH>Est. effort</TH>
              <TH className="text-right">Priority</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((i) => (
              <TR key={i.ruleId}>
                <TD className="tabular text-right text-xs text-muted">{issues.indexOf(i) + 1}</TD>
                <TD className="max-w-xl">
                  <Link
                    href={`/audits/${auditId}/issues/${i.templates[0]!.signature}`}
                    className="text-[13px] font-medium text-ink hover:text-accent"
                  >
                    {i.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-2">{i.recommendedAction}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <ConfidenceBadge confidence={i.confidence} />
                    <span className="font-mono text-[11px] text-muted">{i.ruleId}</span>
                    {isQuickWin(i) && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                        <Zap className="size-3" aria-hidden /> quick win
                      </span>
                    )}
                    {!i.enoughEvidence && <span className="text-[11px] text-warn">thin evidence</span>}
                  </div>
                </TD>
                <TD>
                  <SeverityBadge severity={i.severity} />
                </TD>
                <TD className="tabular text-right text-xs text-ink-2">
                  {i.affectedPages}/{i.testedPages}
                  <p className="text-[11px] text-muted">{i.templates.length} tmpl.</p>
                </TD>
                <TD className="max-w-48 text-xs">
                  <span className="tabular mr-1.5 inline-flex size-5 items-center justify-center rounded bg-surface-3 text-[11px] font-medium text-ink-2">
                    {EFFORT_LABEL[i.effort.level]}
                  </span>
                  <span className="text-muted">{i.effort.basis}</span>
                </TD>
                <TD className="tabular text-right font-medium">{i.priority}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
