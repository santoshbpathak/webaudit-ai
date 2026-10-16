# branding/

WebAudit AI brand identity system — **v1.0 — approved 16 October 2026** (logo A · Inspected Window, Midnight Intelligence palette, tagline “Evidence for every fix.”).

## Start here

|                                                                                       |                                                             |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [WEBAUDIT_AI_BRAND_GUIDELINES.md](WEBAUDIT_AI_BRAND_GUIDELINES.md)                    | The guidelines (26 sections)                                |
| [previews/brand-book.html](previews/brand-book.html) · [PDF](previews/brand-book.pdf) | Visual brand book (open locally; theme toggle; print-ready) |
| [tokens/](tokens/)                                                                    | Colour tokens (source of truth) and generated CSS variables |

## Asset catalogue

```
assets/
  logos/           master variants (SVG), incl. small-size master
  favicons/        favicon.svg · favicon.ico (16/32/48) · favicon-{16,32,48}.png · apple-touch-icon.png · icon-{192,512}.png · icon-maskable-{192,512}.png · site.webmanifest
  icons/           app-icon.svg · app-icon-1024.png
  illustrations/   9 empty/status illustrations (SVG, titled for screen readers)
  github/          social-preview 1280×640 · readme-hero 1600×520 · feature-{evidence,coverage,martech} 1200×600 · contributor-banner 1280×400 · release 1200×630 · avatar-500 · src/*.html
  social/          linkedin-launch 1200×627 · square-announcement 1080² · vertical-announcement 1080×1350 · showcase-card 1200×675 · template-{feature,update,contributor} · og-default 1200×630 · profile-400 · src/*.html
  reports/         report-template.html · report-template.pdf · report-cover.png
  fonts/           Inter + JetBrains Mono WOFF2 with OFL licences
  catalogue.json   machine-readable list of rendered rasters
tokens/
  colors.json          source of truth (W3C design-tokens format)
  semantic-tokens.css  generated CSS variables (--wa-*)
```

Every PNG and PDF is rendered by Chromium (Playwright) from the SVG/HTML sources — there are no placeholder rasters.

## Build

```bash
pnpm --filter @webaudit/branding build        # tokens, concepts, all assets, report, brand book
pnpm --filter @webaudit/branding contrast     # WCAG check (non-zero exit on failure)
BRAND_LOGO=d-w-pulse pnpm --filter @webaudit/branding build   # rebuild everything around another concept
```

Stages can be run individually: `node scripts/build.mjs tokens|concepts|assets|pages`.

## Decisions log

| Date       | Decision                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-16 | Approved: master logo **A · Inspected Window**, Midnight Intelligence palette (dark default + light theme), tagline **“Evidence for every fix.”**, app rollout. |
| 2026-10-16 | Deferred by owner: trademark clearance search.                                                                                                                  |
| 2026-10-16 | Owner confirmed ownership of all branding assets in this folder. Exploration files (concepts, size tests, directions, QA reports) kept out of the repository.   |
