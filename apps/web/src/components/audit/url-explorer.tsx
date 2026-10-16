"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { PageSummary } from "@webaudit/report";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { cn, pathOf } from "@/lib/utils";

type SortKey = "url" | "status" | "depth" | "failures" | "lighthouse";
const STATES = [
  ["", "All"],
  ["checked", "Checked"],
  ["failed", "Failed"],
  ["blocked_robots", "Blocked"],
  ["skipped", "Skipped"],
] as const;
const PAGE_SIZE = 100;

function StateCell({ p }: { p: PageSummary }) {
  const tone =
    p.state === "checked"
      ? p.status && p.status >= 400
        ? "text-danger"
        : p.status && p.status >= 300
          ? "text-warn"
          : "text-ok"
      : p.state === "failed"
        ? "text-danger"
        : "text-muted";
  return (
    <div>
      <span className={cn("text-xs", tone)}>
        {p.state === "blocked_robots" ? "blocked (robots)" : p.state}
      </span>
      {p.reason && (
        <p className="max-w-48 truncate text-[11px] text-muted" title={p.reason}>
          {p.reason}
        </p>
      )}
    </div>
  );
}

export function UrlExplorer({ auditId, pages }: { auditId: string; pages: PageSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const state = sp.get("state") ?? "";
  const q = sp.get("q") ?? "";
  const sort = (sp.get("sort") as SortKey) || "url";
  const dir =
    sp.get("dir") === "desc" || (!sp.get("dir") && (sort === "failures" || sort === "lighthouse"))
      ? "desc"
      : "asc";
  const issuesOnly = sp.get("issues") === "1";
  const sampledOnly = sp.get("sampled") === "1";
  const page = Math.max(1, Number(sp.get("p") ?? 1));
  const [query, setQuery] = useState(q);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("p" in patch)) next.delete("p");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    const t = setTimeout(() => query !== q && setParam({ q: query || null }), 200);
    return () => clearTimeout(t);
  }, [query]); // setParam/q are read fresh on each debounce

  const counts = useMemo(() => {
    const c: Record<string, number> = { "": pages.length };
    for (const p of pages) c[p.state] = (c[p.state] ?? 0) + 1;
    return c;
  }, [pages]);

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    const r = pages.filter(
      (p) =>
        (!state || p.state === state) &&
        (!issuesOnly || p.failures > 0) &&
        (!sampledOnly || p.sampled) &&
        (!needle || `${p.url} ${p.title ?? ""}`.toLowerCase().includes(needle)),
    );
    const val: Record<SortKey, (p: PageSummary) => number | string> = {
      url: (p) => p.url,
      status: (p) => p.status ?? 999,
      depth: (p) => p.depth,
      failures: (p) => p.failures,
      lighthouse: (p) => p.lighthouseScore ?? -1,
    };
    const f = val[sort];
    return r.sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const c = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
      return dir === "asc" ? c : -c;
    });
  }, [pages, q, state, issuesOnly, sampledOnly, sort, dir]);

  const pagesCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pagesCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const header = (key: SortKey, label: string, className?: string) => (
    <TH
      className={className}
      aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-ink"
        onClick={() =>
          setParam({ sort: key, dir: sort === key && dir === "asc" ? "desc" : sort === key ? "asc" : null })
        }
      >
        {label}
        {sort === key && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </TH>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <nav aria-label="URL state" className="inline-flex rounded-md border border-line p-0.5 text-xs">
          {STATES.map(([v, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={state === v}
              onClick={() => setParam({ state: v || null })}
              className={cn(
                "h-7 cursor-pointer rounded px-2.5",
                state === v ? "bg-surface-3 text-ink" : "text-muted hover:text-ink",
              )}
            >
              {label} <span className="tabular text-muted">{counts[v] ?? 0}</span>
            </button>
          ))}
        </nav>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by URL or title"
            aria-label="Filter URLs"
            className="h-8 pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="f-issues"
            checked={issuesOnly}
            onCheckedChange={(c) => setParam({ issues: c === true ? "1" : null })}
          />
          <Label htmlFor="f-issues" className="cursor-pointer font-normal">
            With issues
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="f-sampled"
            checked={sampledOnly}
            onCheckedChange={(c) => setParam({ sampled: c === true ? "1" : null })}
          />
          <Label htmlFor="f-sampled" className="cursor-pointer font-normal">
            Browser-sampled
          </Label>
        </div>
        <span className="tabular ml-auto text-xs text-muted">{rows.length.toLocaleString()} URLs</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState illustration="no-results" title="No URLs match">
          Change the state tab or clear the filters.
        </EmptyState>
      ) : (
        <>
          <Table>
            <caption className="sr-only">Discovered URLs</caption>
            <THead>
              <tr>
                {header("url", "URL")}
                <TH>State</TH>
                {header("status", "HTTP", "text-right")}
                {header("depth", "Depth", "text-right")}
                <TH>Source</TH>
                <TH>Sampled</TH>
                {header("lighthouse", "LH lab", "text-right")}
                {header("failures", "Failing checks", "text-right")}
              </tr>
            </THead>
            <tbody>
              {visible.map((p) => (
                <TR key={p.url}>
                  <TD className="max-w-md">
                    {p.state === "checked" ? (
                      <Link
                        href={`/audits/${auditId}/pages/inspect?url=${encodeURIComponent(p.url)}`}
                        className="block truncate font-mono text-xs text-ink hover:text-accent"
                        title={p.url}
                      >
                        {pathOf(p.url)}
                      </Link>
                    ) : (
                      <span className="block truncate font-mono text-xs text-muted" title={p.url}>
                        {pathOf(p.url)}
                      </span>
                    )}
                    {p.title && <p className="truncate text-[11px] text-muted">{p.title}</p>}
                  </TD>
                  <TD>
                    <StateCell p={p} />
                  </TD>
                  <TD className="tabular text-right text-xs">{p.status ?? "—"}</TD>
                  <TD className="tabular text-right text-xs">{p.depth}</TD>
                  <TD className="text-xs text-ink-2">
                    {p.source}
                    {p.inSitemap && <span className="text-muted"> · sitemap</span>}
                  </TD>
                  <TD className="text-xs text-ink-2">
                    {p.sampled ? "Yes" : <span className="text-muted">—</span>}
                  </TD>
                  <TD className="tabular text-right text-xs">
                    {p.lighthouseScore === undefined || p.lighthouseScore === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      Math.round(p.lighthouseScore * 100)
                    )}
                  </TD>
                  <TD className="tabular text-right text-xs font-medium">
                    {p.failures || <span className="font-normal text-muted">0</span>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          {pagesCount > 1 && (
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted">
              <span className="tabular">
                {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of{" "}
                {rows.length.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={current <= 1}
                  onClick={() => setParam({ p: String(current - 1) })}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={current >= pagesCount}
                  onClick={() => setParam({ p: String(current + 1) })}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
