import { notFound } from "next/navigation";
import { Download, FileCode2, FileJson, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { NotFinished } from "@/components/audit/not-finished";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getAuditRow, isFinished } from "@/lib/audit";

export const metadata = { title: "Export" };

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAuditRow(id);
  if (!audit) notFound();
  if (!isFinished(audit)) return <NotFinished id={id} />;
  const r = (q: string) => `/api/audits/${id}/report?${q}`;
  const items = [
    {
      icon: FileText,
      title: "HTML report",
      text: "Self-contained stakeholder report: summary, backlog, evidence, methodology. Works offline; no scripts.",
      href: r("format=html&download=1"),
      open: r("format=html"),
    },
    {
      icon: FileJson,
      title: "JSON",
      text: "Machine-readable export (format version 1): coverage, backlog, rule coverage, findings, pages.",
      href: r("format=json&download=1"),
    },
    {
      icon: FileSpreadsheet,
      title: "Findings CSV",
      text: "One row per failing check with evidence columns. Spreadsheet-formula safe.",
      href: r("format=csv"),
    },
    {
      icon: Table2,
      title: "All outcomes CSV",
      text: "Every rule evaluation including passes, not-tested and inconclusive — for full audit trails.",
      href: r("format=csv&all=1"),
    },
    {
      icon: FileCode2,
      title: "Markdown summary",
      text: "Compact summary for pull requests, tickets and chat.",
      href: r("format=md&download=1"),
    },
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Downloads" description="Generated on demand from the stored findings" />
        <ul>
          {items.map((it) => (
            <li
              key={it.title}
              className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0"
            >
              <it.icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{it.title}</p>
                <p className="mt-0.5 text-xs text-muted">{it.text}</p>
              </div>
              <a
                href={it.href}
                className={buttonVariants({ size: "sm" })}
                aria-label={`Download ${it.title}`}
              >
                <Download />
              </a>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex min-h-[640px] flex-col">
        <CardHeader
          title="Report preview"
          description="Exactly what stakeholders receive"
          action={
            <a
              href={r("format=html")}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Open in new tab
            </a>
          }
        />
        <CardBody className="flex-1 p-0">
          <iframe
            title="HTML report preview"
            src={r("format=html")}
            sandbox="allow-same-origin"
            className="h-full min-h-[600px] w-full rounded-b-lg bg-white"
          />
        </CardBody>
      </Card>
    </div>
  );
}
