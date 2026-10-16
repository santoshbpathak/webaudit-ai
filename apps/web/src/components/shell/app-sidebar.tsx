"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, History, Menu, Plus, X } from "lucide-react";
import { StatusBadge } from "@/components/audit/badges";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

interface RecentAudit {
  id: string;
  host: string;
  status: string;
  createdAt: string;
}

const NAV = [
  { href: "/", label: "New audit", icon: Plus, match: (p: string) => p === "/" },
  {
    href: "/history",
    label: "Audits & history",
    icon: History,
    match: (p: string) => p.startsWith("/history") || p.startsWith("/compare"),
  },
];

export function AppSidebar({ recent, demo }: { recent: RecentAudit[]; demo: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const content = (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-4">
        <Link
          href="/"
          aria-label="WebAudit AI — new audit"
          onClick={() => setOpen(false)}
          className="rounded-md"
        >
          <Logo size={24} />
        </Link>
        {demo && (
          <span className="ml-auto rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-warn">
            Demo
          </span>
        )}
      </div>
      <ul className="space-y-0.5 px-2">
        {NAV.map((n) => {
          const active = n.match(pathname);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                  active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <n.icon className="size-4 text-muted" aria-hidden />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 px-4 text-[11px] font-medium uppercase tracking-wide text-muted">
        Recent audits
      </div>
      <ul className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {recent.length === 0 && <li className="px-2.5 py-1.5 text-xs text-muted">None yet</li>}
        {recent.map((a) => {
          const active = pathname.startsWith(`/audits/${a.id}`);
          return (
            <li key={a.id}>
              <Link
                href={`/audits/${a.id}`}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2.5 py-1.5 transition-colors",
                  active ? "bg-surface-3" : "hover:bg-surface-2",
                )}
              >
                <span className="block truncate text-[13px] text-ink">{a.host}</span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">
                    {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <StatusBadge status={a.status} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <a
          href="https://github.com/santoshbpathak/webaudit-ai#readme"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 items-center gap-2 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-ink"
        >
          <BookOpen className="size-4" aria-hidden /> Docs
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );

  return (
    <>
      {/* Small screens: top bar + slide-over navigation */}
      <div className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md hover:bg-surface-2"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" aria-label="WebAudit AI — new audit">
          <Logo size={22} />
        </Link>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-surface-2"
            >
              <X className="size-4" />
            </button>
            {content}
          </div>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">
        {content}
      </aside>
    </>
  );
}
