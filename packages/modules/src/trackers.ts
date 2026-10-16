import type { ObservedRequest } from "@webaudit/core";

export type TrackerCategory = "analytics" | "tag_manager" | "advertising" | "session_replay";

export interface TrackerSignature {
  id: string;
  vendor: string;
  category: TrackerCategory;
  /** Library/script loads. */
  library: RegExp[];
  /** Data-collection hits (beacons). */
  hit: RegExp[];
  /** First-party cookie names set by this vendor. */
  cookies?: RegExp;
}

/** Observable signatures of common marketing tags. Extend here; docs are generated from it. */
export const TRACKERS: TrackerSignature[] = [
  {
    id: "gtm",
    vendor: "Google Tag Manager",
    category: "tag_manager",
    library: [/googletagmanager\.com\/gtm\.js/i],
    hit: [],
  },
  {
    id: "ga4",
    vendor: "Google Analytics 4",
    category: "analytics",
    library: [/googletagmanager\.com\/gtag\/js\?id=G-/i],
    hit: [/(google-analytics\.com|analytics\.google\.com)\/g\/collect/i, /\/g\/collect\?.*tid=G-/i],
    cookies: /^_ga(_|$)|^_gid$/,
  },
  {
    id: "ua",
    vendor: "Universal Analytics (legacy)",
    category: "analytics",
    library: [/google-analytics\.com\/analytics\.js/i, /google-analytics\.com\/ga\.js/i],
    hit: [/google-analytics\.com\/(r\/)?collect\?.*tid=UA-/i],
  },
  {
    id: "google_ads",
    vendor: "Google Ads",
    category: "advertising",
    library: [/googletagmanager\.com\/gtag\/js\?id=AW-/i, /googleadservices\.com\/pagead\/conversion\.js/i],
    hit: [
      /googleadservices\.com\/pagead\/conversion/i,
      /googleads\.g\.doubleclick\.net\/pagead/i,
      /google\.com\/pagead\/1p-conversion/i,
    ],
    cookies: /^_gcl_/,
  },
  {
    id: "floodlight",
    vendor: "Google Floodlight / DV360",
    category: "advertising",
    library: [],
    hit: [/fls\.doubleclick\.net/i, /ad\.doubleclick\.net\/activity/i],
  },
  {
    id: "meta",
    vendor: "Meta Pixel",
    category: "advertising",
    library: [/connect\.facebook\.net\/[^/]+\/fbevents\.js/i],
    hit: [/facebook\.com\/tr[/?]/i],
    cookies: /^_fb[pc]$/,
  },
  {
    id: "linkedin",
    vendor: "LinkedIn Insight Tag",
    category: "advertising",
    library: [/snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js/i],
    hit: [/px\.ads\.linkedin\.com/i, /linkedin\.com\/px/i],
    cookies: /^li_/,
  },
  {
    id: "tiktok",
    vendor: "TikTok Pixel",
    category: "advertising",
    library: [/analytics\.tiktok\.com\/i18n\/pixel\/events\.js/i],
    hit: [/analytics\.tiktok\.com\/api\/v2\/pixel/i],
    cookies: /^_ttp$/,
  },
  {
    id: "x",
    vendor: "X (Twitter) Pixel",
    category: "advertising",
    library: [/static\.ads-twitter\.com\/uwt\.js/i],
    hit: [/analytics\.twitter\.com/i, /t\.co\/i\/adsct/i],
  },
  {
    id: "bing",
    vendor: "Microsoft Advertising UET",
    category: "advertising",
    library: [/bat\.bing\.com\/bat\.js/i],
    hit: [/bat\.bing\.com\/action/i],
    cookies: /^_uet/,
  },
  {
    id: "pinterest",
    vendor: "Pinterest Tag",
    category: "advertising",
    library: [/s\.pinimg\.com\/ct\/core\.js/i],
    hit: [/ct\.pinterest\.com/i],
  },
  {
    id: "snap",
    vendor: "Snap Pixel",
    category: "advertising",
    library: [/sc-static\.net\/scevent\.min\.js/i],
    hit: [/tr\.snapchat\.com/i],
  },
  {
    id: "hotjar",
    vendor: "Hotjar",
    category: "session_replay",
    library: [/static\.hotjar\.com/i],
    hit: [/hotjar\.(com|io)\/api/i],
    cookies: /^_hj/,
  },
  {
    id: "clarity",
    vendor: "Microsoft Clarity",
    category: "session_replay",
    library: [/clarity\.ms\/tag/i],
    hit: [/\.clarity\.ms\/collect/i],
    cookies: /^_cl[cs]k$/,
  },
];

export interface TrackerObservation {
  tracker: TrackerSignature;
  libraryLoads: ObservedRequest[];
  hits: ObservedRequest[];
}

export function observeTrackers(requests: ObservedRequest[]): TrackerObservation[] {
  const out: TrackerObservation[] = [];
  for (const t of TRACKERS) {
    const libraryLoads = requests.filter((r) => t.library.some((re) => re.test(r.url)));
    const hits = requests.filter((r) => t.hit.some((re) => re.test(r.url)));
    if (libraryLoads.length || hits.length) out.push({ tracker: t, libraryLoads, hits });
  }
  return out;
}

export function isTrackingCookie(name: string): TrackerSignature | undefined {
  return TRACKERS.find((t) => t.cookies?.test(name));
}

/** Extract IDs like GTM-XXXX, G-XXXX, AW-XXXX from URLs and inline script text. */
export function extractIds(texts: string[], prefix: "GTM" | "G" | "AW" | "UA"): string[] {
  const re =
    prefix === "UA"
      ? /\bUA-\d{4,10}-\d{1,4}\b/g
      : new RegExp(`\\b${prefix}-[A-Z0-9]{${prefix === "GTM" ? "4,10" : "6,12"}}\\b`, "g");
  const ids = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(re)) ids.add(m[0]);
  return [...ids].sort();
}

/**
 * Google Consent Mode "denied" pings (gcs=G100) are cookieless by design and should not
 * be reported as tracking before consent.
 */
export function isConsentModeDeniedPing(url: string): boolean {
  const m = /[?&]gcs=G1([01])([01])/.exec(url);
  return !!m && m[1] === "0" && m[2] === "0";
}
