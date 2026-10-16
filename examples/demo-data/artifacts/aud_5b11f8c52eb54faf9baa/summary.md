## WebAudit AI — 127.0.0.1

**121 issue groups found on 127.0.0.1 across 138 pages; 37 rated high or critical.**

| Discovered | Checked | Browser-sampled | Blocked (robots) | Skipped | Failed |
|---:|---:|---:|---:|---:|---:|
| 145 | 139 | 25 | 1 | 5 | 0 |

Lighthouse lab performance (median of 2): **99.5**

### Top issues

| # | Issue | Severity | Pages (affected/tested) | Template |
|---:|---|---|---:|---|
| 1 | Touch targets too small `M03-AXE-TARGET-SIZE` | 🟧 high | 10/10 | `/large/:n` |
| 2 | Main content identical to another page `M09-EXACT-DUPLICATE` | 🟨 medium | 119/120 | `/large/:n` |
| 3 | Duplicate title across pages `M01-TITLE-DUPLICATE` | 🟨 medium | 119/120 | `/large/:n` |
| 4 | Page scrolls horizontally on the tested viewport `M07-HORIZONTAL-OVERFLOW` | 🟧 high | 5/5 | `/trap/*` |
| 5 | No mobile viewport meta tag `M01-VIEWPORT-MISSING` | 🟧 high | 5/5 | `/trap/*` |
| 6 | No GA4 tag or hit observed on this page `M04-GA4-NOT-OBSERVED` | 🟧 high | 10/10 | `/large/:n` |
| 7 | No GA4 tag or hit observed on this page `M04-GA4-NOT-OBSERVED` | 🟧 high | 5/5 | `/trap/*` |
| 8 | Missing meta description `M01-META-DESC-MISSING` | 🟨 medium | 11/120 | `/large/:n` |
| 9 | Tap targets smaller than 24×24 px `M07-SMALL-TAP-TARGETS` | 🟨 medium | 10/10 | `/large/:n` |
| 10 | Touch targets too small `M03-AXE-TARGET-SIZE` | 🟧 high | 2/2 | `/blog/*` |
| 11 | Touch targets too small `M03-AXE-TARGET-SIZE` | 🟧 high | 2/2 | `/products/*` |
| 12 | No main landmark `M03-AXE-LANDMARK-ONE-MAIN` | 🟨 medium | 5/5 | `/trap/*` |
| 13 | Content outside landmarks `M03-AXE-REGION` | 🟨 medium | 5/5 | `/trap/*` |
| 14 | Tap targets smaller than 24×24 px `M07-SMALL-TAP-TARGETS` | 🟨 medium | 5/5 | `/trap/*` |
| 15 | No call-to-action visible above the fold `M07-NO-CTA-ABOVE-FOLD` | 🟨 medium | 10/10 | `/large/:n` |

### MarTech signals

- GA4 was not observed on 16 tested pages — visits there may be missing from analytics (not observed in the tested flow).
- Ad pixel library loaded more than once: 1 page — reported numbers may be inflated.
- Trackers fired before any consent choice on 9 pages (indicator, not a legal determination).
- Tags observed on sampled pages: Google Analytics 4 (9/25), Google Tag Manager (9/25), LinkedIn Insight Tag (1/25), Meta Pixel (1/25), TikTok Pixel (1/25).
- 10 lead-form issue groups may add friction to conversions — treat as hypotheses to test.

<details><summary>Limitations</summary>

- Automated checks cannot establish legal compliance (privacy, consent, accessibility) or guarantee ranking, traffic or conversion outcomes.
- Performance numbers are Lighthouse lab measurements, not real-user field data.
- Tags gated behind consent, logins, ad blockers or later user actions may not be observed.
- 1 URL(s) were excluded by robots.txt and not audited.

</details>
