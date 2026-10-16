# Analytics and ad-pixel audit guide

This covers **M04 GA4 / GTM** and **M05 Ad pixels**. They are browser checks: WebAudit AI loads each sampled page in Chromium, records network requests and the dataLayer, accepts the consent banner when it finds one, and records again.

## What is checked

### M04: GA4 and Google Tag Manager

| Rule                                    | Severity · confidence | Meaning                                                                                |
| --------------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| No GA4 tag or hit observed              | high · potential      | No GA4 library or collect request seen on this page, before or after accepting consent |
| GA4 tag present but no `page_view`      | medium · potential    | The library loads but no page_view hit was observed                                    |
| Duplicate GA4 `page_view`               | high · confirmed      | Two or more page_view hits on one load: sessions and conversion rates are distorted    |
| More than one GTM container             | low · manual review   | May be intentional (separate teams), or a leftover                                     |
| Multiple GA4 measurement IDs            | low · manual review   | May be intentional (roll-up property), or a misconfiguration                           |
| GTM present but dataLayer empty         | medium · potential    | Triggers that depend on dataLayer events may never fire                                |
| Legacy Universal Analytics code present | low · confirmed       | Dead code that adds weight and confusion                                               |

### M05: Ad pixels

**Pixels detected by script and network signatures:** Meta, Google Ads, LinkedIn Insight, TikTok, X, Microsoft UET, Pinterest, Snap.

| Rule                                | Severity · confidence | Meaning                                       |
| ----------------------------------- | --------------------- | --------------------------------------------- |
| Pixel library loaded more than once | medium · confirmed    | Reported events and audiences may be inflated |
| Pixel library failed to load        | low · potential       | Conversions from this page may be missing     |

The Overview and the report also list **which tags were observed on how many tested pages**, for example "Google Analytics 4 (9/25)". This is a quick way to spot templates without tracking.

## Why it matters to marketers

Budget decisions rest on this data:

- missing tags under-report channels
- duplicate page_views inflate sessions and deflate conversion rates
- broken pixels starve ad platforms of conversion signals

## How to interpret results

- **"Not observed in the tested flow"** is deliberate wording. The tool saw one page load per sampled page, plus a consent click. Tags that fire later (scroll, click, timers), behind logins, after a consent _rejection_, or only server-side may not be seen.
- An ad blocker or bot protection on the site can block tags for automated browsers.
- A **template pattern** is a strong signal. If GA4 is missing on every `/blog/*` page but present elsewhere, check that template's tag configuration.

## What automated checks cannot verify

- Whether events reach GA4 reports correctly: filters, data streams, processing
- Event parameters, conversions and e-commerce data quality
- Server-side tagging and Measurement Protocol
- Attribution settings and ad-platform configuration

## When to involve someone

| Situation                                 | Who                                                           |
| ----------------------------------------- | ------------------------------------------------------------- |
| Duplicate page_views, container conflicts | Analytics or tag-management owner (GTM workspace, GA4 config) |
| Missing tags on a template                | Developer or CMS owner                                        |
| Pixel failures                            | Ad-ops plus a developer (CSP, blockers, script errors)        |

## Prioritising

1. Duplicate page_views and missing GA4 on high-traffic templates. These distort reports today.
2. Pixel duplicates or failures on conversion pages.
3. Configuration hygiene: multiple IDs or containers, legacy UA.
