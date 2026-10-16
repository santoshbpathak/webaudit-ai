# Accessibility audit guide

This covers **M03 Accessibility**, plus related checks in M06 (form labels) and M07 (tap targets, horizontal overflow). These are browser checks, so they run on the **sampled pages** in Smart mode.

## What is checked

WebAudit AI runs **axe-core**, the open-source accessibility engine, in a real Chromium session.

- Every axe rule that fails becomes a finding, with the exact element (CSS selector) and an HTML snippet.
- Axe's own impact level maps to severity. "Critical" is capped at High.
- Common rules have plain-language explanations:
  - images without alt text
  - inputs without labels
  - colour contrast
  - links and buttons without names
  - page language
  - document title
  - heading order
  - landmarks
  - zoom disabled
  - touch target size

Related checks:

| Rule                                                               | Why it matters                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| M06 form fields without an accessible label (high · confirmed)     | Screen-reader users can't tell what to type. This also catches placeholder-only fields, which axe accepts |
| M07 tap targets smaller than 24×24 px (medium · confirmed)         | Mis-taps on mobile frustrate everyone, especially people with motor impairments                           |
| M07 horizontal scrolling on the tested viewport (high · confirmed) | Content cut off on mobile                                                                                 |

## Why it matters to marketers

Accessibility problems are usability problems:

- unlabeled form fields lose leads
- low-contrast CTAs get missed
- broken zoom drives mobile visitors away

Accessibility also carries legal and reputational risk in many markets. WebAudit AI flags indicators and does **not** make legal determinations.

## How to interpret results

- **"Passed" means "no automated violation found"**, not "accessible". Automated tools detect only part of WCAG issues.
- Review **Potential / Incomplete** items manually. Axe marks some checks as needing review, and WebAudit AI records them as _inconclusive_, never as passes.
- Fix at the **component** level. One button component without a name often explains dozens of findings.

## What automated checks cannot verify

- Keyboard-only navigation through real tasks
- Screen-reader experience and meaningful reading order
- Whether alt text actually describes the image
- Captions, transcripts, cognitive load and plain language
- WCAG conformance overall. That requires manual expert testing

## When to involve a developer or specialist

- **Developers:** labels, names, landmarks, contrast tokens and zoom.
- **An accessibility specialist:** a conformance claim, or a response to a complaint.

## Prioritising

1. Blockers on conversion paths: forms, CTAs, navigation
2. Site-wide component issues: the header, buttons, colour tokens
3. Page-specific content fixes (alt text, headings)
