import { notFound } from "next/navigation";
import { AiPanel } from "@/components/audit/ai-panel";
import { NotFinished } from "@/components/audit/not-finished";
import { RecommendationsTable } from "@/components/audit/recommendations-table";
import { Card } from "@/components/ui/card";
import { getAuditRow, getReport, isFinished } from "@/lib/audit";
import { issueTypes } from "@/lib/issues";

export const metadata = { title: "Recommendations" };

export default async function RecommendationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAuditRow(id);
  if (!audit) notFound();
  if (!isFinished(audit)) return <NotFinished id={id} />;
  const data = getReport(id);
  const issues = issueTypes(data.groups);
  const byEffort = { small: 0, medium: 0, large: 0 };
  for (const i of issues) byEffort[i.effort.level]++;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-3.5">
          <p className="text-[11px] text-muted">Actions in backlog</p>
          <p className="tabular mt-1 text-xl font-semibold">{issues.length}</p>
        </Card>
        {(
          [
            ["small", "Small effort (est.)"],
            ["medium", "Medium effort (est.)"],
            ["large", "Large effort (est.)"],
          ] as const
        ).map(([k, l]) => (
          <Card key={k} className="p-3.5">
            <p className="text-[11px] text-muted">{l}</p>
            <p className="tabular mt-1 text-xl font-semibold">{byEffort[k]}</p>
          </Card>
        ))}
      </div>
      <RecommendationsTable auditId={id} issues={issues} />
      <AiPanel auditId={id} groupIds={data.groups.map((g) => g.signature)} />
    </div>
  );
}
