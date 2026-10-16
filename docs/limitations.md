# Limitations

- **Indicators, not determinations.** Privacy/consent findings are not legal advice or compliance certification (GDPR, ePrivacy, DPDP, CCPA). Accessibility findings cover what axe-core can detect automatically — not WCAG conformance.
- **Lab, not field.** Performance numbers are Lighthouse lab runs with simulated throttling. They vary between runs and differ from real-user Core Web Vitals.
- **Observed in the tested flow.** Tags are observed during one page load per sampled page (plus after accepting consent). Tags behind logins, later events, user actions, consent rejections or ad blockers may be missed; "not observed" is not "absent site-wide".
- **Sampling.** In smart mode, browser checks run on a stratified sample. Findings show their tested denominator; unsampled pages are reported as not tested.
- **Discovery.** Only URLs linked from crawled pages or listed in sitemaps are found. Orphans are relative to what was crawled. JavaScript-only links require `renderDiscovery`.
- **Heuristics.** CTA detection, consent-banner detection and form intent use keyword and structure heuristics and are labelled heuristic; custom banners may not be recognised.
- **No authenticated crawling, form submission or transactions.**
- **Recommendations are hypotheses** — no ranking, traffic or conversion outcome is promised.
