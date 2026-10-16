import {
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Eye,
  HelpCircle,
  Info,
  Loader2,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type SeverityKey = (typeof SEVERITIES)[number];

const SEV = {
  critical: { icon: OctagonAlert, cls: "text-sev-critical", bg: "bg-sev-critical", label: "Critical" },
  high: { icon: TriangleAlert, cls: "text-sev-high", bg: "bg-sev-high", label: "High" },
  medium: { icon: CircleAlert, cls: "text-sev-medium", bg: "bg-sev-medium", label: "Medium" },
  low: { icon: Info, cls: "text-sev-low", bg: "bg-sev-low", label: "Low" },
  info: { icon: CircleDot, cls: "text-sev-info", bg: "bg-sev-info", label: "Info" },
} as const;

export const sevBg = (s: string) => SEV[s as SeverityKey]?.bg ?? "bg-sev-info";
export const sevLabel = (s: string) => SEV[s as SeverityKey]?.label ?? s;

/** Severity is never colour alone: icon + label, colour reinforces. */
export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const s = SEV[severity as SeverityKey] ?? SEV.info;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-2", className)}>
      <Icon className={cn("size-3.5 shrink-0", s.cls)} aria-hidden />
      {s.label}
    </span>
  );
}

const CONF = {
  verified: {
    icon: CheckCircle2,
    label: "Confirmed",
    hint: "Directly observed by an automated check.",
    cls: "text-ok",
  },
  heuristic: {
    icon: HelpCircle,
    label: "Potential",
    hint: "Likely issue inferred from signals — verify before acting.",
    cls: "text-warn",
  },
  manual_review: {
    icon: Eye,
    label: "Manual review",
    hint: "Needs human judgement; automation can only flag it.",
    cls: "text-muted",
  },
} as const;

export const confidenceLabel = (c: string) => CONF[c as keyof typeof CONF]?.label ?? c;
export const confidenceHint = (c: string) => CONF[c as keyof typeof CONF]?.hint ?? "";

export function ConfidenceBadge({ confidence, className }: { confidence: string; className?: string }) {
  const c = CONF[confidence as keyof typeof CONF] ?? CONF.manual_review;
  const Icon = c.icon;
  return (
    <span
      title={c.hint}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-2",
        className,
      )}
    >
      <Icon className={cn("size-3", c.cls)} aria-hidden />
      {c.label}
    </span>
  );
}

const STATUS: Record<string, { label: string; cls: string; spin?: boolean }> = {
  queued: { label: "Queued", cls: "bg-surface-3 text-ink-2" },
  running: { label: "Running", cls: "bg-accent-soft text-accent", spin: true },
  cancelling: { label: "Cancelling", cls: "bg-warn-soft text-warn", spin: true },
  completed: { label: "Completed", cls: "bg-ok-soft text-ok" },
  completed_partial: { label: "Partial", cls: "bg-warn-soft text-warn" },
  cancelled_partial: { label: "Cancelled · partial", cls: "bg-warn-soft text-warn" },
  failed: { label: "Failed", cls: "bg-danger-soft text-danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-surface-3 text-ink-2" };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium", s.cls)}
    >
      {s.spin && <Loader2 className="size-3 animate-spin" aria-hidden />}
      {s.label}
    </span>
  );
}

export function ModuleTag({ id }: { id: string }) {
  return <span className="font-mono text-[11px] text-muted">{id}</span>;
}
