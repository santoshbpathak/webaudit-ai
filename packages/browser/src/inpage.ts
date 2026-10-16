/// <reference lib="dom" />
/**
 * Functions evaluated inside the audited page. Each must be fully self-contained:
 * Playwright serializes the function source, so no imports or outer-scope references.
 * They only READ the page — nothing here clicks, types or submits.
 */

export interface InPageResult {
  title: string;
  viewport: { width: number; height: number };
  documentWidth: number;
  forms: {
    selector: string;
    action?: string;
    method: string;
    hasNoValidate: boolean;
    submitText?: string;
    fields: {
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
    }[];
  }[];
  ctas: { text: string; selector: string; aboveFold: boolean; width: number; height: number }[];
  smallTapTargets: { selector: string; width: number; height: number }[];
  brokenImages: { src: string; selector: string }[];
  scripts: string[];
  dataLayer: unknown[];
  storageKeys: string[];
  consent: {
    bannerDetected: boolean;
    cmp?: string;
    bannerSelector?: string;
    acceptSelector?: string;
    rejectSelector?: string;
    preCheckedOptions: string[];
  };
}

export function collectInPage(): InPageResult {
  const cssPath = (el: Element): string => {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur.nodeType === 1 && parts.length < 5) {
      if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id)) {
        parts.unshift(`${cur.tagName.toLowerCase()}#${cur.id}`);
        break;
      }
      const tag = cur.tagName.toLowerCase();
      const parent: Element | null = cur.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
        parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
      } else parts.unshift(tag);
      cur = parent;
    }
    return parts.join(" > ");
  };
  const visible = (el: Element): boolean => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

  // ---- forms ----
  const labelFor = (el: HTMLElement): string | undefined => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return text(l);
    }
    const wrap = el.closest("label");
    if (wrap) return text(wrap);
    const aria = el.getAttribute("aria-label");
    if (aria) return aria;
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((n) => text(n!))
        .join(" ");
      if (t) return t;
    }
    const title = el.getAttribute("title");
    return title || undefined;
  };
  const forms = Array.from(document.forms)
    .slice(0, 20)
    .map((form) => {
      const fields = Array.from(form.querySelectorAll("input, select, textarea"))
        .filter((f) => !["submit", "button", "reset", "image"].includes((f as HTMLInputElement).type))
        .slice(0, 50)
        .map((f) => {
          const el = f as HTMLInputElement;
          const label = labelFor(el);
          const isHidden = el.type === "hidden" || !visible(el);
          return {
            tag: el.tagName.toLowerCase(),
            type: el.tagName === "INPUT" ? el.type : undefined,
            name: el.name || undefined,
            id: el.id || undefined,
            hasLabel: !!label,
            labelText: label?.slice(0, 80),
            required: el.required || el.getAttribute("aria-required") === "true",
            autocomplete: el.getAttribute("autocomplete") ?? undefined,
            checkedByDefault: el.type === "checkbox" || el.type === "radio" ? el.defaultChecked : undefined,
            hidden: isHidden,
            selector: cssPath(el),
          };
        });
      const submit = form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]');
      return {
        selector: cssPath(form),
        action: form.getAttribute("action") ?? undefined,
        method: (form.getAttribute("method") ?? "get").toLowerCase(),
        hasNoValidate: form.noValidate,
        submitText: submit ? text(submit) || (submit as HTMLInputElement).value || undefined : undefined,
        fields,
      };
    });

  // ---- CTAs ----
  const CTA_RE =
    /\b(quote|buy|get|start|sign ?up|subscribe|contact|book|request|apply|download|try|claim|talk|call|demo|register|shop|order|join|enquire|inquire)\b/i;
  const ctas = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'))
    .filter((el) => visible(el))
    .map((el) => {
      const t = text(el) || (el as HTMLInputElement).value || el.getAttribute("aria-label") || "";
      const cls = (el.getAttribute("class") ?? "").toLowerCase();
      const isCta = (CTA_RE.test(t) && t.length <= 40) || /\b(cta|btn-primary|button-primary)\b/.test(cls);
      return { el, t, isCta };
    })
    .filter((x) => x.isCta && !x.el.closest("nav, footer, #cookie-banner, [role=dialog]"))
    .slice(0, 30)
    .map(({ el, t }) => {
      const r = el.getBoundingClientRect();
      return {
        text: t.slice(0, 60),
        selector: cssPath(el),
        aboveFold: r.top + window.scrollY < window.innerHeight && r.bottom > 0,
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    });

  // ---- tap targets (WCAG 2.2 SC 2.5.8 minimum 24×24, inline-in-sentence links exempt) ----
  const smallTapTargets = Array.from(
    document.querySelectorAll('a[href], button, input, select, [role="button"]'),
  )
    .filter((el) => visible(el) && !(el as HTMLInputElement).type?.match(/^hidden$/))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width >= 24 && r.height >= 24) return false;
      const block = el.parentElement;
      const inline = block && /^(P|LI|TD|SPAN|DD)$/.test(block.tagName) && text(block).length > 80;
      return !inline;
    })
    .slice(0, 50)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { selector: cssPath(el), width: Math.round(r.width), height: Math.round(r.height) };
    });

  // ---- broken images ----
  const brokenImages = Array.from(document.images)
    .filter((img) => img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src))
    .slice(0, 50)
    .map((img) => ({ src: img.currentSrc || img.src, selector: cssPath(img) }));

  const scripts = Array.from(document.scripts)
    .map((sc) => sc.src)
    .filter(Boolean)
    .slice(0, 300);

  // ---- dataLayer (JSON-safe clone; gtag pushes Arguments objects) ----
  const w = window as unknown as { dataLayer?: unknown[] };
  const clone = (v: unknown, depth = 0): unknown => {
    if (depth > 4) return "[depth]";
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) return v;
    if (typeof v === "function") return "[function]";
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v) || Object.prototype.toString.call(v) === "[object Arguments]") {
      return Array.from(v as ArrayLike<unknown>)
        .slice(0, 20)
        .map((x) => clone(x, depth + 1));
    }
    if (typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as object).slice(0, 30)) {
        if (k.startsWith("gtm.") && k !== "gtm.start") continue;
        out[k] = clone((v as Record<string, unknown>)[k], depth + 1);
      }
      return out;
    }
    return String(v);
  };
  const dataLayer = Array.isArray(w.dataLayer) ? w.dataLayer.slice(0, 60).map((x) => clone(x)) : [];

  let storageKeys: string[];
  try {
    storageKeys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)].slice(0, 100);
  } catch {
    storageKeys = []; // storage blocked (sandboxed iframe / privacy mode)
  }

  // ---- consent banner ----
  const CMPS: [string, string, string?][] = [
    ["OneTrust", "#onetrust-banner-sdk, #onetrust-consent-sdk", "OneTrust"],
    ["Cookiebot", "#CybotCookiebotDialog", "Cookiebot"],
    ["Usercentrics", "#usercentrics-root, #usercentrics-cmp-ui", "UC_UI"],
    ["Didomi", "#didomi-host, #didomi-popup", "Didomi"],
    ["TrustArc", "#truste-consent-track, #consent_blackbar", "truste"],
    ["Quantcast", ".qc-cmp2-container", "__tcfapi"],
    ["CookieYes", ".cky-consent-container", "ckyBanner"],
    ["Complianz", "#cmplz-cookiebanner-container, .cmplz-cookiebanner", "complianz"],
    ["Osano", ".osano-cm-window", "Osano"],
    ["Termly", "#termly-code-snippet-support", "Termly"],
    ["Iubenda", "#iubenda-cs-banner", "_iub"],
    ["Klaro", ".klaro", "klaro"],
  ];
  let cmp: string | undefined;
  let banner: Element | null = null;
  for (const [name, sel, global] of CMPS) {
    const el = document.querySelector(sel);
    if (el || (global && (window as unknown as Record<string, unknown>)[global] !== undefined)) {
      cmp = name;
      banner = el;
      break;
    }
  }
  if (!banner) {
    banner =
      Array.from(document.querySelectorAll("div, section, aside, dialog, [role=dialog], [role=alertdialog]"))
        .filter((el) => {
          const sig = `${el.id} ${el.getAttribute("class") ?? ""} ${el.getAttribute("aria-label") ?? ""}`;
          return /cookie|consent|gdpr|privacy-banner|cc-window|cookie-law/i.test(sig) && visible(el);
        })
        .sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length)
        .find((el) => el.querySelector("button, a, [role=button]")) ?? null;
    if (banner && !cmp) cmp = "generic";
  }
  const ACCEPT =
    /^(accept|accept all|accept cookies|allow all|allow cookies|allow|agree|i agree|ok|okay|got it|i understand|continue)\b/i;
  const REJECT =
    /\b(reject|decline|deny|refuse|necessary only|only necessary|essential only|reject all|disagree)\b/i;
  const buttons = banner
    ? Array.from(banner.querySelectorAll("button, a, [role=button], input[type=button]"))
    : [];
  const accept = buttons.find((b) => ACCEPT.test(text(b) || (b as HTMLInputElement).value || ""));
  const reject = buttons.find((b) => REJECT.test(text(b) || (b as HTMLInputElement).value || ""));
  const preChecked = banner
    ? Array.from(banner.querySelectorAll('input[type="checkbox"]'))
        .filter((c) => (c as HTMLInputElement).defaultChecked && !(c as HTMLInputElement).disabled)
        .map((c) => (c as HTMLInputElement).name || labelFor(c as HTMLElement) || cssPath(c))
    : [];

  return {
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
    forms,
    ctas,
    smallTapTargets,
    brokenImages,
    scripts,
    dataLayer,
    storageKeys,
    consent: {
      bannerDetected: !!banner,
      cmp,
      bannerSelector: banner ? cssPath(banner) : undefined,
      acceptSelector: accept ? cssPath(accept) : undefined,
      rejectSelector: reject ? cssPath(reject) : undefined,
      preCheckedOptions: preChecked.slice(0, 20),
    },
  };
}
