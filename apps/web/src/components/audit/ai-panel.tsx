"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

type Task = "executive_summary" | "roadmap" | "qa";
interface Status {
  enabled: boolean;
  provider?: string;
  model?: string;
  destination?: string;
  reason?: string;
}
interface Preview {
  destination: string;
  model: string;
  approxChars: number;
  system: string;
  user: string;
}
interface Analysis {
  id: string;
  task: Task;
  model: string;
  question: string | null;
  output: unknown;
  citedFindingIds: string[] | null;
  invalidCitations: string[] | null;
  status: "ok" | "error";
  error: string | null;
  createdAt: string;
}
interface Cited {
  text: string;
  cited_ids: string[];
}

const LABEL: Record<Task, string> = {
  executive_summary: "Executive summary",
  roadmap: "30-day roadmap",
  qa: "Answer",
};

/** Optional AI suggestions. Nothing is sent until the user reviews the exact request. */
export function AiPanel({ auditId, groupIds }: { auditId: string; groupIds: string[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [question, setQuestion] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, reason: "Could not load AI status." }));
    fetch(`/api/audits/${auditId}/ai`)
      .then((r) => r.json())
      .then((b) => setAnalyses(b.analyses ?? []))
      .catch(() => undefined);
  }, [auditId]);

  const post = async (path: string, body: object) => {
    const r = await fetch(`/api/audits/${auditId}/ai/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok && !j.analysis) throw new Error(j.error ?? `Request failed (${r.status})`);
    return j;
  };

  const startPreview = async (t: Task) => {
    setError(null);
    setTask(t);
    setPreview(null);
    if (t === "qa" && !question.trim()) return;
    setBusy(true);
    try {
      setPreview(await post("preview", { task: t, question }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!task) return;
    setBusy(true);
    setError(null);
    try {
      const j = await post("analyze", { task, question, confirm: true });
      setAnalyses((a) => [j.analysis, ...a]);
      setPreview(null);
      setTask(null);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden /> AI suggestions{" "}
            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-muted">
              optional
            </span>
          </span>
        }
        description="Generated from a restricted, redacted subset of findings. Suggestions never change a finding, severity or priority."
      />
      <CardBody className="space-y-4">
        {!status ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking AI configuration…
          </p>
        ) : !status.enabled ? (
          <div className="flex items-start gap-4 rounded-md bg-surface-2 p-3 text-xs text-ink-2">
            <img
              src="/illustrations/ai-disabled.svg"
              alt=""
              width={64}
              height={48}
              className="hidden h-12 w-16 shrink-0 sm:block"
            />
            <div>
              <p>{status.reason}</p>
              <p className="mt-1.5 text-muted">
                Claude: <code className="font-mono">WEBAUDIT_AI_PROVIDER=anthropic</code> +{" "}
                <code className="font-mono">ANTHROPIC_API_KEY</code>. Local and free:{" "}
                <code className="font-mono">
                  WEBAUDIT_AI_PROVIDER=openai OPENAI_BASE_URL=http://localhost:11434/v1
                  WEBAUDIT_OPENAI_MODEL=llama3.1
                </code>
                .
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted">
              Provider: {status.provider} · <span className="font-mono">{status.model}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => startPreview("executive_summary")}>
                <Sparkles /> Executive summary
              </Button>
              <Button disabled={busy} onClick={() => startPreview("roadmap")}>
                <Sparkles /> 30-day roadmap
              </Button>
            </div>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                startPreview("qa");
              }}
            >
              <label htmlFor="ai-q" className="sr-only">
                Question about this audit
              </label>
              <Input
                id="ai-q"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={500}
                placeholder="Ask about this audit, e.g. Why might lead-form conversion be low?"
              />
              <Button type="submit" disabled={busy || !question.trim()}>
                Ask
              </Button>
            </form>
          </>
        )}

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}

        {preview && task && (
          <div
            role="region"
            aria-label="Transmission preview"
            className="rounded-lg border border-warn/30 bg-warn-soft p-4 text-[13px]"
          >
            <p className="font-medium text-ink">Send audit data to {preview.destination}?</p>
            <p className="mt-1 text-xs text-ink-2">
              Model <span className="font-mono">{preview.model}</span> · about{" "}
              {Math.round(preview.approxChars / 1000)}k characters: rule ids, URLs, severities and redacted
              evidence excerpts (short HTML snippets with input values removed). No cookies or full pages.
            </p>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-ink-2">View the exact request</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-surface p-2.5 font-mono text-[11px] text-ink-2">{`SYSTEM:\n${preview.system}\n\nUSER:\n${preview.user}`}</pre>
            </details>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={send} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />} Send
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  setTask(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {analyses.map((a) => (
          <AnalysisCard key={a.id} a={a} auditId={auditId} groupIds={groupIds} />
        ))}
      </CardBody>
    </Card>
  );
}

function Cite({
  id,
  auditId,
  groupIds,
  invalid,
}: {
  id: string;
  auditId: string;
  groupIds: string[];
  invalid: Set<string>;
}) {
  if (invalid.has(id))
    return (
      <span
        className="rounded bg-danger-soft px-1 font-mono text-[10px] text-danger"
        title="Not present in the audit data — unsupported"
      >
        {id} ✕
      </span>
    );
  if (groupIds.includes(id))
    return (
      <Link
        href={`/audits/${auditId}/issues/${id}`}
        className="rounded bg-accent-soft px-1 font-mono text-[10px] text-accent hover:underline"
      >
        {id.slice(0, 8)}
      </Link>
    );
  return (
    <span className="rounded bg-surface-3 px-1 font-mono text-[10px] text-ink-2">{id.slice(0, 12)}</span>
  );
}

function AnalysisCard({ a, auditId, groupIds }: { a: Analysis; auditId: string; groupIds: string[] }) {
  const invalid = new Set(a.invalidCitations ?? []);
  const cites = (ids: string[]) => (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {ids.map((id) => (
        <Cite key={id} id={id} auditId={auditId} groupIds={groupIds} invalid={invalid} />
      ))}
    </span>
  );
  const o = a.output as Record<string, unknown> | null;
  return (
    <article className="rounded-lg border border-line border-l-2 border-l-accent bg-surface-2/40 p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
          <Sparkles className="size-3" aria-hidden /> AI suggestion
        </span>
        <span className="font-medium text-ink">{LABEL[a.task]}</span>
        <span className="text-muted">
          {a.model} · {formatDate(a.createdAt)}
        </span>
      </header>
      {a.status === "error" ? (
        <p className="text-xs text-danger">{a.error}</p>
      ) : (
        <div className="space-y-2 text-[13px] text-ink-2">
          {invalid.size > 0 && (
            <Callout tone="danger">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="size-3.5" aria-hidden /> {invalid.size} citation(s) did not match
                the audit data — treat those statements as unsupported.
              </span>
            </Callout>
          )}
          {a.question && <p className="text-xs text-muted">Q: {a.question}</p>}
          {a.task === "executive_summary" && o && (
            <>
              <p className="font-medium text-ink">{String(o.headline)}</p>
              {(o.paragraphs as Cited[]).map((p, i) => (
                <p key={i}>
                  {p.text}
                  {cites(p.cited_ids)}
                </p>
              ))}
              {(o.business_risks as Cited[]).length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {(o.business_risks as Cited[]).map((r, i) => (
                    <li key={i}>
                      {r.text}
                      {cites(r.cited_ids)}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {a.task === "roadmap" && o && (
            <ol className="space-y-3">
              {(
                o.weeks as {
                  week: number;
                  theme: string;
                  items: { action: string; owner: string; rationale: string; cited_ids: string[] }[];
                }[]
              ).map((w) => (
                <li key={w.week}>
                  <p className="font-medium text-ink">
                    Week {w.week}: {w.theme}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {w.items.map((it, i) => (
                      <li key={i}>
                        <span className="font-medium text-ink">{it.action}</span>{" "}
                        <span className="text-muted">({it.owner})</span> — {it.rationale}
                        {cites(it.cited_ids)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          {a.task === "qa" && o && (
            <p className={cn(o.insufficient_evidence ? "text-warn" : "")}>
              {String(o.answer)}
              {cites(o.cited_ids as string[])}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
