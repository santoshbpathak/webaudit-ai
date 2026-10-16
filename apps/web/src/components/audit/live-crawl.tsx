"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, Ban, Clock, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Callout, Progress } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDuration } from "@/lib/utils";

interface Coverage {
  discovered: number;
  checked: number;
  sampled: number;
  failed: number;
  skipped: number;
  blockedRobots: number;
  queued: number;
}
interface AuditInfo {
  status: string;
  phase: string | null;
  startedAt: string | null;
  createdAt: string;
  config: { maxUrls: number; mode: string };
}
interface Event {
  id: number;
  at: string;
  level: string;
  phase: string | null;
  message: string;
}

const PHASES = [
  ["preflight", "Preflight"],
  ["discovery", "Discovery"],
  ["sampling", "Sampling"],
  ["browser", "Browser checks"],
  ["lighthouse", "Lighthouse"],
  ["analysis", "Analysis"],
  ["reporting", "Reports"],
] as const;
const TERMINAL = new Set(["completed", "completed_partial", "failed", "cancelled_partial"]);

/** Live view while an audit is queued/running. Polls the existing REST API. */
export function LiveCrawl({ id }: { id: string }) {
  const router = useRouter();
  const [audit, setAudit] = useState<AuditInfo | null>(null);
  const [cov, setCov] = useState<Coverage | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const after = useRef(0);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [a, e] = await Promise.all([
          fetch(`/api/audits/${id}`, { cache: "no-store" }).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
          ),
          fetch(`/api/audits/${id}/events?after=${after.current}`, { cache: "no-store" }).then((r) =>
            r.json(),
          ),
        ]);
        if (!alive) return;
        setPollError(null);
        // Keep server-rendered header/sidebar badges in sync on status transitions.
        if (lastStatus.current && lastStatus.current !== a.audit.status) router.refresh();
        lastStatus.current = a.audit.status;
        setAudit(a.audit);
        setCov(a.coverage);
        if (e.events?.length) {
          after.current = e.events[e.events.length - 1].id;
          setEvents((prev) => [...prev, ...e.events].slice(-500));
        }
        if (TERMINAL.has(a.audit.status) && a.audit.phase === "done") {
          router.refresh();
          return;
        }
      } catch (err) {
        if (alive) setPollError((err as Error).message);
      }
      if (alive) setTimeout(tick, 1500);
    };
    tick();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(clock);
    };
  }, [id, router]);

  const cancel = async () => {
    setCancelling(true);
    setConfirm(false);
    const r = await fetch(`/api/audits/${id}/cancel`, { method: "POST" });
    if (!r.ok) setCancelling(false);
  };

  const status = audit?.status ?? "queued";
  const phaseIdx = PHASES.findIndex(([p]) => p === audit?.phase);
  const elapsed = audit?.startedAt ? now - new Date(audit.startedAt).getTime() : 0;
  const latest = [...events].reverse().find((e) => e.level === "info") ?? events[events.length - 1];
  const problems = events.filter((e) => e.level === "warn" || e.level === "error");
  const cap = audit?.config.maxUrls ?? 0;

  const stats: [string, number | undefined, string?][] = [
    ["Discovered", cov?.discovered],
    ["Checked", cov?.checked, cap ? `limit ${cap}` : undefined],
    ["Browser-sampled", cov?.sampled],
    ["Failed", cov?.failed],
    ["Skipped", cov?.skipped],
    ["Blocked by robots", cov?.blockedRobots],
  ];

  return (
    <div className="space-y-4">
      {pollError && (
        <Callout tone="danger" title="Lost connection to the server">
          Retrying… ({pollError})
        </Callout>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Loader2 className="size-4 animate-spin" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-ink" aria-live="polite">
                {status === "queued"
                  ? "Waiting for a worker"
                  : status === "cancelling" || cancelling
                    ? "Cancelling safely…"
                    : (PHASES[phaseIdx]?.[1] ?? "Starting")}
              </p>
              <p className="max-w-xl truncate text-xs text-muted">{latest?.message ?? "Preparing…"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Clock className="size-3.5" aria-hidden />
            <span className="tabular">{audit?.startedAt ? formatDuration(elapsed) : "not started"}</span>
          </div>
          <div className="ml-auto">
            {status !== "cancelling" && !cancelling && (
              <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
                <Square /> Cancel audit
              </Button>
            )}
          </div>
        </CardBody>
        <div className="border-t border-line px-4 py-3">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Audit phases">
            {PHASES.map(([p, label], i) => {
              const state =
                phaseIdx < 0 ? "todo" : i < phaseIdx ? "done" : i === phaseIdx ? "active" : "todo";
              return (
                <li key={p}>
                  <div
                    className={cn(
                      "h-1 rounded-full",
                      state === "done" ? "bg-accent" : state === "active" ? "bg-accent/50" : "bg-surface-3",
                    )}
                  />
                  <p className={cn("mt-1.5 text-[11px]", state === "todo" ? "text-muted" : "text-ink-2")}>
                    {label}
                    <span className="sr-only">
                      {" "}
                      — {state === "done" ? "done" : state === "active" ? "in progress" : "pending"}
                    </span>
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      {status === "queued" && (
        <Callout tone="info" title="No worker has picked up this audit yet">
          Start one with <code className="font-mono">pnpm webaudit worker</code> — it starts automatically
          with <code className="font-mono">pnpm dev</code> and in Docker.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([label, v, hint]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-3">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="tabular mt-1 text-xl font-semibold text-ink">{v ?? "—"}</p>
            {label === "Checked" && cap > 0 && cov ? (
              <Progress className="mt-2" value={cov.checked} max={cap} label="Checked against page limit" />
            ) : (
              hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>
            )}
          </div>
        ))}
      </div>

      <Card>
        <Tabs defaultValue="activity">
          <CardHeader
            title="Crawl log"
            description="Live events from the audit worker"
            action={
              <TabsList>
                <TabsTrigger value="activity">
                  <Activity className="size-3.5" /> Activity
                </TabsTrigger>
                <TabsTrigger value="errors">
                  <Ban className="size-3.5" /> Errors & warnings{" "}
                  <span className="tabular text-muted">{problems.length}</span>
                </TabsTrigger>
              </TabsList>
            }
          />
          <TabsContent value="activity">
            <EventList events={events} empty="Waiting for events…" />
          </TabsContent>
          <TabsContent value="errors">
            <EventList events={problems} empty="No errors or warnings so far." />
          </TabsContent>
        </Tabs>
      </Card>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Cancel this audit?"
        description="The crawl stops safely and browsers are closed. Findings for pages already checked are kept and the audit is labelled partial."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Keep running</Button>
          <Button variant="danger" onClick={cancel}>
            Cancel audit
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function EventList({ events, empty }: { events: Event[]; empty: string }) {
  if (!events.length) return <p className="px-4 py-6 text-center text-xs text-muted">{empty}</p>;
  return (
    <ol className="max-h-80 overflow-y-auto font-mono text-xs" aria-live="polite">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="flex gap-3 border-b border-line px-4 py-1.5 last:border-0">
          <span className="tabular shrink-0 text-muted">{e.at.slice(11, 19)}</span>
          <span
            className={cn(
              "w-12 shrink-0 uppercase",
              e.level === "error" ? "text-danger" : e.level === "warn" ? "text-warn" : "text-muted",
            )}
          >
            {e.level}
          </span>
          <span className="min-w-0 break-words text-ink-2">{e.message}</span>
        </li>
      ))}
    </ol>
  );
}
