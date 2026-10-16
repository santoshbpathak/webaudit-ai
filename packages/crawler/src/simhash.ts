import { createHash } from "node:crypto";

function hash64(s: string): bigint {
  return BigInt("0x" + createHash("md5").update(s).digest("hex").slice(0, 16));
}

/** 64-bit simhash over word 3-shingles. Returned as 16-char hex. */
export function simhash(text: string): string {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const v = new Array<number>(64).fill(0);
  const shingles = words.length < 3 ? [words.join(" ")] : [];
  for (let i = 0; i + 2 < words.length; i++) shingles.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  for (const sh of shingles) {
    const h = hash64(sh);
    for (let b = 0; b < 64; b++) v[b]! += (h >> BigInt(b)) & 1n ? 1 : -1;
  }
  let out = 0n;
  for (let b = 0; b < 64; b++) if (v[b]! > 0) out |= 1n << BigInt(b);
  return out.toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

function shingles(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length < 3) return words.length ? [words.join(" ")] : [];
  const out: string[] = [];
  for (let i = 0; i + 2 < words.length; i++) out.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
}

/**
 * Bottom-k MinHash sketch (k smallest 32-bit shingle hashes). Exact Jaccard for short
 * documents, unbiased estimate for long ones — unlike simhash, reliable on short pages.
 */
export function minhashSketch(text: string, k = 64): number[] {
  const hs = new Set<number>();
  for (const sh of shingles(text))
    hs.add(parseInt(createHash("md5").update(sh).digest("hex").slice(0, 8), 16));
  return [...hs].sort((a, b) => a - b).slice(0, k);
}

export function jaccardEstimate(a: number[], b: number[], k = 64): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  const union = [...new Set([...a, ...b])].sort((x, y) => x - y).slice(0, k);
  let both = 0;
  for (const h of union) if (sa.has(h) && sb.has(h)) both++;
  return both / union.length;
}
