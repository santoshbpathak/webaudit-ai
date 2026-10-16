"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { seg: "", label: "Overview" },
  { seg: "issues", label: "Issues" },
  { seg: "pages", label: "Pages" },
  { seg: "categories", label: "Categories" },
  { seg: "recommendations", label: "Recommendations" },
  { seg: "export", label: "Export" },
];

export function AuditNav({ id, counts }: { id: string; counts?: { issues?: number; pages?: number } }) {
  const pathname = usePathname();
  const base = `/audits/${id}`;
  return (
    <nav aria-label="Audit sections" className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        const count = t.seg === "issues" ? counts?.issues : t.seg === "pages" ? counts?.pages : undefined;
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[13px] transition-colors",
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {count !== undefined && (
              <span className="tabular rounded bg-surface-3 px-1.5 text-[11px] text-ink-2">{count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
