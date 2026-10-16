import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listFindings, listGroups } from "@webaudit/db";
import { getRule } from "@webaudit/modules";
import { estimateEffort } from "@webaudit/scoring";
import { ConfidenceBadge, SeverityBadge, confidenceHint } from "@/components/audit/badges";
import { EvidenceBlock } from "@/components/audit/evidence";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { getAuditRow } from "@/lib/audit";
import { moduleById } from "@/lib/modules-meta";
import { services } from "@/lib/server";

export const metadata = { title: "Issue detail" };

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await params;
  const { db } = services();
  const audit = getAuditRow(id);
  const group = listGroups(db, id).find((g) => g.signature === sig);
  if (!audit || !group) notFound();
  const rule = getRule(group.ruleId);
  const findings = listFindings(db, id, { groupSignature: sig, status: ["fail"], limit: 100 });
  const effort = estimateEffort(group.ruleId, group.affectedPages, 1);
  const pc = group.priorityComponents;
  const mod = moduleById(group.module);

  return (
    <div className="space-y-5">
      <Link
        href={`/audits/${id}/issues`}
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> All issues
      </Link>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{group.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <SeverityBadge severity={group.severity} />
          <ConfidenceBadge confidence={group.confidence} />
          <span className="font-mono text-muted">{group.ruleId}</span>
          {mod && <span className="text-muted">{mod.name}</span>}
          <span className="text-ink-2">
            {group.affectedPages} affected of {group.testedPages} tested in{" "}
            <code className="font-mono">{group.templateHint}</code>{" "}
            <span className="text-muted">(inferred template)</span>
          </span>
        </div>
      </div>
      {!group.enoughEvidence && (
        <Callout title="Thin evidence">
          Too few pages were tested for this rule to judge how widespread it is. Increase the browser sample
          or use Deep mode.
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardBody className="space-y-4 text-[13px]">
            <section>
              <h3 className="text-xs font-semibold text-ink">Why it matters</h3>
              <p className="mt-1 text-ink-2">{rule?.rationale}</p>
            </section>
            <section>
              <h3 className="text-xs font-semibold text-ink">Recommended fix</h3>
              <p className="mt-1 text-ink-2">{group.recommendedAction}</p>
            </section>
            <section className="rounded-md bg-surface-2 p-3 text-xs text-ink-2">
              <p>
                <span className="font-medium text-ink">Confidence:</span> {confidenceHint(group.confidence)}
              </p>
              {rule?.caveat && (
                <p className="mt-1.5">
                  <span className="font-medium text-ink">Caveat:</span> {rule.caveat}
                </p>
              )}
            </section>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Priority" description="How this group is ranked" />
          <CardBody>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-xs">
              <dt className="text-muted">Severity weight</dt>
              <dd className="tabular text-right">{pc.severityWeight}</dd>
              <dt className="text-muted">Reach (log pages)</dt>
              <dd className="tabular text-right">× {pc.pageFactor}</dd>
              <dt className="text-muted">Confidence</dt>
              <dd className="tabular text-right">× {pc.confidenceFactor}</dd>
              <dt className="text-muted">Importance</dt>
              <dd className="tabular text-right">× {pc.importanceFactor}</dd>
              <dt className="border-t border-line pt-1.5 font-medium text-ink">Priority index</dt>
              <dd className="tabular border-t border-line pt-1.5 text-right font-semibold">
                {group.priority}
              </dd>
            </dl>
            <p className="mt-4 text-xs text-ink-2">
              <span className="font-medium text-ink">Estimated effort:</span> {effort.level} — {effort.basis}.
            </p>
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="ev-h">
        <h3 id="ev-h" className="mb-2 text-[13px] font-semibold text-ink">
          Evidence <span className="tabular font-normal text-muted">({findings.length})</span>
        </h3>
        <div className="space-y-2">
          {findings.map((f) => (
            <EvidenceBlock key={f.findingId} f={f} auditId={id} groupAction={group.recommendedAction} />
          ))}
        </div>
      </section>
    </div>
  );
}
