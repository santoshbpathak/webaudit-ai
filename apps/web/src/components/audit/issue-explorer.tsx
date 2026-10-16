"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, Loader2, Search, X } from "lucide-react";
import type { Finding } from "@webaudit/core";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Kbd } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { EFFORT_LABEL, type IssueType } from "@/lib/issues-shared";
import { cn } from "@/lib/utils";
import { ConfidenceBadge, SEVERITIES, SeverityBadge, confidenceHint } from "./badges";
import { EvidenceBlock } from "./evidence";

export interface RuleInfo {
  rationale: string;
  caveat?: string;
  applicability: string;
  layer: string;
}

type SortKey = "priority" | "severity" | "pages" | "title";
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const CONFIDENCES = [
  ["verified", "Confirmed"],
  ["heuristic", "Potential"],
  ["manual_review", "Manual review"],
] as const;

export function IssueExplorer({
  auditId,
  issues,
  rules,
  modules,
}: {
  auditId: string;
  issues: IssueType[];
  rules: Record<string, RuleInfo>;
  modules: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  // Filter state lives in the URL so views are shareable and Back works.
  const q = sp.get("q") ?? "";
  const sev = sp.get("severity")?.split(",").filter(Boolean) ?? [];
  const conf = sp.get("confidence") ?? "";
  const mod = sp.get("module") ?? "";
  const view = sp.get("view") === "template" ? "template" : "issue";
  const sort = (sp.get("sort") as SortKey) || "priority";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const [query, setQuery] = useState(q);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<IssueType | null>(null);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    const t = setTimeout(() => query !== q && setParam({ q: query || null }), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    const rows = issues.filter(
      (i) =>
        (!sev.length || sev.includes(i.severity)) &&
        (!conf || i.confidence === conf) &&
        (!mod || i.module === mod) &&
        (!needle ||
          `${i.title} ${i.ruleId} ${i.templates.map((t) => `${t.templateHint} ${t.sampleUrls.join(" ")}`).join(" ")}`
            .toLowerCase()
            .includes(needle)),
    );
    const cmp: Record<SortKey, (a: IssueType, b: IssueType) => number> = {
      priority: (a, b) => a.priority - b.priority,
      severity: (a, b) => SEV_RANK[b.severity]! - SEV_RANK[a.severity]!,
      pages: (a, b) => a.affectedPages - b.affectedPages,
      title: (a, b) => b.title.localeCompare(a.title),
    };
    return rows.sort((a, b) => (dir === "asc" ? 1 : -1) * cmp[sort](a, b) || b.priority - a.priority);
  }, [issues, q, sev, conf, mod, sort, dir]);

  const templateRows = useMemo(
    () =>
      filtered
        .flatMap((i) => i.templates.map((t) => ({ issue: i, t })))
        .sort((a, b) => b.t.priority - a.t.priority),
    [filtered],
  );

  const active = !!(q || sev.length || conf || mod);
  const toggle = (ruleId: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(ruleId)) n.delete(ruleId);
      else n.add(ruleId);
      return n;
    });
  const clearFilters = () => {
    setQuery("");
    setParam({ q: null, severity: null, confidence: null, module: null });
  };
  const sortHeader = (key: SortKey, label: string, className?: string) => (
    <TH
      className={className}
      aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-ink"
        onClick={() =>
          setParam({
            sort: key === "priority" ? null : key,
            dir: sort === key && dir === "desc" ? "asc" : null,
          })
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
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues, rules, URLs…"
            aria-label="Search issues"
            className="pl-8 pr-10"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <Kbd>/</Kbd>
          </span>
        </div>
        <div role="group" aria-label="Severity filter" className="flex flex-wrap gap-1">
          {SEVERITIES.filter((s) => issues.some((i) => i.severity === s)).map((s) => {
            const on = sev.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setParam({ severity: (on ? sev.filter((x) => x !== s) : [...sev, s]).join(",") || null })
                }
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 transition-colors",
                  on ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong",
                )}
              >
                <SeverityBadge severity={s} />
                <span className="tabular text-[11px] text-muted">
                  {issues.filter((i) => i.severity === s).length}
                </span>
              </button>
            );
          })}
        </div>
        <Select
          aria-label="Confidence"
          value={conf}
          onChange={(e) => setParam({ confidence: e.target.value || null })}
          className="h-8 w-auto"
        >
          <option value="">Any confidence</option>
          {CONFIDENCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Category"
          value={mod}
          onChange={(e) => setParam({ module: e.target.value || null })}
          className="h-8 w-auto"
        >
          <option value="">All categories</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        {active && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X /> Clear
          </Button>
        )}
        <div
          role="group"
          aria-label="Group by"
          className="ml-auto inline-flex rounded-md border border-line p-0.5 text-xs"
        >
          {(
            [
              ["issue", `Issue types · ${filtered.length}`],
              ["template", `Templates · ${templateRows.length}`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setParam({ view: v === "issue" ? null : v })}
              className={cn(
                "h-7 cursor-pointer rounded px-2.5",
                view === v ? "bg-surface-3 text-ink" : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          illustration={issues.length ? "no-results" : "no-issues"}
          title={issues.length ? "No issues match these filters" : "No failing checks"}
          action={active ? <Button onClick={clearFilters}>Clear filters</Button> : undefined}
        >
          {issues.length
            ? "Try removing a filter or searching for a rule id."
            : "Nothing failed within the tested scope."}
        </EmptyState>
      ) : view === "issue" ? (
        <Table>
          <caption className="sr-only">Issue types</caption>
          <THead>
            <tr>
              {sortHeader("title", "Issue")}
              {sortHeader("severity", "Severity")}
              <TH>Confidence</TH>
              {sortHeader("pages", "Affected / tested", "text-right")}
              <TH>Where</TH>
              <TH className="text-center">Effort</TH>
              {sortHeader("priority", "Priority", "text-right")}
            </tr>
          </THead>
          <tbody>
            {filtered.map((i) => {
              const multi = i.templates.length > 1;
              const isOpen = open.has(i.ruleId);
              return (
                <Fragment key={i.ruleId}>
                  <TR>
                    <TD className="max-w-md">
                      <div className="flex items-start gap-1.5">
                        {multi ? (
                          <button
                            type="button"
                            aria-label={`${isOpen ? "Collapse" : "Expand"} templates for ${i.title}`}
                            aria-expanded={isOpen}
                            onClick={() => toggle(i.ruleId)}
                            className="mt-0.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-3 hover:text-ink"
                          >
                            <ChevronRight
                              className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
                            />
                          </button>
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelected(i)}
                            className="cursor-pointer text-left font-medium text-ink hover:text-accent"
                          >
                            {i.title}
                          </button>
                          <p className="mt-0.5 font-mono text-[11px] text-muted">{i.ruleId}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <SeverityBadge severity={i.severity} />
                    </TD>
                    <TD>
                      <ConfidenceBadge confidence={i.confidence} />
                    </TD>
                    <TD className="tabular text-right text-ink-2">
                      {i.affectedPages} / {i.testedPages}
                      {!i.enoughEvidence && <p className="text-[10px] text-warn">thin evidence</p>}
                    </TD>
                    <TD className="text-xs text-ink-2">
                      {multi ? (
                        `${i.templates.length} templates`
                      ) : (
                        <code className="font-mono">{i.templates[0]!.templateHint}</code>
                      )}
                    </TD>
                    <TD className="text-center">
                      <span
                        title={`Estimated: ${i.effort.basis}`}
                        className="tabular inline-flex size-6 items-center justify-center rounded bg-surface-3 text-[11px] font-medium text-ink-2"
                      >
                        {EFFORT_LABEL[i.effort.level]}
                      </span>
                    </TD>
                    <TD className="tabular text-right font-medium text-ink">{i.priority}</TD>
                  </TR>
                  {isOpen &&
                    i.templates.map((t) => (
                      <TR key={t.signature} className="bg-surface-2/40 text-xs">
                        <TD className="pl-12" colSpan={3}>
                          <Link
                            href={`/audits/${auditId}/issues/${t.signature}`}
                            className="font-mono text-accent hover:underline"
                          >
                            {t.templateHint}
                          </Link>
                        </TD>
                        <TD className="tabular text-right">
                          {t.affectedPages} / {t.testedPages}
                        </TD>
                        <TD colSpan={2} />
                        <TD className="tabular text-right">{t.priority}</TD>
                      </TR>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Table>
          <caption className="sr-only">Issues by inferred template</caption>
          <THead>
            <tr>
              <TH>Inferred template</TH>
              <TH>Issue</TH>
              <TH>Severity</TH>
              <TH className="text-right">Affected / tested</TH>
              <TH className="text-right">Priority</TH>
            </tr>
          </THead>
          <tbody>
            {templateRows.map(({ issue, t }) => (
              <TR key={t.signature}>
                <TD>
                  <code className="font-mono text-xs text-ink-2">{t.templateHint}</code>
                </TD>
                <TD>
                  <Link
                    href={`/audits/${auditId}/issues/${t.signature}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {issue.title}
                  </Link>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{issue.ruleId}</p>
                </TD>
                <TD>
                  <SeverityBadge severity={t.severity} />
                </TD>
                <TD className="tabular text-right text-ink-2">
                  {t.affectedPages} / {t.testedPages}
                </TD>
                <TD className="tabular text-right font-medium">{t.priority}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <IssueSheet
        auditId={auditId}
        issue={selected}
        rule={selected ? rules[selected.ruleId] : undefined}
        onClose={() => setSelected(null)}
      />
    </Card>
  );
}

function IssueSheet({
  auditId,
  issue,
  rule,
  onClose,
}: {
  auditId: string;
  issue: IssueType | null;
  rule?: RuleInfo;
  onClose: () => void;
}) {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!issue) return;
    setFindings(null);
    setError(null);
    fetch(`/api/audits/${auditId}/findings?rule=${encodeURIComponent(issue.ruleId)}&status=fail&limit=25`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((b) => setFindings(b.findings))
      .catch((e: Error) => setError(e.message));
  }, [auditId, issue]);

  return (
    <Sheet open={!!issue} onOpenChange={(o) => !o && onClose()}>
      {issue && (
        <SheetContent
          title={issue.title}
          description={`${issue.ruleId} · ${issue.affectedPages} affected of ${issue.testedPages} tested pages`}
        >
          <div className="space-y-5 text-[13px]">
            <div className="flex flex-wrap items-center gap-3">
              <SeverityBadge severity={issue.severity} />
              <ConfidenceBadge confidence={issue.confidence} />
              <span className="text-xs text-muted">
                Estimated effort: {issue.effort.level} — {issue.effort.basis}
              </span>
            </div>
            <section>
              <h3 className="text-xs font-semibold text-ink">Why it matters</h3>
              <p className="mt-1 text-ink-2">{rule?.rationale}</p>
            </section>
            <section>
              <h3 className="text-xs font-semibold text-ink">Recommended fix</h3>
              <p className="mt-1 text-ink-2">{issue.recommendedAction}</p>
            </section>
            <section className="rounded-md bg-surface-2 p-3 text-xs text-ink-2">
              <p>
                <span className="font-medium text-ink">Confidence:</span> {confidenceHint(issue.confidence)}
              </p>
              {rule?.caveat && (
                <p className="mt-1.5">
                  <span className="font-medium text-ink">Caveat:</span> {rule.caveat}
                </p>
              )}
              {rule && (
                <p className="mt-1.5">
                  <span className="font-medium text-ink">Applies to:</span> {rule.applicability}
                </p>
              )}
            </section>
            <section>
              <h3 className="text-xs font-semibold text-ink">Templates</h3>
              <ul className="mt-1.5 divide-y divide-line rounded-md border border-line">
                {issue.templates.map((t) => (
                  <li key={t.signature} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <Link
                      href={`/audits/${auditId}/issues/${t.signature}`}
                      className="font-mono text-accent hover:underline"
                    >
                      {t.templateHint}
                    </Link>
                    <span className="tabular text-muted">
                      {t.affectedPages}/{t.testedPages} pages · priority {t.priority}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-ink">Evidence</h3>
                <Link
                  href={`/audits/${auditId}/issues/${issue.templates[0]!.signature}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Open full page <ExternalLink />
                </Link>
              </div>
              <div className="mt-2 space-y-2">
                {error && <p className="text-xs text-danger">Could not load evidence: {error}</p>}
                {!findings && !error && (
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Loader2 className="size-3.5 animate-spin" /> Loading evidence…
                  </p>
                )}
                {findings?.map((f) => (
                  <EvidenceBlock
                    key={f.findingId}
                    f={f}
                    auditId={auditId}
                    groupAction={issue.recommendedAction}
                  />
                ))}
                {findings && findings.length >= 25 && (
                  <p className="text-xs text-muted">
                    Showing the first 25 findings. Export CSV for the complete list.
                  </p>
                )}
              </div>
            </section>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
