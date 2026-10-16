import { CheckCircle2, Eye, HelpCircle, Lock, Radar, ScanLine, Sparkles } from "lucide-react";
import { aiStatus } from "@webaudit/ai";
import { NewAuditForm } from "@/components/new-audit-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { isDemo } from "@/lib/server";

export const metadata = { title: "New audit" };

const STEPS = [
  {
    icon: Radar,
    title: "Discover",
    text: "robots.txt, sitemaps and internal links — every URL recorded with its source and outcome.",
  },
  {
    icon: ScanLine,
    title: "Inspect",
    text: "HTTP checks on every page; a real browser on a stratified sample for tags, consent, forms, axe and Lighthouse.",
  },
  {
    icon: CheckCircle2,
    title: "Prioritise",
    text: "Findings grouped by template, ranked by severity, reach and confidence, with reproducible evidence.",
  },
];

export default function NewAuditPage() {
  const demo = isDemo();
  const ai = demo ? { enabled: false } : aiStatus();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <PageHeader
        eyebrow="New audit"
        title="Audit a website"
        description="Technical SEO, performance, accessibility, analytics, ad pixels, lead forms, UX and consent signals — consolidated into an evidence-backed, prioritised backlog. Runs locally; no API keys required."
      />
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardBody className="p-5 sm:p-6">
            <NewAuditForm demo={demo} />
          </CardBody>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="How an audit works" />
            <CardBody>
              <ol className="space-y-4">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-3 text-muted">
                      <s.icon className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-ink">
                        {i + 1}. {s.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Finding confidence" />
            <CardBody className="space-y-2.5 text-xs text-ink-2">
              <p className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />
                <span>
                  <b className="font-medium text-ink">Confirmed</b> — directly observed by a check.
                </span>
              </p>
              <p className="flex gap-2">
                <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                <span>
                  <b className="font-medium text-ink">Potential</b> — inferred from signals; verify first.
                </span>
              </p>
              <p className="flex gap-2">
                <Eye className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
                <span>
                  <b className="font-medium text-ink">Manual review</b> — needs human judgement.
                </span>
              </p>
            </CardBody>
          </Card>
          <div className="space-y-2 px-1 text-xs text-muted">
            <p className="flex gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Results stay on this machine.
            </p>
            <p className="flex gap-2">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {ai.enabled
                ? "Optional AI suggestions are configured — nothing is sent without your confirmation."
                : "AI is off. Every check and report works without it."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
