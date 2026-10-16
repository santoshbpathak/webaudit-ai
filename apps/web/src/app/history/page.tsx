import { listAudits } from "@webaudit/db";
import { HistoryTable } from "@/components/audit/history-table";
import { PageHeader } from "@/components/shell/page-header";
import { isDemo, services } from "@/lib/server";

export const metadata = { title: "Audits & history" };

export default function HistoryPage() {
  const audits = listAudits(services().db, { limit: 500 }).map((a) => ({
    id: a.id,
    host: a.host,
    url: a.url,
    mode: a.mode,
    status: a.status,
    phase: a.phase,
    createdAt: a.createdAt,
    checked: a.coverage?.checked ?? null,
    discovered: a.coverage?.discovered ?? null,
    device: a.config.device,
  }));
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Audits"
        title="Audits & history"
        description="Every audit stored on this machine. Compare two finished audits of the same site to see new, resolved and persisting issues."
      />
      <HistoryTable audits={audits} demo={isDemo()} />
    </div>
  );
}
