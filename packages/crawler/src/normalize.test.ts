import { describe, expect, it } from "vitest";
import { hammingDistance, jaccardEstimate, minhashSketch, simhash } from "./simhash";
import { globPrefixMatch, inScope, normalizeUrl, pathPattern } from "./normalize";
import { selectSample } from "./cluster";

describe("normalizeUrl", () => {
  it.each([
    ["HTTPS://Example.COM:443/a?b=2&a=1#frag", "https://example.com/a?a=1&b=2"],
    ["http://example.com:80", "http://example.com/"],
    ["https://example.com/p?utm_source=x&gclid=y&id=7", "https://example.com/p?id=7"],
    ["https://example.com/p?", "https://example.com/p"],
    ["/rel/path", "https://example.com/rel/path"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeUrl(raw, "https://example.com/base")).toBe(expected);
  });

  it("preserves materially distinct variants (trailing slash, case in path)", () => {
    expect(normalizeUrl("https://example.com/a/")).not.toBe(normalizeUrl("https://example.com/a"));
    expect(normalizeUrl("https://example.com/A")).not.toBe(normalizeUrl("https://example.com/a"));
  });

  it("rejects non-http links", () => {
    for (const raw of ["mailto:a@b.com", "tel:123", "javascript:void(0)", "data:text/html,x", "ftp://x/"]) {
      expect(normalizeUrl(raw, "https://example.com/")).toBeNull();
    }
  });

  it("strips user-configured params", () => {
    expect(
      normalizeUrl("https://example.com/?sessionid=1&q=a", undefined, { stripParams: ["sessionid"] }),
    ).toBe("https://example.com/?q=a");
  });
});

describe("inScope", () => {
  const opts = { includeSubdomains: false, allowPaths: [], denyPaths: ["/logout", "add-to-cart="] };
  it("treats www and apex as the same site", () => {
    expect(inScope("https://www.example.com/x", "https://example.com/", opts).ok).toBe(true);
  });
  it("excludes subdomains unless enabled", () => {
    expect(inScope("https://blog.example.com/", "https://example.com/", opts)).toEqual({
      ok: false,
      reason: "out_of_scope_host",
    });
    expect(
      inScope("https://blog.example.com/", "https://example.com/", { ...opts, includeSubdomains: true }).ok,
    ).toBe(true);
  });
  it("applies the denylist to path and query", () => {
    expect(inScope("https://example.com/logout", "https://example.com/", opts).ok).toBe(false);
    expect(inScope("https://example.com/shop?add-to-cart=5", "https://example.com/", opts).ok).toBe(false);
  });
});

describe("pathPattern & sampling", () => {
  it("generalizes slugs and numbers", () => {
    expect(pathPattern("https://x.com/blog/first-post")).toBe("/blog/*");
    expect(pathPattern("https://x.com/large/42")).toBe("/large/:n");
    expect(pathPattern("https://x.com/")).toBe("/");
  });

  it("samples start URL, one per cluster, then flagged pages — deterministically", () => {
    const pages = [
      ...Array.from({ length: 50 }, (_, i) => ({
        url: `https://x.com/p/${i}`,
        domSignature: "aaa",
        failures: 0,
        isHtml: true,
      })),
      { url: "https://x.com/", domSignature: "home", failures: 0, isHtml: true },
      { url: "https://x.com/blog/a", domSignature: "bbb", failures: 0, isHtml: true },
      { url: "https://x.com/p/bad", domSignature: "aaa", failures: 5, isHtml: true },
      { url: "https://x.com/file.pdf", failures: 0, isHtml: false },
    ];
    const a = selectSample(pages, "https://x.com/", 5, "smart");
    const b = selectSample([...pages].reverse(), "https://x.com/", 5, "smart");
    expect(a.choices.map((c) => c.url)).toEqual(b.choices.map((c) => c.url));
    expect(a.choices[0]).toMatchObject({ url: "https://x.com/", reason: "start_url" });
    expect(a.choices.some((c) => c.url === "https://x.com/blog/a")).toBe(true);
    expect(a.choices.some((c) => c.url === "https://x.com/p/bad")).toBe(true);
    expect(a.policy).toMatchObject({ selected: 5, eligible: 53 });
  });
});

describe("simhash", () => {
  it("near-duplicates are close, unrelated texts are far", () => {
    const base =
      "Multiply your annual income by ten and add your loans. That is a starting point, not advice.";
    const near = simhash(base + " Updated.");
    const far = simhash(
      "Cashless hospitalisation across eight thousand hospitals with maternity and OPD benefits included.",
    );
    expect(hammingDistance(simhash(base), near)).toBeLessThanOrEqual(10);
    expect(hammingDistance(simhash(base), far)).toBeGreaterThan(15);
  });
});

describe("minhash", () => {
  it("short near-copies score high, distinct pages low", () => {
    const a =
      "How much term cover do you need? Multiply your annual income by ten and add your loans. That is a starting point, not advice.";
    expect(jaccardEstimate(minhashSketch(a), minhashSketch(a + " Updated."))).toBeGreaterThanOrEqual(0.8);
    expect(
      jaccardEstimate(
        minhashSketch(a),
        minhashSketch("Cashless hospitalisation in eight thousand hospitals with maternity cover."),
      ),
    ).toBeLessThan(0.1);
  });
});

describe("globPrefixMatch", () => {
  it("matches like an anchored prefix glob", () => {
    expect(globPrefixMatch("/account/logout?x=1", "/account/*out")).toBe(true);
    expect(globPrefixMatch("/a/b/c", "/a/*")).toBe(true);
    expect(globPrefixMatch("/a", "/a*")).toBe(true);
    expect(globPrefixMatch("/blog/post", "*post")).toBe(true);
    expect(globPrefixMatch("/b/a", "/a*")).toBe(false);
    expect(globPrefixMatch("/ab", "/a*c")).toBe(false);
  });

  it("stays linear on pathological patterns (no ReDoS)", () => {
    const t = performance.now();
    expect(globPrefixMatch("a".repeat(5_000), "*a*a*a*a*a*a*a*a*a*a*a*a*b")).toBe(false);
    expect(performance.now() - t).toBeLessThan(500);
  });
});
