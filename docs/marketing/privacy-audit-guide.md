# Privacy and consent UX audit guide

This covers **M08 Consent** and the consent-related part of **M06 Lead forms**.

> Results are **indicators for review, not legal determinations**. WebAudit AI is not legal advice and does not certify compliance with GDPR, ePrivacy, CCPA, DPDP or any other law. Involve your privacy or legal team before drawing conclusions.

## How it works

On each sampled page, WebAudit AI:

1. Loads the page as a first-time visitor with no cookies.
2. Records network requests, cookies (names, domains and flags only; never values) and storage _before_ any interaction.
3. Detects a consent banner. It recognises common CMPs (OneTrust, Cookiebot, Usercentrics and others) plus generic patterns.
4. Clicks the banner's **accept** button and records what changes.

It never clicks reject, never changes settings inside the banner, and never submits forms.

## What is checked

| Rule                                             | Severity · confidence | What it indicates                                                                                      |
| ------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------ |
| Marketing/analytics requests fire before consent | high · potential      | Trackers sent data before the visitor made a choice. Google Consent Mode "denied" pings are recognised |
| Tracking cookies set before consent              | medium · potential    | Known tracking cookies existed before any choice                                                       |
| Trackers present but no consent banner detected  | medium · potential    | Tracking with no visible consent mechanism, or a banner the tool didn't recognise                      |
| Banner has pre-checked optional categories       | medium · confirmed    | Optional categories are switched on by default                                                         |
| No reject option on the first layer              | low · potential       | Rejecting is harder than accepting                                                                     |
| M06: marketing opt-in checkbox pre-checked       | high · potential      | A form subscribes visitors by default                                                                  |

## Why it matters to marketers

Consent UX affects legal exposure, brand trust and data quality:

- data collected without valid consent may need to be deleted
- regulators and browsers increasingly scrutinise dark patterns

## Common false positives

- Strictly necessary or consent-exempt services (some fraud-prevention or load-balancing cookies) classified as tracking
- Custom banners that the heuristics don't recognise
- Consent stored from a previous region-specific flow (the tool always starts clean)
- Region-based banners: the tool sees the version served to its own location

## What automated checks cannot verify

- Whether a legal basis other than consent applies
- Whether the privacy policy and banner text are accurate
- Behaviour after **rejecting**, or after changing preferences
- Server-side data flows, data retention and vendor contracts

## When to involve someone

| Finding                                                    | Who                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Trackers before consent, cookies before consent            | Developer or tag owner (consent-mode and CMP integration), then the privacy team for review |
| Pre-checked categories, missing reject, pre-ticked opt-ins | Privacy or legal plus the CMP/form owner                                                    |

## Prioritising

1. Pre-ticked marketing opt-ins and trackers firing before consent on high-traffic pages
2. Banner design issues: pre-checked categories, missing reject option
3. Cookie hygiene
