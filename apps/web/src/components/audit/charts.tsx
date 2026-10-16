"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SEVERITIES, SeverityBadge, sevBg, sevLabel } from "./badges";

/**
 * Stacked severity distribution (issue groups by severity). Status colours with
 * icon+label legend (never colour alone), 2px surface gaps, per-segment tooltip.
 */
export function SeverityBar({
  counts,
  unit = "issue groups",
}: {
  counts: Record<string, number>;
  unit?: string;
}) {
  const total = SEVERITIES.reduce((a, s) => a + (counts[s] ?? 0), 0);
  if (!total) return <p className="text-xs text-muted">No failing checks in the tested scope.</p>;
  const present = SEVERITIES.filter((s) => (counts[s] ?? 0) > 0);
  return (
    <div>
      <div
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded"
        role="img"
        aria-label={present.map((s) => `${sevLabel(s)} ${counts[s]}`).join(", ")}
      >
        {present.map((s) => (
          <Tooltip
            key={s}
            content={`${sevLabel(s)}: ${counts[s]} ${unit} (${Math.round(((counts[s] ?? 0) / total) * 100)}%)`}
          >
            <span
              className={cn("block h-full first:rounded-l last:rounded-r", sevBg(s))}
              style={{ width: `${((counts[s] ?? 0) / total) * 100}%`, minWidth: 4 }}
            />
          </Tooltip>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {present.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <SeverityBadge severity={s} />
            <span className="tabular text-xs font-semibold text-ink">{counts[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single-series horizontal bar with value and denominator always printed in ink. */
export function Meter({
  value,
  max,
  label,
  tone = "accent",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "accent" | "muted";
}) {
  const p = max > 0 ? (value / max) * 100 : 0;
  return (
    <Tooltip content={`${label}: ${value} of ${max}`}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
        role="img"
        aria-label={`${label}: ${value} of ${max}`}
      >
        <div
          className={cn("h-full rounded-full", tone === "accent" ? "bg-accent" : "bg-line-strong")}
          style={{ width: `${p}%`, minWidth: value > 0 ? 4 : 0 }}
        />
      </div>
    </Tooltip>
  );
}

export interface FunnelRow {
  label: string;
  value: number;
  hint?: string;
  kind: "stage" | "excluded";
}

/** Coverage funnel: ordinal stages share one hue; exclusions are neutral. */
export function CoverageFunnel({ rows, max }: { rows: FunnelRow[]; max: number }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className={r.kind === "excluded" ? "text-muted" : "text-ink-2"}>
              {r.label}
              {r.hint && <span className="ml-1 text-muted">· {r.hint}</span>}
            </span>
            <span className="tabular font-semibold text-ink">{r.value.toLocaleString()}</span>
          </div>
          <div className="mt-1">
            <Meter
              value={r.value}
              max={Math.max(max, 1)}
              label={r.label}
              tone={r.kind === "stage" ? "accent" : "muted"}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
