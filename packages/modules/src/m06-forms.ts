import type { AuditModule, FormField, ObservedForm, PageContext, RuleResult } from "@webaudit/core";
import { explainFrom } from "@webaudit/core";
import { check, na, naAll, notHtmlReason, repro, rules } from "./helpers";

const R = rules([
  {
    id: "M06-FIELD-NO-LABEL",
    module: "M06",
    title: "Form fields without an accessible label",
    severity: "high",
    confidence: "verified",
    layer: "browser",
    rationale:
      "Placeholder-only fields lose their hint as soon as users type, fail screen readers, and measurably increase form errors and abandonment.",
    remediation: "Add a visible <label for> (or aria-label) to: {fields}.",
    applicability: "Pages with visible forms",
  },
  {
    id: "M06-EMAIL-TYPE",
    module: "M06",
    title: 'Email field not using type="email"',
    severity: "medium",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "type=email shows the right mobile keyboard and gives free validation — fewer typos in captured leads.",
    remediation: 'Change these fields to type="email" with autocomplete="email": {fields}.',
    caveat: "Detected by field name/label containing 'email'.",
    applicability: "Forms with an email-like field",
  },
  {
    id: "M06-PHONE-TYPE",
    module: "M06",
    title: 'Phone field not using type="tel"',
    severity: "low",
    confidence: "heuristic",
    layer: "browser",
    rationale: "type=tel brings up the numeric keypad on mobile, reducing friction.",
    remediation: 'Change these fields to type="tel" with autocomplete="tel": {fields}.',
    applicability: "Forms with a phone-like field",
  },
  {
    id: "M06-AUTOCOMPLETE-MISSING",
    module: "M06",
    title: "Contact fields missing autocomplete",
    severity: "low",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "Autofill can complete a lead form in one tap; without autocomplete hints browsers guess or do nothing.",
    remediation: "Add autocomplete tokens (name, email, tel, postal-code…) to: {fields}.",
    applicability: "Forms with name/email/phone fields",
  },
  {
    id: "M06-PRECHECKED-OPTIN",
    module: "M06",
    title: "Marketing opt-in checkbox is pre-checked",
    severity: "high",
    confidence: "heuristic",
    layer: "browser",
    rationale:
      "Pre-ticked marketing consent is generally not regarded as valid consent under GDPR and many privacy laws, and erodes trust in your list.",
    remediation: "Leave marketing opt-ins unchecked by default: {fields}.",
    caveat: "Indicator only, not a legal determination. Detected by name/label keywords.",
    applicability: "Forms with checkboxes",
  },
  {
    id: "M06-NOVALIDATE",
    module: "M06",
    title: "Form disables browser validation (novalidate)",
    severity: "low",
    confidence: "manual_review",
    layer: "browser",
    rationale:
      "novalidate is fine when custom validation exists; otherwise bad data and silent failures get through.",
    remediation: "Confirm custom client-side validation and clear inline error messages exist for {form}.",
    applicability: "Pages with forms",
  },
  {
    id: "M06-NO-REQUIRED",
    module: "M06",
    title: "Lead form marks no field as required",
    severity: "low",
    confidence: "heuristic",
    layer: "browser",
    rationale: "Without required fields, empty or partial leads can be submitted and wasted.",
    remediation: "Mark essential fields (e.g. name and email/phone) as required in {form}.",
    applicability: "Forms with 2+ visible text fields",
  },
  {
    id: "M06-TOO-MANY-FIELDS",
    module: "M06",
    title: "Long form (more than 8 visible fields)",
    severity: "low",
    confidence: "heuristic",
    layer: "browser",
    rationale: "Each extra field adds friction; long first-step forms typically convert worse.",
    remediation: "Test a shorter first step or progressive profiling for {form} ({count} fields).",
    caveat: "A hypothesis to test, not a guaranteed uplift.",
    applicability: "Pages with forms",
  },
]);

const IDS = R.map((r) => r.id);
const fieldText = (f: FormField) => `${f.name ?? ""} ${f.id ?? ""} ${f.labelText ?? ""}`.toLowerCase();
const isTextLike = (f: FormField) =>
  !f.hidden &&
  (f.tag === "textarea" ||
    f.tag === "select" ||
    ["text", "email", "tel", "number", "url", "search", "password", "date", undefined].includes(f.type));
const isHoneypot = (f: FormField) => f.hidden || /honeypot|website_url|hp_|bot/i.test(fieldText(f));
const label = (f: FormField) => f.name ?? f.id ?? f.selector;

function runPage(ctx: PageContext): RuleResult[] {
  const url = ctx.url;
  const reason = notHtmlReason(ctx);
  if (reason) return naAll(IDS, url, reason);
  if (!ctx.browser) return [];
  const forms: ObservedForm[] = ctx.browser.forms.filter((f) =>
    f.fields.some((x) => !x.hidden && !isHoneypot(x)),
  );
  if (!forms.length) return IDS.map((id) => na(id, url, "No visible forms"));

  const visible = forms.flatMap((f) => f.fields.filter((x) => !isHoneypot(x) && x.type !== "hidden"));
  const unlabeled = visible.filter((f) => !f.hasLabel);
  const emailBad = visible.filter(
    (f) => /e-?mail/.test(fieldText(f)) && f.tag === "input" && f.type !== "email",
  );
  const phoneBad = visible.filter(
    (f) => /phone|mobile|\btel\b/.test(fieldText(f)) && f.tag === "input" && f.type !== "tel",
  );
  const contactFields = visible.filter(
    (f) => /name|e-?mail|phone|mobile|\btel\b|zip|postcode|pincode/.test(fieldText(f)) && f.tag === "input",
  );
  const noAuto = contactFields.filter((f) => !f.autocomplete || f.autocomplete === "on");
  const optins = visible.filter(
    (f) =>
      f.type === "checkbox" &&
      f.checkedByDefault &&
      /offer|marketing|newsletter|promo|opt-?in|subscribe|updates|consent|partners/.test(fieldText(f)),
  );
  const firstSel = (fs: FormField[]) =>
    fs
      .slice(0, 5)
      .map((f) => f.selector)
      .join(", ");
  const names = (fs: FormField[]) => fs.slice(0, 8).map(label).join(", ");
  const insp = (fs: FormField[]) => repro.inspect(url, fs[0]?.selector ?? "form");

  const out: RuleResult[] = [
    check(unlabeled.length > 0, "M06-FIELD-NO-LABEL", url, {
      selector: firstSel(unlabeled),
      observed: { fields: names(unlabeled), count: unlabeled.length },
      reproSteps: insp(unlabeled),
    }),
    emailBad.length || visible.some((f) => /e-?mail/.test(fieldText(f)))
      ? check(emailBad.length > 0, "M06-EMAIL-TYPE", url, {
          selector: firstSel(emailBad),
          observed: { fields: names(emailBad) },
          reproSteps: insp(emailBad),
        })
      : na("M06-EMAIL-TYPE", url, "No email field"),
    phoneBad.length || visible.some((f) => /phone|mobile|\btel\b/.test(fieldText(f)))
      ? check(phoneBad.length > 0, "M06-PHONE-TYPE", url, {
          selector: firstSel(phoneBad),
          observed: { fields: names(phoneBad) },
          reproSteps: insp(phoneBad),
        })
      : na("M06-PHONE-TYPE", url, "No phone field"),
    contactFields.length
      ? check(noAuto.length > 0, "M06-AUTOCOMPLETE-MISSING", url, {
          selector: firstSel(noAuto),
          observed: { fields: names(noAuto) },
          reproSteps: insp(noAuto),
        })
      : na("M06-AUTOCOMPLETE-MISSING", url, "No contact fields"),
    visible.some((f) => f.type === "checkbox")
      ? check(optins.length > 0, "M06-PRECHECKED-OPTIN", url, {
          selector: firstSel(optins),
          observed: { fields: names(optins) },
          reproSteps: insp(optins),
        })
      : na("M06-PRECHECKED-OPTIN", url, "No checkboxes"),
  ];

  const nv = forms.filter((f) => f.hasNoValidate);
  out.push(
    check(nv.length > 0, "M06-NOVALIDATE", url, {
      selector: nv[0]?.selector,
      observed: { form: nv[0]?.selector },
      reproSteps: repro.inspect(url, "form[novalidate]"),
    }),
  );
  const leadForms = forms.filter((f) => f.fields.filter((x) => isTextLike(x) && !isHoneypot(x)).length >= 2);
  const noReq = leadForms.filter((f) => !f.fields.some((x) => x.required && !x.hidden));
  out.push(
    leadForms.length
      ? check(noReq.length > 0, "M06-NO-REQUIRED", url, {
          selector: noReq[0]?.selector,
          observed: { form: noReq[0]?.selector },
          reproSteps: repro.inspect(url, noReq[0]?.selector ?? "form"),
        })
      : na("M06-NO-REQUIRED", url, "No multi-field forms"),
  );
  const long = forms
    .map((f) => ({ f, n: f.fields.filter((x) => !x.hidden && !isHoneypot(x)).length }))
    .filter((x) => x.n > 8);
  out.push(
    check(long.length > 0, "M06-TOO-MANY-FIELDS", url, {
      selector: long[0]?.f.selector,
      observed: { form: long[0]?.f.selector, count: long[0]?.n },
      reproSteps: repro.inspect(url, long[0]?.f.selector ?? "form"),
    }),
  );
  return out;
}

export const m06Forms: AuditModule = {
  id: "M06",
  name: "Lead forms",
  version: "1.0.0",
  rules: R,
  runPage,
  explain: explainFrom(R),
};
