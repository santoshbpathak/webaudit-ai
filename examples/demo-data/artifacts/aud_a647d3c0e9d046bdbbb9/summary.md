## WebAudit AI — 127.0.0.1

**106 issue groups found on 127.0.0.1 across 17 pages; 33 rated high or critical.**

| Discovered | Checked | Browser-sampled | Blocked (robots) | Skipped | Failed |
|---:|---:|---:|---:|---:|---:|
| 24 | 18 | 15 | 1 | 5 | 0 |

Lighthouse lab performance (median of 2): **100**

### Top issues

| # | Issue | Severity | Pages (affected/tested) | Template |
|---:|---|---|---:|---|
| 1 | Page scrolls horizontally on the tested viewport `M07-HORIZONTAL-OVERFLOW` | 🟧 high | 5/5 | `/trap/*` |
| 2 | No mobile viewport meta tag `M01-VIEWPORT-MISSING` | 🟧 high | 5/5 | `/trap/*` |
| 3 | No GA4 tag or hit observed on this page `M04-GA4-NOT-OBSERVED` | 🟧 high | 5/5 | `/trap/*` |
| 4 | Touch targets too small `M03-AXE-TARGET-SIZE` | 🟧 high | 2/2 | `/blog/*` |
| 5 | Touch targets too small `M03-AXE-TARGET-SIZE` | 🟧 high | 2/2 | `/products/*` |
| 6 | No main landmark `M03-AXE-LANDMARK-ONE-MAIN` | 🟨 medium | 5/5 | `/trap/*` |
| 7 | Content outside landmarks `M03-AXE-REGION` | 🟨 medium | 5/5 | `/trap/*` |
| 8 | Tap targets smaller than 24×24 px `M07-SMALL-TAP-TARGETS` | 🟨 medium | 5/5 | `/trap/*` |
| 9 | Duplicate title across pages `M01-TITLE-DUPLICATE` | 🟨 medium | 4/5 | `/trap/*` |
| 10 | Marketing/analytics requests fire before consent `M08-TRACKING-BEFORE-CONSENT` | 🟧 high | 2/2 | `/blog/*` |
| 11 | Marketing/analytics requests fire before consent `M08-TRACKING-BEFORE-CONSENT` | 🟧 high | 2/2 | `/products/*` |
| 12 | Page scrolls horizontally on the tested viewport `M07-HORIZONTAL-OVERFLOW` | 🟧 high | 1/1 | `/` |
| 13 | Touch targets too small `M03-AXE-TARGET-SIZE` | 🟧 high | 1/1 | `/` |
| 14 | Images without alternative text `M03-AXE-IMAGE-ALT` | 🟧 high | 1/1 | `/` |
| 15 | No call-to-action visible above the fold `M07-NO-CTA-ABOVE-FOLD` | 🟨 medium | 5/5 | `/trap/*` |

### MarTech signals

- GA4 was not observed on 6 tested pages — visits there may be missing from analytics (not observed in the tested flow).
- Ad pixel library loaded more than once: 1 page — reported numbers may be inflated.
- Trackers fired before any consent choice on 9 pages (indicator, not a legal determination).
- Tags observed on sampled pages: Google Analytics 4 (9/15), Google Tag Manager (9/15), LinkedIn Insight Tag (1/15), Meta Pixel (1/15), TikTok Pixel (1/15).
- 10 lead-form issue groups may add friction to conversions — treat as hypotheses to test.

<details><summary>Limitations</summary>

- Automated checks cannot establish legal compliance (privacy, consent, accessibility) or guarantee ranking, traffic or conversion outcomes.
- Performance numbers are Lighthouse lab measurements, not real-user field data.
- Tags gated behind consent, logins, ad blockers or later user actions may not be observed.
- 1 URL(s) were excluded by robots.txt and not audited.

</details>
