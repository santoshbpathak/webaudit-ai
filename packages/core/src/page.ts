/**
 * Observations about a single URL, gathered by the crawler (HTTP layer) and,
 * when the page was sampled for heavy checks, by the browser layer.
 * Modules read these; they never fetch anything themselves.
 */

export interface RedirectHop {
  url: string;
  status: number;
}

export interface HttpSnapshot {
  /** Normalized URL as requested. */
  url: string;
  /** URL after redirects. */
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  contentType: string;
  redirectChain: RedirectHop[];
  /** Body bytes actually read (capped). */
  bytes: number;
  truncated: boolean;
  /** HTML body when content type is HTML, else undefined. */
  html?: string;
  fetchedAt: string;
  elapsedMs: number;
}

export interface ObservedRequest {
  /** Redacted URL. */
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  /** Was this request made before any consent interaction? */
  beforeConsent: boolean;
  /** Short redacted excerpt of POST body for analytics beacons. */
  postDataExcerpt?: string;
  blocked?: string;
}

export interface ObservedCookie {
  name: string;
  domain: string;
  /** Value is never stored. */
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  expires?: number;
  firstParty: boolean;
}

export interface FormField {
  tag: string;
  type?: string;
  name?: string;
  id?: string;
  hasLabel: boolean;
  labelText?: string;
  required: boolean;
  autocomplete?: string;
  checkedByDefault?: boolean;
  hidden: boolean;
  selector: string;
}

export interface ObservedForm {
  selector: string;
  action?: string;
  method: string;
  fields: FormField[];
  submitText?: string;
  hasNoValidate: boolean;
}

export interface CtaCandidate {
  text: string;
  selector: string;
  aboveFold: boolean;
  width: number;
  height: number;
}

export interface AxeViolation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: { target: string; html: string; failureSummary?: string }[];
}

export interface AxeResult {
  version: string;
  violations: AxeViolation[];
  /** Rule ids that passed / did not apply / need manual review — exact denominators for M03. */
  passes: string[];
  inapplicable: string[];
  incomplete: { id: string; impact: AxeViolation["impact"]; help: string; helpUrl: string }[];
}

export interface LighthouseSummary {
  version: string;
  performanceScore: number | null;
  metrics: {
    lcpMs?: number;
    cls?: number;
    tbtMs?: number;
    fcpMs?: number;
    speedIndexMs?: number;
    totalByteWeight?: number;
  };
  renderBlocking: { url: string; wastedMs: number }[];
  reportRef?: string;
}

export interface ConsentObservation {
  bannerDetected: boolean;
  cmp?: string;
  bannerSelector?: string;
  acceptSelector?: string;
  rejectSelector?: string;
  preCheckedOptions: string[];
  cookiesBeforeConsent: ObservedCookie[];
  storageKeysBeforeConsent: string[];
}

export interface BrowserSnapshot {
  finalUrl: string;
  title: string;
  renderedHtml: string;
  requests: ObservedRequest[];
  cookies: ObservedCookie[];
  dataLayer: unknown[];
  forms: ObservedForm[];
  ctas: CtaCandidate[];
  viewport: { width: number; height: number };
  documentWidth: number;
  smallTapTargets: { selector: string; width: number; height: number }[];
  brokenImages: { src: string; selector: string }[];
  /** script[src] URLs present in the rendered DOM (redacted). Catches duplicates served from cache. */
  scripts: string[];
  consent: ConsentObservation;
  screenshotRef?: string;
  axe?: AxeResult | { error: string };
  lighthouse?: LighthouseSummary | { error: string };
  /** Errors from individual browser steps, keyed by step name. */
  stepErrors: Record<string, string>;
}

export interface ParsedLink {
  /** Normalized absolute URL, or null for non-http links. */
  url: string | null;
  raw: string;
  text: string;
  rel: string;
  internal: boolean;
}

export interface JsonLdBlock {
  valid: boolean;
  error?: string;
  types: string[];
  excerpt: string;
}

/** Facts extracted once from the HTML response; modules read this instead of re-parsing. */
export interface ParsedHtml {
  titles: string[];
  metaDescriptions: string[];
  canonicals: string[];
  robotsMeta: string[];
  xRobotsTag?: string;
  lang?: string;
  viewport?: string;
  charset?: string;
  headings: { level: number; text: string }[];
  hreflang: { lang: string; href: string }[];
  jsonLd: JsonLdBlock[];
  links: ParsedLink[];
  images: { src: string; alt: string | null; selector: string }[];
  scriptSrcs: string[];
  /** Concatenated inline script text, truncated — used for tag ID detection. */
  inlineScripts: string;
  wordCount: number;
  textHash: string;
  simhash: string;
  /** Bottom-k MinHash sketch of main-content shingles, for near-duplicate detection. */
  minhash: number[];
  domSignature: string;
  formCount: number;
}

export interface PageContext {
  auditId: string;
  url: string;
  http: HttpSnapshot;
  parsed?: ParsedHtml;
  browser?: BrowserSnapshot;
  /** Set when the page was sampled for browser checks but the browser run failed. */
  browserError?: string;
  /** Is this URL listed in a discovered sitemap? undefined = sitemaps not loaded (quick mode). */
  inSitemap?: boolean;
  /** Click depth from the start URL, if known. */
  depth?: number;
}
