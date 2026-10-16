"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GitCompareArrows, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/sheet";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "./badges";

export interface HistoryRow {
  id: string;
  host: string;
  url: string;
  mode: string;
  status: string;
  phase: string | null;
  createdAt: string;
  checked: number | null;
  discovered: number | null;
  device: string;
}

export function HistoryTable({ audits, demo }: { audits: HistoryRow[]; demo: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<HistoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(
    () => audits.filter((a) => !q || `${a.host} ${a.url}`.toLowerCase().includes(q.toLowerCase())),
    [audits, q],
  );

  const chosen = audits
    .filter((a) => sel.includes(a.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const done = (a: HistoryRow) => a.phase === "done" && a.status !== "failed";
  const compareReason =
    chosen.length !== 2
      ? "Select two finished audits of the same site"
      : chosen[0]!.host !== chosen[1]!.host
        ? "Audits must be of the same site"
        : !chosen.every(done)
          ? "Both audits must have finished"
          : null;

  const toggle = (id: string, on: boolean) =>
    setSel((s) => (on ? [...s.filter((x) => x !== id), id].slice(-2) : s.filter((x) => x !== id)));

  const remove = async () => {
    if (!confirmDelete) return;
    const r = await fetch(`/api/audits/${confirmDelete.id}`, { method: "DELETE" });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? `Delete failed (${r.status})`);
    setConfirmDelete(null);
    setSel((s) => s.filter((x) => x !== confirmDelete.id));
    router.refresh();
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by site"
            aria-label="Filter audits by site"
            className="h-8 pl-8"
          />
        </div>
        <span className="text-xs text-muted">
          {sel.length ? `${sel.length} selected` : "Select two audits of one site to compare"}
        </span>
        <Button
          className="ml-auto"
          size="sm"
          variant="primary"
          disabled={!!compareReason}
          title={compareReason ?? undefined}
          onClick={() => router.push(`/compare?base=${chosen[0]!.id}&head=${chosen[1]!.id}`)}
        >
          <GitCompareArrows /> Compare
        </Button>
      </div>
      {error && (
        <p role="alert" className="px-4 pt-3 text-xs text-danger">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState
          illustration={audits.length ? "no-results" : "empty-history"}
          title={audits.length ? "No audits match" : "No audits yet"}
        >
          {audits.length ? "Clear the filter." : "Start your first audit from New audit."}
        </EmptyState>
      ) : (
        <Table>
          <caption className="sr-only">Audit history</caption>
          <THead>
            <tr>
              <TH className="w-10">
                <span className="sr-only">Select</span>
              </TH>
              <TH>Site</TH>
              <TH>Started</TH>
              <TH>Mode</TH>
              <TH className="text-right">Checked / discovered</TH>
              <TH>Status</TH>
              {!demo && (
                <TH className="w-10">
                  <span className="sr-only">Actions</span>
                </TH>
              )}
            </tr>
          </THead>
          <tbody>
            {rows.map((a) => (
              <TR key={a.id}>
                <TD>
                  <Checkbox
                    aria-label={`Select audit of ${a.host} from ${formatDate(a.createdAt)}`}
                    checked={sel.includes(a.id)}
                    onCheckedChange={(c) => toggle(a.id, c === true)}
                  />
                </TD>
                <TD>
                  <Link
                    href={`/audits/${a.id}`}
                    className="text-[13px] font-medium text-ink hover:text-accent"
                  >
                    {a.host}
                  </Link>
                  <p className="max-w-xs truncate font-mono text-[11px] text-muted">{a.url}</p>
                </TD>
                <TD className="text-xs text-ink-2">{formatDate(a.createdAt)}</TD>
                <TD className="text-xs capitalize text-ink-2">
                  {a.mode} · {a.device}
                </TD>
                <TD className="tabular text-right text-xs">
                  {a.checked ?? "—"} / {a.discovered ?? "—"}
                </TD>
                <TD>
                  <StatusBadge status={a.status} />
                </TD>
                {!demo && (
                  <TD>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete audit of ${a.host} from ${formatDate(a.createdAt)}`}
                      disabled={a.status === "running" || a.status === "queued"}
                      onClick={() => setConfirmDelete(a)}
                    >
                      <Trash2 />
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </tbody>
        </Table>
      )}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this audit?"
        description="Its findings, evidence and reports are removed from this machine. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(null)}>Keep</Button>
          <Button variant="danger" onClick={remove}>
            <Trash2 /> Delete
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
