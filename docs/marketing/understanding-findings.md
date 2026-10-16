# Understanding findings

A **finding** is one check on one page: "this page has no meta description". Findings with the same rule on the same kind of page are grouped into an **issue group**: "missing meta description on 119 product pages". You work from issue groups. The individual findings are the evidence.

## The four labels on every issue

### Severity: how much it can hurt

| Severity | Meaning                                     | Example                                                           |
| -------- | ------------------------------------------- | ----------------------------------------------------------------- |
| Critical | Reserved for severe breakage                | No built-in rule uses it today (axe "critical" is capped at High) |
| High     | Likely to lose traffic, data or conversions | GA4 not observed, canonical to another domain, pre-ticked opt-in  |
| Medium   | Worth fixing in the normal backlog          | Missing meta description, redirect chain                          |
| Low      | Polish or best practice                     | Title slightly long, no autocomplete on a field                   |

### Confidence: how sure the tool is

| Label in the app  | Meaning                                                      | What to do                           |
| ----------------- | ------------------------------------------------------------ | ------------------------------------ |
| **Confirmed**     | Directly observed: the tag isn't there, the status is 404    | Act on it                            |
| **Potential**     | Inferred from signals: "this looks like a lead form"         | Check a sample before assigning work |
| **Manual review** | Needs human judgement: two GTM containers may be intentional | Ask the owner of that area           |

### Coverage: how much was tested

Each issue shows **affected pages / tested pages**, for example "9 / 25".

- Browser checks (analytics, consent, accessibility, forms, UX, performance) run on a **sample** in Smart mode. "9 / 25" means 9 of the 25 sampled pages, not 9 of the whole site.
- **Not tested** means the check did not run on that page. It never means "passed".

### Template

WebAudit AI infers page templates from URL patterns, such as `/products/:slug`. "Inferred template" means the grouping is a best guess. A fix usually happens once in the template, not page by page.

## Reading the evidence panel

Click an issue to see:

- **Why it matters**, in plain language.
- **Evidence** per page: the CSS selector, HTML snippet, network request (with sensitive values redacted) and screenshot.
- **Reproduction steps** a developer can follow.
- **Caveat**: the limits of this check. Read it before escalating.
- **Priority breakdown**: severity × pages × confidence × importance.

## Common false positives

| Finding                           | When it may be fine                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GA4 not observed                  | GA4 loads only after consent, or through a server-side setup, and the tool did not accept consent on that page |
| Canonical points to another host  | Content is intentionally syndicated                                                                            |
| Multiple GTM containers / GA4 IDs | Separate teams or properties by design                                                                         |
| No CTA above the fold             | Content pages where a CTA would be inappropriate                                                               |
| Thin content                      | Utility pages: contact, login, thank-you                                                                       |
| Near-duplicate content            | Product variants that are meant to be similar                                                                  |
| Trackers before consent           | Strictly necessary or consent-exempt services, or your CMP isn't recognised                                    |

If you find a rule that is wrong, please report it with the [audit accuracy template](../../.github/ISSUE_TEMPLATE/audit_accuracy_issue.yml). Use a public or synthetic example.

## When to involve a developer

Give a developer the issue when the fix needs a template, a tag or a configuration change:

- canonicals
- redirects
- viewport
- tag duplication
- consent-mode behaviour
- form markup

The evidence panel and the CSV export carry everything they need to reproduce it.
