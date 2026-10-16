# WebAudit AI — Brand guidelines

Version 1.0 · approved 16 October 2026. Trademark clearance deferred by the owner.
Browsable version: [`previews/brand-book.html`](previews/brand-book.html) (print to PDF; a pre-rendered `previews/brand-book.pdf` is included).

---

## 1. Brand overview

WebAudit AI is an open-source, locally hosted website intelligence platform. It crawls a site, runs repeatable checks across technical SEO, performance, accessibility, analytics, ad pixels, lead forms, UX, consent, content and architecture, and turns hundreds of URL-level observations into a prioritised, evidence-backed backlog. AI is optional and limited to explaining findings.

## 2. Mission and positioning

**Mission:** help marketing and web teams fix the right things first, with evidence they can trust.
**Positioning:** the website auditor that shows its work — every finding has evidence, every number has a denominator, and nothing leaves your machine unless you choose.
**Brand promise:** _Turn website complexity into actionable clarity._

## 3. Target audience

Digital marketing leads, SEO specialists, MarTech/analytics managers, developers and web managers, agencies and technical consultants. Shared need: defensible findings they can hand to someone else to fix.

## 4. Brand personality

Precise · evidence-led · calm · technical but approachable · transparent about uncertainty · helpful, not judgmental.

## 5. Voice and tone

| We are                                           | We are not                                  |
| ------------------------------------------------ | ------------------------------------------- |
| Specific ("12 of 122 tested pages")              | Vague ("many pages")                        |
| Evidence-led ("not observed in the tested flow") | Absolute ("missing site-wide")              |
| Plain ("We couldn't reach that address")         | Technical for its own sake ("ECONNREFUSED") |
| Calm and constructive                            | Alarmist or shaming                         |
| Honest about limits                              | Over-promising                              |

Tone shifts by context: **onboarding** warm and brief; **results** neutral and exact; **errors** reassuring with a next step; **marketing** confident, never hyperbolic.

## 6. Messaging principles

1. Lead with the outcome (what to fix), then the evidence.
2. Always state scope: what was checked, sampled or skipped.
3. Label confidence: Confirmed, Potential, Manual review.
4. Recommendations are hypotheses — no promised rankings, traffic or conversions.
5. Privacy and accessibility findings are indicators, not compliance verdicts.

**Never say:** "perfect website score", "guaranteed SEO rankings", "AI detects every problem", "100% accurate audits", "instant compliance certification".

## 7. Preferred terminology

| Use                              | Avoid                                    |
| -------------------------------- | ---------------------------------------- |
| issue type, issue group, finding | error, violation (except axe's own term) |
| checks passed / checks evaluated | score, grade, health %                   |
| browser-sampled, not tested      | ignored, skipped silently                |
| inferred template                | template (unqualified)                   |
| Lighthouse lab data              | Core Web Vitals (unless field data)      |
| indicator                        | compliant / non-compliant                |
| AI suggestion                    | AI insight, AI analysis (as fact)        |
| website intelligence             | website health                           |

## 8. Tagline exploration

Recommended tagline: **"Evidence for every fix."** Descriptor: **"Website intelligence for marketers."** Brand promise: **"Turn website complexity into actionable clarity."**

## 9. Logo concept and rationale

**Master: "Inspected Window."** A browser window's chrome bar stays intact while its lower corners open into inspection brackets; a signal diamond marks where evidence is found. It reads as _website + inspection + finding_ without magnifying glasses, sparkles or brain imagery. Wordmark: "WebAudit" Inter SemiBold; "AI" Inter Medium in the muted tone — secondary, as AI is optional. Chosen from five concepts tested at 16–512 px.

## 10. Logo variants (`assets/logos/`)

| #   | Variant                    | File                                                                                                                       |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Primary horizontal         | `primary-horizontal.svg` (light bg)                                                                                        |
| 2   | Stacked                    | `stacked.svg`, `stacked-reverse.svg`                                                                                       |
| 3   | Standalone symbol          | `symbol.svg`, `symbol-reverse.svg`; small-size master `symbol-small*.svg` (≤ 32 px)                                        |
| 4   | Monochrome dark            | `mono-dark-horizontal.svg`, `mono-dark-symbol.svg`                                                                         |
| 5   | Monochrome light           | `mono-light-horizontal.svg`, `mono-light-symbol.svg`                                                                       |
| 6   | Reverse (dark backgrounds) | `primary-horizontal-reverse.svg`                                                                                           |
| 7   | Favicon                    | `assets/favicons/favicon.svg`, `favicon.ico` (16/32/48), `favicon-{16,32,48}.png`                                          |
| 8   | App icon                   | `assets/icons/app-icon.svg`, `app-icon-1024.png`; manifest `icon-{192,512}.png`, maskable variants, `apple-touch-icon.png` |
| 9   | GitHub avatar              | `assets/github/avatar-500.png`                                                                                             |
| 10  | Social profile icon        | `assets/social/profile-400.png`                                                                                            |

## 11. Clear space

Keep clear space of **half the symbol height** on all sides. Nothing — text, edges, other logos — enters this zone.

## 12. Minimum size

Horizontal lockup: 24 px tall on screen, 8 mm in print. Symbol: 16 px; **use the small-size master at 32 px and below**.

## 13. Correct and incorrect use

Do: use supplied files; two-tone on navy or white; single colour for one-ink print.
Don't: stretch, rotate, recolour the signal, add shadows/glows/gradients, outline the wordmark, place on busy imagery or low-contrast colour, rebuild the wordmark in another font, or separate "AI" from "WebAudit". Examples in the brand book.

## 14. Colour system

Midnight Intelligence (dark default) with a first-class light theme. One signal colour (teal). Fixed severity status scale always paired with icon + label. 60/60 required WCAG 2.2 AA pairs pass. Tokens: [`tokens/`](tokens/).

## 15. Typography

Inter (UI, reports, marketing) and JetBrains Mono (machine strings), both SIL OFL 1.1 and bundled with licences. Tabular figures for all numbers.

## 16. Iconography

Lucide, 2 px stroke, `currentColor`. The signal diamond is the brand's own device for bullets and kickers. `sparkles` is reserved for AI-generated content.

## 17. Illustrations

Nine line illustrations built from the logo's primitives, one accent element each, no mascots or gradients. Files: [`assets/illustrations/`](assets/illustrations/).

## 18. Data visualisation

Pick the form first, colour last. Fixed, validated categorical order; sequential = signal ramp; severity = status scale. Text never in series colour; legends for ≥ 2 series; values available as text or table. No dual axes, no fabricated or decorative metrics.

## 19. Application UI

Dense, calm, evidence-first. One primary action per view; filters in the URL; every number with its denominator; partial results flagged at the top.

## 20. Social media guidelines

Use the templates in `assets/social/src/` (rendered PNGs alongside). Navy canvas with a faint 48 px grid, logo top-left, one kicker with the signal diamond, a headline of ≤ 10 words, a product panel that shows rule names and severities — **never invented counts or scores**. Templates with `[bracketed]` text must be filled before publishing.

Launch copy (LinkedIn): _"WebAudit AI is now open source. It audits SEO, accessibility, analytics, consent and UX on your own machine and turns the results into a prioritised backlog — with evidence for every finding. No API key required; AI is optional."_

## 21. GitHub identity

- **Description:** "Open-source website intelligence for marketers: SEO, accessibility, analytics, consent and UX audits with evidence for every finding. Local-first; AI optional."
- **Topics:** website-audit, seo, accessibility, martech, ga4, consent, lighthouse, axe-core, playwright, open-source.
- **Assets:** social preview (1280×640), README hero, three feature graphics, contributor banner, release image, avatar — all in `assets/github/`.
- **README intro:** "WebAudit AI crawls a website, runs repeatable checks and turns hundreds of URL-level observations into a prioritised backlog — with the evidence a developer needs to reproduce each one. It runs locally and needs no API key."

## 22. Accessibility requirements

WCAG 2.2 AA minimum for product, docs, reports and marketing: 4.5:1 text, 3:1 meaningful graphics, visible focus, keyboard access, alt text on every non-decorative image, no colour-only meaning, reduced motion respected. Validate with `pnpm --filter @webaudit/branding contrast` and `pnpm e2e`.

## 23. Digital report styling

Cover in Midnight (navy, faint grid, horizontal reverse logo, host as h1), interior pages light. Sections: executive summary, category results (checks passed / evaluated), priorities, recommendations, evidence, methodology and limitations; footer with host, date and page number. Reference: `assets/reports/report-template.html` (+ PDF).

## 24. File naming conventions

`kebab-case`, descriptive, variant last: `primary-horizontal-reverse.svg`, `icon-maskable-512.png`, `feature-coverage.png`. Sizes as suffix numbers. Sources beside outputs in `src/`. Never "final", "v2", "new".

## 25. Asset usage guidance

SVG for anything scalable (web, docs); PNG only where platforms require raster (social, GitHub, favicons). Regenerate rather than edit rasters: `pnpm --filter @webaudit/branding build`. Asset catalogue: `assets/catalogue.json`. Fonts: use the bundled OFL WOFF2 files and keep their licence files with them.

## 26. Governance and versioning

- Owner approval required for: the master logo, palette changes, tagline.
- Semantic versions for the brand (1.0 approved 2026-10-16; minor = additions, major = logo or palette change). Record changes in this file's header and in `branding/README.md`.
- Any new colour token must pass `contrast`; any new chart palette must pass the data-viz validator; any UI change must keep `pnpm e2e` (axe, both themes) green.
- Generated files are never hand-edited — change the scripts or tokens and rebuild.
