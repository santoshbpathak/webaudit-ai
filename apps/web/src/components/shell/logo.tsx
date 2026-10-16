import { cn } from "@/lib/utils";

/**
 * WebAudit AI symbol — "Inspected Window" (brand v1.0, branding/assets/logos).
 * Ink follows the text colour; the signal diamond uses the accent token, so the mark
 * adapts to light/dark. `small` uses the optical small-size master (≤ 32 px).
 */
export function LogoSymbol({
  size = 24,
  small = size <= 32,
  className,
  title,
}: {
  size?: number;
  small?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0 text-ink", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {small ? (
        <>
          <rect x="6" y="6" width="52" height="18" rx="6" fill="currentColor" />
          <path
            d="M10 36 V50 a4 4 0 0 0 4 4 H22"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M54 36 V50 a4 4 0 0 1 -4 4 H42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M32 28 L43 39 L32 50 L21 39 Z" fill="var(--accent)" />
        </>
      ) : (
        <>
          <path
            d="M9 23 V14 a5 5 0 0 1 5 -5 H50 a5 5 0 0 1 5 5 V23 M9 23 H55"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 39 V50 a5 5 0 0 0 5 5 H21 M55 39 V50 a5 5 0 0 1 -5 5 H43"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M32 30 L40 38 L32 46 L24 38 Z" fill="var(--accent)" />
        </>
      )}
    </svg>
  );
}

/** Lockup with live text in the brand wordmark style: "WebAudit" 600, "AI" 500 muted (AI is optional). */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoSymbol size={size} />
      <span className="whitespace-nowrap text-sm tracking-[-0.02em]">
        <span className="font-semibold text-ink">WebAudit</span>{" "}
        <span className="font-medium text-muted">AI</span>
      </span>
    </span>
  );
}
