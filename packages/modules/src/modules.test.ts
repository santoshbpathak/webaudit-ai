import { describe, expect, it } from "vitest";
import type { AuditModule, BrowserSnapshot, PageContext } from "@webaudit/core";
import { parseHtml } from "@webaudit/crawler";
import { ALL_MODULES, evaluatePage, evaluateSite, getRule } from "./registry";
import { isConsentModeDeniedPing } from "./trackers";

const URL0 = "https://shop.example.com/product";

function page(html: string, over: Partial<PageContext> = {}): PageContext {
  return {
    auditId: "aud_test",
    url: URL0,
    http: {
      url: URL0,
      finalUrl: URL0,
      status: 200,
      headers: {},
      contentType: "text/html",
      redirectChain: [],
      bytes: html.length,
      truncated: false,
      fetchedAt: new Date().toISOString(),
      elapsedMs: 10,
      html,
    },
    parsed: parseHtml(html, URL0),
    inSitemap: true,
    ...over,
  };
}

function browser(over: Partial<BrowserSnapshot> = {}): BrowserSnapshot {
  return {
    finalUrl: URL0,
    title: "",
    renderedHtml: "",
    requests: [],
    cookies: [],
    dataLayer: [],
    forms: [],
    ctas: [{ text: "Buy now", selector: "a.cta", aboveFold: true, width: 120, height: 44 }],
    viewport: { width: 390, height: 844 },
    documentWidth: 390,
    smallTapTargets: [],
    brokenImages: [],
    scripts: [],
    consent: {
      bannerDetected: false,
      preCheckedOptions: [],
      cookiesBeforeConsent: [],
      storageKeysBeforeConsent: [],
    },
    stepErrors: {},
    ...over,
  };
}

const GOOD = `<!doctype html><html lang="en"><head><title>Blue running shoes for trail runners</title>
<meta name="description" content="Lightweight trail running shoes with grippy soles, free returns and next-day delivery.">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="${URL0}"></head>
<body><main><h1>Trail shoes</h1><p>${"Great shoes for muddy trails. ".repeat(40)}</p></main></body></html>`;

const run = (ctx: PageContext, mods: AuditModule[] = ALL_MODULES) =>
  evaluatePage(ctx, mods, { auditId: "aud_test" });
const status = (fs: Awaited<ReturnType<typeof run>>, ruleId: string) =>
  fs.find((f) => f.ruleId === ruleId)?.status;

describe("M01 technical SEO", () => {
  it("T01: missing meta description → finding with URL, rule and DOM evidence", async () => {
    const fs = await run(page(GOOD.replace(/<meta name="description"[^>]+>/, "")));
    const f = fs.find((x) => x.ruleId === "M01-META-DESC-MISSING")!;
    expect(f).toMatchObject({ status: "fail", url: URL0, module: "M01", confidence: "verified" });
    expect(f.evidence.selector).toBe('head > meta[name="description"]');
    expect(f.evidence.reproSteps.length).toBeGreaterThan(0);
    expect(f.recommendedAction).toMatch(/meta name="description"/);
  });

  it("passes a clean page", async () => {
    const fs = await run(page(GOOD));
    const fails = fs.filter((f) => f.status === "fail" && f.module === "M01");
    expect(fails.map((f) => f.ruleId)).toEqual([]);
  });

  it("fills remediation templates from evidence", async () => {
    const fs = await run(
      page(
        GOOD.replace(
          /<link rel="canonical"[^>]+>/,
          '<link rel="canonical" href="https://staging.other.com/x">',
        ),
      ),
    );
    const f = fs.find((x) => x.ruleId === "M01-CANONICAL-CROSS-HOST")!;
    expect(f.status).toBe("fail");
    expect(f.recommendedAction).toContain("https://staging.other.com/x");
  });

  it("marks sitemap-dependent rules not_tested when sitemaps were not loaded", async () => {
    const fs = await run(page(GOOD, { inSitemap: undefined }));
    expect(status(fs, "M01-NOINDEX-IN-SITEMAP")).toBe("not_tested");
  });

  it("treats non-HTML responses as not applicable", async () => {
    const ctx = page("");
    ctx.http.contentType = "application/pdf";
    ctx.parsed = undefined;
    const fs = await run(
      ctx,
      ALL_MODULES.filter((m) => m.id === "M01"),
    );
    expect(status(fs, "M01-TITLE-MISSING")).toBe("not_applicable");
    expect(status(fs, "M01-HTTP-ERROR")).toBe("pass");
  });
});

describe("browser-layer rules", () => {
  it("T07: pages outside the browser sample get not_tested, never pass/fail", async () => {
    const fs = await run(page(GOOD));
    const browserRules = fs.filter((f) => getRule(f.ruleId)?.layer === "browser");
    expect(browserRules.length).toBeGreaterThan(10);
    expect(new Set(browserRules.map((f) => f.status))).toEqual(new Set(["not_tested"]));
  });

  it("T09: GA4 absent → 'not observed in tested flow' heuristic, not a site-wide claim", async () => {
    const fs = await run(page(GOOD, { browser: browser() }));
    const f = fs.find((x) => x.ruleId === "M04-GA4-NOT-OBSERVED")!;
    expect(f.status).toBe("fail");
    expect(f.confidence).toBe("heuristic");
    expect(getRule(f.ruleId)!.caveat).toMatch(/Not observed in the tested page load/);
  });

  it("detects duplicate GA4 page_view hits", async () => {
    const hit = {
      url: "https://www.google-analytics.com/g/collect?v=2&tid=G-ABC1234&en=page_view",
      method: "POST",
      resourceType: "ping",
      beforeConsent: true,
    };
    const fs = await run(page(GOOD, { browser: browser({ requests: [hit, { ...hit }] }) }));
    expect(status(fs, "M04-GA4-DUPLICATE-PAGEVIEW")).toBe("fail");
    expect(status(fs, "M04-GA4-NOT-OBSERVED")).toBe("pass");
  });

  it("M08: Consent Mode denied pings are not counted as tracking before consent", async () => {
    const denied = "https://www.google-analytics.com/g/collect?v=2&tid=G-ABC1234&gcs=G100&en=page_view";
    expect(isConsentModeDeniedPing(denied)).toBe(true);
    const consent = {
      bannerDetected: true,
      cmp: "OneTrust",
      acceptSelector: "#accept",
      rejectSelector: "#reject",
      preCheckedOptions: [],
      cookiesBeforeConsent: [],
      storageKeysBeforeConsent: [],
    };
    const fs = await run(
      page(GOOD, {
        browser: browser({
          consent,
          requests: [{ url: denied, method: "POST", resourceType: "ping", beforeConsent: true }],
        }),
      }),
    );
    expect(status(fs, "M08-TRACKING-BEFORE-CONSENT")).toBe("pass");
    const granted = denied.replace("gcs=G100", "gcs=G111");
    const fs2 = await run(
      page(GOOD, {
        browser: browser({
          consent,
          requests: [{ url: granted, method: "POST", resourceType: "ping", beforeConsent: true }],
        }),
      }),
    );
    expect(status(fs2, "M08-TRACKING-BEFORE-CONSENT")).toBe("fail");
  });

  it("M06: flags pre-checked marketing opt-ins and placeholder-only fields", async () => {
    const forms = [
      {
        selector: "form#lead",
        method: "post",
        hasNoValidate: false,
        fields: [
          {
            tag: "input",
            type: "text",
            name: "email",
            hasLabel: false,
            required: true,
            hidden: false,
            selector: "#e",
          },
          {
            tag: "input",
            type: "checkbox",
            name: "newsletter_optin",
            hasLabel: true,
            labelText: "Send me offers",
            required: false,
            checkedByDefault: true,
            hidden: false,
            selector: "#n",
          },
        ],
      },
    ];
    const fs = await run(page(GOOD, { browser: browser({ forms }) }));
    expect(status(fs, "M06-PRECHECKED-OPTIN")).toBe("fail");
    expect(status(fs, "M06-FIELD-NO-LABEL")).toBe("fail");
    expect(status(fs, "M06-EMAIL-TYPE")).toBe("fail");
  });
});

describe("engine robustness", () => {
  it("a module that throws yields inconclusive for its rules, others still run", async () => {
    const broken: AuditModule = {
      ...ALL_MODULES[0]!,
      runPage: () => {
        throw new Error("boom");
      },
    };
    const fs = await run(page(GOOD), [broken, ALL_MODULES.find((m) => m.id === "M09")!]);
    expect(
      fs
        .filter((f) => f.module === "M01")
        .every((f) => f.status === "inconclusive" && /boom/.test(f.reason ?? "")),
    ).toBe(true);
    expect(fs.some((f) => f.module === "M09" && f.status === "pass")).toBe(true);
  });

  it("disabled rules produce no findings (AU-05)", async () => {
    const fs = await evaluatePage(page(GOOD), ALL_MODULES, {
      auditId: "a",
      disabledRules: ["M01-TITLE-LENGTH"],
    });
    expect(fs.some((f) => f.ruleId === "M01-TITLE-LENGTH")).toBe(false);
  });

  it("site rules: duplicate titles and orphans", async () => {
    const a = page(GOOD);
    const b = page(GOOD.replace("Trail shoes", "Road shoes"), { url: "https://shop.example.com/other" });
    b.http.url = b.url;
    b.http.finalUrl = b.url;
    const fs = await evaluateSite(
      {
        auditId: "a",
        startUrl: "https://shop.example.com/",
        pages: [a, b],
        sitemapUrls: new Set([a.url, b.url]),
        links: [{ from: a.url, to: b.url }],
        statusByUrl: new Map([
          [a.url, 200],
          [b.url, 200],
        ]),
      },
      ALL_MODULES,
      { auditId: "a" },
    );
    expect(fs.filter((f) => f.ruleId === "M01-TITLE-DUPLICATE" && f.status === "fail")).toHaveLength(2);
    expect(fs.find((f) => f.ruleId === "M10-ORPHAN-SITEMAP" && f.url === a.url)?.status).toBe("fail");
    expect(fs.find((f) => f.ruleId === "M10-ORPHAN-SITEMAP" && f.url === b.url)?.status).toBe("pass");
  });

  it("every rule has rationale, remediation and applicability", () => {
    for (const m of ALL_MODULES)
      for (const r of m.rules) {
        expect(r.rationale.length, r.id).toBeGreaterThan(20);
        expect(r.remediation.length, r.id).toBeGreaterThan(10);
        expect(r.id.startsWith(m.id), r.id).toBe(true);
      }
  });
});
