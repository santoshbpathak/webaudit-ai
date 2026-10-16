import robotsParser from "robots-parser";
import { describeFetchError, safeFetch, type SafeFetchOptions } from "@webaudit/safety";

export interface RobotsPolicy {
  url: string;
  /** HTTP status of robots.txt, or "error". */
  status: number | "error";
  /** How the file was interpreted, for the report. */
  interpretation: "rules" | "allow_all_missing" | "disallow_all_server_error" | "allow_all_fetch_error";
  sitemaps: string[];
  crawlDelaySec?: number;
  isAllowed(url: string): boolean;
  /** Matching robots.txt line number for evidence, or -1. */
  matchingLine(url: string): number;
}

/**
 * RFC 9309 handling: 4xx = no restrictions; 5xx = treat as complete disallow;
 * network failure = allow but record it, so coverage notes the uncertainty.
 */
export async function loadRobots(
  origin: string,
  userAgent: string,
  fetchOpts: Omit<SafeFetchOptions, "maxBytes" | "accept">,
): Promise<RobotsPolicy> {
  const url = new URL("/robots.txt", origin).toString();
  const token = userAgent.split("/")[0] ?? "WebAuditAI";
  try {
    const res = await safeFetch(url, { ...fetchOpts, maxBytes: 512_000, accept: "text/plain,*/*" });
    if (res.status >= 500) {
      return {
        url,
        status: res.status,
        interpretation: "disallow_all_server_error",
        sitemaps: [],
        isAllowed: () => false,
        matchingLine: () => -1,
      };
    }
    if (res.status >= 400) {
      return {
        url,
        status: res.status,
        interpretation: "allow_all_missing",
        sitemaps: [],
        isAllowed: () => true,
        matchingLine: () => -1,
      };
    }
    const robot = robotsParser(url, res.body.toString("utf8"));
    return {
      url,
      status: res.status,
      interpretation: "rules",
      sitemaps: robot.getSitemaps(),
      crawlDelaySec: robot.getCrawlDelay(token),
      isAllowed: (u) => robot.isAllowed(u, token) !== false,
      matchingLine: (u) => robot.getMatchingLineNumber(u, token),
    };
  } catch (e) {
    const { unsafe } = describeFetchError(e);
    if (unsafe) throw e;
    return {
      url,
      status: "error",
      interpretation: "allow_all_fetch_error",
      sitemaps: [],
      isAllowed: () => true,
      matchingLine: () => -1,
    };
  }
}
