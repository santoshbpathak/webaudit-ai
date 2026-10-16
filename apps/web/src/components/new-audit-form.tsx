"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Globe, Loader2, Monitor, Play, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, Select } from "@/components/ui/input";
import { MODULE_META } from "@/lib/modules-meta";
import { cn } from "@/lib/utils";

type Mode = "quick" | "smart" | "deep";

const MODES: { id: Mode; title: string; scope: string; detail: string }[] = [
  {
    id: "quick",
    title: "Quick",
    scope: "1 page",
    detail: "The entered URL only, with every check including Lighthouse.",
  },
  {
    id: "smart",
    title: "Smart",
    scope: "Up to 500 URLs",
    detail: "HTTP checks on every page; browser checks on a stratified sample.",
  },
  {
    id: "deep",
    title: "Deep",
    scope: "Every page to the cap",
    detail: "Browser checks on all discovered pages. Slowest, most thorough.",
  },
];

const lines = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function NewAuditForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("smart");
  const [maxUrls, setMaxUrls] = useState(500);
  const [sampleSize, setSampleSize] = useState(30);
  const [maxDepth, setMaxDepth] = useState(5);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [lighthousePages, setLighthousePages] = useState(5);
  const [modules, setModules] = useState<string[]>(MODULE_META.map((m) => m.id));
  const [delay, setDelay] = useState(250);
  const [concurrency, setConcurrency] = useState(4);
  const [subdomains, setSubdomains] = useState(false);
  const [renderJs, setRenderJs] = useState(false);
  const [sitemapOnly, setSitemapOnly] = useState(false);
  const [deny, setDeny] = useState("");
  const [allow, setAllow] = useState("");
  const [priority, setPriority] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return setError("Enter the website address to audit.");
    if (!modules.length) return setError("Select at least one module.");
    setBusy(true);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          mode,
          device,
          modules,
          lighthouse: lighthousePages > 0 && modules.includes("M02"),
          lighthouseMaxPages: lighthousePages,
          perHostDelayMs: delay,
          httpConcurrency: concurrency,
          includeSubdomains: subdomains,
          renderDiscovery: renderJs,
          sitemapOnly,
          ...(mode !== "quick" ? { maxUrls, maxDepth } : {}),
          ...(mode === "smart" ? { sampleSize } : {}),
          ...(allow.trim() ? { allowPaths: lines(allow) } : {}),
          ...(deny.trim() ? { extraDenyPaths: lines(deny) } : {}),
          priorityPaths: lines(priority),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      router.push(`/audits/${body.audit.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div>
        <Label htmlFor="url" className="mb-2 block text-[13px] text-ink">
          Website URL
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Globe
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              id="url"
              type="url"
              inputMode="url"
              autoComplete="url"
              required
              disabled={demo}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com"
              aria-invalid={!!error}
              aria-describedby={error ? "url-error" : "url-help"}
              className="h-12 pl-10 text-base"
            />
          </div>
          <Button type="submit" variant="primary" size="lg" className="h-12" disabled={busy || demo}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />}
            {busy ? "Starting…" : "Start audit"}
          </Button>
        </div>
        {error ? (
          <p id="url-error" role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        ) : (
          <p id="url-help" className="mt-2 text-xs text-muted">
            {demo
              ? "Scanning is disabled in this read-only demo. Browse the sample audits from the sidebar."
              : "Public pages only. robots.txt is honoured, forms are never submitted and private networks are blocked."}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">Audit depth</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={cn(
                "cursor-pointer rounded-lg border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                mode === m.id
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="mode"
                value={m.id}
                checked={mode === m.id}
                onChange={() => setMode(m.id)}
                className="sr-only"
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">{m.title}</span>
                <span className={cn("text-[11px]", mode === m.id ? "text-ink-2" : "text-muted")}>
                  {m.scope}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{m.detail}</p>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="maxUrls">Page limit</Label>
          <Input
            id="maxUrls"
            type="number"
            min={1}
            max={5000}
            value={mode === "quick" ? 1 : maxUrls}
            disabled={mode === "quick"}
            onChange={(e) => setMaxUrls(Number(e.target.value))}
            className="mt-1.5 tabular"
          />
        </div>
        <div>
          <Label htmlFor="sample">Browser sample</Label>
          <Input
            id="sample"
            type="number"
            min={1}
            max={500}
            value={sampleSize}
            disabled={mode !== "smart"}
            onChange={(e) => setSampleSize(Number(e.target.value))}
            className="mt-1.5 tabular"
          />
        </div>
        <div>
          <Label htmlFor="lh">Lighthouse pages</Label>
          <Input
            id="lh"
            type="number"
            min={0}
            max={100}
            value={lighthousePages}
            onChange={(e) => setLighthousePages(Number(e.target.value))}
            className="mt-1.5 tabular"
          />
        </div>
        <fieldset>
          <legend className="text-xs font-medium text-ink-2">Device</legend>
          <div className="mt-1.5 grid h-9 grid-cols-2 rounded-md border border-line p-0.5">
            {(
              [
                ["mobile", "Mobile", Smartphone],
                ["desktop", "Desktop", Monitor],
              ] as const
            ).map(([v, label, Icon]) => (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-1.5 rounded text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  device === v ? "bg-surface-3 text-ink" : "text-muted hover:text-ink",
                )}
              >
                <input
                  type="radio"
                  name="device"
                  value={v}
                  checked={device === v}
                  onChange={() => setDevice(v)}
                  className="sr-only"
                />
                <Icon className="size-3.5" aria-hidden /> {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <details className="group rounded-lg border border-line bg-surface">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-4 text-[13px] font-medium text-ink">
          Advanced crawler controls
          <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-5 border-t border-line p-4 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="depth">Max depth</Label>
              <Input
                id="depth"
                type="number"
                min={0}
                max={20}
                value={maxDepth}
                disabled={mode === "quick"}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                className="mt-1.5 tabular"
              />
            </div>
            <div>
              <Label htmlFor="delay">Delay (ms)</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                max={30000}
                step={50}
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
                className="mt-1.5 tabular"
              />
            </div>
            <div>
              <Label htmlFor="conc">Concurrency</Label>
              <Select
                id="conc"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="mt-1.5"
              >
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2.5">
            {(
              [
                ["sub", "Include subdomains", subdomains, setSubdomains],
                ["js", "Render JavaScript during discovery (slower)", renderJs, setRenderJs],
                ["sm", "Sitemap URLs only", sitemapOnly, setSitemapOnly],
              ] as const
            ).map(([id, label, value, set]) => (
              <div key={id} className="flex items-center gap-2.5">
                <Checkbox id={`opt-${id}`} checked={value} onCheckedChange={(c) => set(c === true)} />
                <Label htmlFor={`opt-${id}`} className="cursor-pointer text-[13px] font-normal text-ink-2">
                  {label}
                </Label>
              </div>
            ))}
          </div>
          <div>
            <Label htmlFor="allow">Only crawl paths</Label>
            <textarea
              id="allow"
              rows={2}
              value={allow}
              onChange={(e) => setAllow(e.target.value)}
              placeholder="/blog/*, /products/*"
              className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none placeholder:text-muted focus-visible:border-accent"
            />
          </div>
          <div>
            <Label htmlFor="deny">Exclude paths (added to safe defaults)</Label>
            <textarea
              id="deny"
              rows={2}
              value={deny}
              onChange={(e) => setDeny(e.target.value)}
              placeholder="/careers/*, ?print="
              className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none placeholder:text-muted focus-visible:border-accent"
            />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="priority">Business-critical paths (raise priority)</Label>
            <Input
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="/pricing, /checkout*"
              className="mt-1.5 font-mono text-xs"
            />
          </div>
          <fieldset className="lg:col-span-2">
            <legend className="text-xs font-medium text-ink-2">Modules</legend>
            <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-5">
              {MODULE_META.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`mod-${m.id}`}
                    checked={modules.includes(m.id)}
                    onCheckedChange={(c) =>
                      setModules((xs) => (c === true ? [...xs, m.id] : xs.filter((x) => x !== m.id)))
                    }
                  />
                  <Label
                    htmlFor={`mod-${m.id}`}
                    className="cursor-pointer text-[13px] font-normal text-ink-2"
                  >
                    {m.name}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </details>
    </form>
  );
}
