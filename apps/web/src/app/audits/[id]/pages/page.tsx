import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotFinished } from "@/components/audit/not-finished";
import { UrlExplorer } from "@/components/audit/url-explorer";
import { Skeleton } from "@/components/ui/feedback";
import { getAuditRow, getReport, isFinished } from "@/lib/audit";

export const metadata = { title: "Pages" };

export default async function PagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAuditRow(id);
  if (!audit) notFound();
  if (!isFinished(audit)) return <NotFinished id={id} />;
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <UrlExplorer auditId={id} pages={getReport(id).pages} />
    </Suspense>
  );
}
