import { pathPattern } from "./normalize";

export interface ClusterInput {
  url: string;
  domSignature?: string;
  /** Number of failed HTTP-layer rules — flagged pages get sampled first. */
  failures: number;
  isHtml: boolean;
}

/**
 * Inferred template cluster (CR-09): path pattern + DOM skeleton signature.
 * Labelled "inferred" everywhere it is shown.
 */
export function clusterKey(url: string, domSignature?: string): string {
  return `${pathPattern(url)}#${(domSignature ?? "none").slice(0, 6)}`;
}

export interface SampleChoice {
  url: string;
  reason: "start_url" | "template_representative" | "flagged" | "fill" | "deep_all";
  cluster: string;
}

export interface SamplingPolicy {
  mode: "quick" | "smart" | "deep";
  requested: number;
  selected: number;
  eligible: number;
  clusters: number;
  description: string;
}

/**
 * Stratified sample for heavy (browser) checks. Deterministic: same inputs → same sample.
 * 1) the start URL; 2) one representative per template cluster, biggest clusters first;
 * 3) pages with the most HTTP-layer failures; 4) round-robin fill across clusters.
 */
export function selectSample(
  pages: ClusterInput[],
  startUrl: string,
  size: number,
  mode: "quick" | "smart" | "deep",
): { choices: SampleChoice[]; policy: SamplingPolicy } {
  const eligible = pages.filter((p) => p.isHtml).sort((a, b) => a.url.localeCompare(b.url));
  const byCluster = new Map<string, ClusterInput[]>();
  for (const p of eligible) {
    const k = clusterKey(p.url, p.domSignature);
    byCluster.set(k, [...(byCluster.get(k) ?? []), p]);
  }
  const keyOf = (p: ClusterInput) => clusterKey(p.url, p.domSignature);

  if (mode === "deep" || eligible.length <= size) {
    const choices = eligible.slice(0, size).map((p) => ({
      url: p.url,
      reason: (mode === "deep" ? "deep_all" : "fill") as SampleChoice["reason"],
      cluster: keyOf(p),
    }));
    return {
      choices,
      policy: {
        mode,
        requested: size,
        selected: choices.length,
        eligible: eligible.length,
        clusters: byCluster.size,
        description:
          eligible.length <= size
            ? `All ${eligible.length} HTML pages received heavy checks.`
            : `Deep mode: first ${size} of ${eligible.length} HTML pages received heavy checks.`,
      },
    };
  }

  const chosen = new Map<string, SampleChoice>();
  const add = (p: ClusterInput, reason: SampleChoice["reason"]) => {
    if (chosen.size >= size || chosen.has(p.url)) return;
    chosen.set(p.url, { url: p.url, reason, cluster: keyOf(p) });
  };

  const start = eligible.find((p) => p.url === startUrl);
  if (start) add(start, "start_url");

  const clusters = [...byCluster.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  for (const [, members] of clusters) {
    const rep = [...members].sort((a, b) => b.failures - a.failures || a.url.localeCompare(b.url))[0]!;
    add(rep, "template_representative");
  }
  // Flagged pages first, but at most 2 extra per cluster so one noisy template cannot
  // monopolise the browser sample (stratification).
  const flaggedPerCluster = new Map<string, number>();
  for (const p of [...eligible].sort((a, b) => b.failures - a.failures || a.url.localeCompare(b.url))) {
    if (p.failures === 0) break;
    const k = keyOf(p);
    if ((flaggedPerCluster.get(k) ?? 0) >= 2) continue;
    if (!chosen.has(p.url)) flaggedPerCluster.set(k, (flaggedPerCluster.get(k) ?? 0) + 1);
    add(p, "flagged");
  }
  for (let round = 0; chosen.size < size; round++) {
    let progressed = false;
    for (const [, members] of clusters) {
      const p = members[round];
      if (p) {
        progressed = true;
        add(p, "fill");
      }
    }
    if (!progressed) break;
  }

  const choices = [...chosen.values()];
  return {
    choices,
    policy: {
      mode,
      requested: size,
      selected: choices.length,
      eligible: eligible.length,
      clusters: byCluster.size,
      description: `Smart sample: ${choices.length} of ${eligible.length} HTML pages received browser checks (start URL, one page per inferred template cluster [${byCluster.size}], up to 2 pages per cluster with the most HTTP-level issues, then round-robin fill). Browser-based findings apply only to sampled pages.`,
    },
  };
}
