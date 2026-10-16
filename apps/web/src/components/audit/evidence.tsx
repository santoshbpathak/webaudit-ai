import Link from "next/link";
import type { Finding } from "@webaudit/core";
import { formatDate } from "@/lib/utils";

/** Reproducible evidence for one finding (AU-02): selector, request, snippet, steps. */
export function EvidenceBlock({
  f,
  auditId,
  showUrl = true,
  groupAction,
}: {
  f: Finding;
  auditId: string;
  showUrl?: boolean;
  groupAction?: string;
}) {
  const e = f.evidence;
  const shot = e.screenshotRef
    ? `/api/audits/${auditId}/artifacts/by-path?path=${encodeURIComponent(e.screenshotRef)}`
    : undefined;
  return (
    <article className="rounded-lg border border-line bg-surface">
      {showUrl && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2">
          <Link
            href={`/audits/${auditId}/pages/inspect?url=${encodeURIComponent(f.url)}`}
            className="min-w-0 break-all font-mono text-xs text-accent hover:underline"
          >
            {f.url}
          </Link>
          <span className="font-mono text-[10px] text-muted">{f.findingId}</span>
        </header>
      )}
      <div className="grid gap-3 p-3.5 md:grid-cols-[minmax(0,1fr)_auto]">
        <dl className="min-w-0 space-y-2 text-xs">
          {e.selector && (
            <div>
              <dt className="text-[11px] text-muted">Selector</dt>
              <dd className="mt-0.5 break-all font-mono text-ink-2">{e.selector}</dd>
            </div>
          )}
          {e.httpStatus !== undefined && (
            <div>
              <dt className="text-[11px] text-muted">HTTP status</dt>
              <dd className="tabular mt-0.5 text-ink-2">{e.httpStatus}</dd>
            </div>
          )}
          {e.requestUrl && (
            <div>
              <dt className="text-[11px] text-muted">Request (redacted)</dt>
              <dd className="mt-0.5 break-all font-mono text-ink-2">{e.requestUrl}</dd>
            </div>
          )}
          {e.snippet && (
            <div>
              <dt className="text-[11px] text-muted">Snippet</dt>
              <dd>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-2 p-2.5 font-mono text-[11px] text-ink-2">
                  {e.snippet}
                </pre>
              </dd>
            </div>
          )}
          {f.recommendedAction && f.recommendedAction !== groupAction && (
            <div>
              <dt className="text-[11px] text-muted">For this page</dt>
              <dd className="mt-0.5 text-ink-2">{f.recommendedAction}</dd>
            </div>
          )}
          {e.reproSteps.length > 0 && (
            <div>
              <dt className="text-[11px] text-muted">Reproduce</dt>
              <dd>
                <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-ink-2 marker:text-muted">
                  {e.reproSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </dd>
            </div>
          )}
          <div className="text-[11px] text-muted">
            Observed {formatDate(f.observedAt)} · {f.engineVersion}
          </div>
        </dl>
        {shot && (
          <img
            src={shot}
            alt={`Above-the-fold screenshot of ${f.url}`}
            loading="lazy"
            width={160}
            height={347}
            className="h-auto w-40 rounded-md border border-line"
          />
        )}
      </div>
    </article>
  );
}
