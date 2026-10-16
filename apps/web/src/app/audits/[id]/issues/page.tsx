import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getRule } from "@webaudit/modules";
import { IssueExplorer, type RuleInfo } from "@/components/audit/issue-explorer";
import { NotFinished } from "@/components/audit/not-finished";
import { Skeleton } from "@/components/ui/feedback";
import { getAuditRow, getReport, isFinished } from "@/lib/audit";
import { issueTypes } from "@/lib/issues";
import { MODULE_META } from "@/lib/modules-meta";

export const metadata = { title: "Issues" };

export default async function IssuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAuditRow(id);
  if (!audit) notFound();
  if (!isFinished(audit)) return <NotFinished id={id} />;
  const issues = issueTypes(getReport(id).groups);
  const rules: Record<string, RuleInfo> = {};
  for (const i of issues) {
    const r = getRule(i.ruleId);
    if (r)
      rules[i.ruleId] = {
        rationale: r.rationale,
        caveat: r.caveat,
        applicability: r.applicability,
        layer: r.layer,
      };
  }
  const modules = MODULE_META.filter((m) => issues.some((i) => i.module === m.id)).map((m) => ({
    id: m.id,
    name: m.name,
  }));
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <IssueExplorer auditId={id} issues={issues} rules={rules} modules={modules} />
    </Suspense>
  );
}
