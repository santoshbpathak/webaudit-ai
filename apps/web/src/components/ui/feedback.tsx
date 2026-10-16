import { AlertTriangle, Inbox } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-3", className)} aria-hidden />;
}

/** Brand illustrations in /public/illustrations (from branding/assets/illustrations). */
export type Illustration =
  | "no-audit"
  | "scanning"
  | "audit-complete"
  | "no-issues"
  | "audit-failed"
  | "ai-disabled"
  | "network-error"
  | "no-results"
  | "empty-history";

export function EmptyState({
  icon: Icon = Inbox,
  illustration,
  title,
  children,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  illustration?: Illustration;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {illustration ? (
        // Decorative: the heading below carries the meaning.
        <img
          src={`/illustrations/${illustration}.svg`}
          alt=""
          width={128}
          height={96}
          className="mb-4 h-24 w-32"
        />
      ) : (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-3 text-muted">
          <Icon className="size-5" />
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-xs text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Callout for partial results, warnings and limitations. */
export function Callout({
  tone = "warn",
  title,
  children,
  className,
}: {
  tone?: "warn" | "danger" | "info";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const cls =
    tone === "danger"
      ? "border-danger/30 bg-danger-soft"
      : tone === "info"
        ? "border-line bg-surface-2"
        : "border-warn/30 bg-warn-soft";
  const ic = tone === "danger" ? "text-danger" : tone === "info" ? "text-muted" : "text-warn";
  return (
    <div
      role={tone === "info" ? "note" : "status"}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-[13px]", cls, className)}
    >
      <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", ic)} aria-hidden />
      <div className="min-w-0 text-ink-2">
        {title && <p className="font-medium text-ink">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function Progress({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
      {children}
    </kbd>
  );
}
