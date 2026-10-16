# Rule reference

_Generated from rule metadata by `pnpm docs:rules` — do not edit by hand._

Confidence: **verified** = directly observed · **heuristic** = likely issue inferred from signals · **manual review** = needs human judgement.
Layer: **http** = every checked page · **browser** = pages in the browser sample · **site** = cross-page analysis.

## M01 — Technical SEO

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M01-HTTP-ERROR`<br>Page returns an HTTP error | high | verified | http | Error pages waste crawl budget, break user journeys and lose any ranking or campaign traffic they receive. |  |
| `M01-REDIRECT-CHAIN`<br>Redirect chain (more than one hop) | medium | verified | http | Each extra hop adds latency for visitors and can dilute signals passed to the final URL; campaign links through chains load slower. |  |
| `M01-TITLE-MISSING`<br>Missing or empty <title> | high | verified | http | The title is the headline searchers see in results and in browser tabs; without it search engines invent one. |  |
| `M01-TITLE-LENGTH`<br>Title length outside 15–60 characters | low | heuristic | http | Very long titles are truncated in results; very short ones rarely describe the page well. | Search engines truncate by pixel width, not characters; this is an approximation. |
| `M01-TITLE-MULTIPLE`<br>Multiple <title> elements | low | verified | http | Duplicate title tags are usually a template bug; search engines pick one unpredictably. |  |
| `M01-META-DESC-MISSING`<br>Missing meta description | medium | verified | http | The meta description is your ad copy in organic results. Without one, search engines pull arbitrary page text, which usually lowers click-through. |  |
| `M01-META-DESC-LENGTH`<br>Meta description length outside 50–160 characters | low | heuristic | http | Overlong descriptions are cut off; very short ones under-use the space. | Display length varies by device and query. |
| `M01-CANONICAL-MISSING`<br>No canonical link | low | verified | http | Canonical tags tell search engines which URL to index when parameters or tracking codes create variants. |  |
| `M01-CANONICAL-CROSS-HOST`<br>Canonical points to a different host | high | verified | http | A cross-domain canonical asks search engines to index another site's URL instead of this page — often a copy-paste or staging-domain bug. | Intentional for syndicated content; verify before changing. |
| `M01-CANONICAL-MULTIPLE`<br>Multiple canonical links | medium | verified | http | Conflicting canonicals are ignored by search engines. |  |
| `M01-NOINDEX-IN-SITEMAP`<br>Noindex page listed in the sitemap | high | verified | http | The sitemap says 'index this' while the page says 'do not index' — mixed signals that often hide an accidental noindex on a page you want found. |  |
| `M01-H1-MISSING`<br>No H1 heading | medium | verified | http | The H1 is the visible headline for people and a strong topical signal for search engines and screen readers. |  |
| `M01-H1-MULTIPLE`<br>Multiple H1 headings | low | verified | http | Several H1s blur the page's main message and its document outline. |  |
| `M01-HREFLANG-INVALID`<br>Invalid hreflang value | medium | verified | http | Search engines ignore hreflang annotations with invalid language/region codes, so the wrong language version may be shown. |  |
| `M01-JSONLD-INVALID`<br>Structured data (JSON-LD) does not parse | medium | verified | http | Broken JSON-LD is ignored entirely, so the page loses eligibility for rich results. | Only syntax is checked here, not schema.org vocabulary or rich-result eligibility. |
| `M01-VIEWPORT-MISSING`<br>No mobile viewport meta tag | high | verified | http | Without a viewport tag mobile browsers render a zoomed-out desktop page — poor UX and a mobile-friendliness failure. |  |
| `M01-TITLE-DUPLICATE`<br>Duplicate title across pages | medium | verified | site | Pages competing with identical titles confuse searchers and search engines about which page answers the query. |  |
| `M01-META-DESC-DUPLICATE`<br>Duplicate meta description across pages | low | verified | site | Templated descriptions make every result look the same and are often rewritten by search engines. |  |
| `M01-BROKEN-INTERNAL-LINK`<br>Links to broken internal URLs | high | verified | site | Broken links strand visitors mid-journey and waste crawl budget. |  |
| `M01-SITEMAP-NON-200`<br>Sitemap lists a URL that redirects or errors | medium | verified | site | Sitemaps should only list final, indexable URLs; non-200 entries reduce trust in the sitemap. |  |

## M02 — Performance

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M02-LH-PERFORMANCE`<br>Lighthouse lab performance score below 90 | medium | verified | browser | Slow pages lose visitors before they see your offer, and paid clicks are wasted on bounces. | Lighthouse lab data (simulated throttling) — not field Core Web Vitals; scores vary between runs. |
| `M02-LCP`<br>Slow Largest Contentful Paint (lab) | medium | verified | browser | LCP is when the main content appears; above 2.5 s visitors perceive the page as slow. | Lighthouse lab data (simulated throttling) — not field Core Web Vitals; scores vary between runs. |
| `M02-CLS`<br>Layout shift above 0.1 (lab) | medium | verified | browser | Content jumping around causes mis-clicks and frustration. | Lighthouse lab data (simulated throttling) — not field Core Web Vitals; scores vary between runs. |
| `M02-TBT`<br>High Total Blocking Time (lab) | medium | verified | browser | Long main-thread tasks make the page unresponsive to taps — often caused by heavy third-party tags. | Lighthouse lab data (simulated throttling) — not field Core Web Vitals; scores vary between runs. |
| `M02-PAGE-WEIGHT`<br>Heavy page (over 3 MB transferred) | low | verified | browser | Large pages are slow on mobile networks and cost visitors data. | Lighthouse lab data (simulated throttling) — not field Core Web Vitals; scores vary between runs. |
| `M02-RENDER-BLOCKING`<br>Render-blocking resources delay first paint | low | verified | browser | Scripts and styles that block rendering push back the moment anything appears. | Lighthouse lab data (simulated throttling) — not field Core Web Vitals; scores vary between runs. |

## M03 — Accessibility

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M03-AXE-IMAGE-ALT`<br>Images without alternative text | medium | verified | browser | Screen-reader users miss the content of images (offers, product shots); search engines also use alt text. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-LABEL`<br>Form inputs without labels | medium | verified | browser | Unlabelled fields are unusable with assistive technology and cause errors for everyone — directly costing leads. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-COLOR-CONTRAST`<br>Insufficient text colour contrast | medium | verified | browser | Low-contrast text is hard to read for many visitors, especially on mobile in sunlight. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-LINK-NAME`<br>Links without discernible text | medium | verified | browser | Icon-only or empty links are announced as 'link' with no destination. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-BUTTON-NAME`<br>Buttons without accessible names | medium | verified | browser | Users cannot tell what the button does — including your CTAs. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-HTML-HAS-LANG`<br>Page language not declared | medium | verified | browser | Screen readers may use the wrong pronunciation. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-DOCUMENT-TITLE`<br>Page has no title | medium | verified | browser | Users of tabs and assistive technology cannot identify the page. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-HEADING-ORDER`<br>Heading levels skipped | medium | verified | browser | Skipped levels break the outline that screen-reader users navigate by. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-LANDMARK-ONE-MAIN`<br>No main landmark | medium | verified | browser | Keyboard and screen-reader users cannot jump to the main content. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-REGION`<br>Content outside landmarks | medium | verified | browser | Content outside landmarks is harder to navigate with assistive technology. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-META-VIEWPORT`<br>Zoom disabled on mobile | medium | verified | browser | Blocking pinch-zoom prevents low-vision users from reading the page. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |
| `M03-AXE-TARGET-SIZE`<br>Touch targets too small | medium | verified | browser | Small targets cause mis-taps for users with motor impairments and on small screens. | Automated testing finds only a subset of accessibility barriers. Passing these checks is not WCAG conformance; manual and assistive-technology testing is required. |

Every other axe-core rule is reported dynamically as `M03-AXE-<RULE-ID>` with severity mapped from axe impact (critical/serious → high, moderate → medium, minor → low).

## M04 — GA4 / GTM

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M04-GA4-NOT-OBSERVED`<br>No GA4 tag or hit observed on this page | high | heuristic | browser | If GA4 does not load on a page, its visits and conversions are invisible in reporting — common on landing pages built outside the main template. | Not observed in the tested page load without consent interaction; tags gated behind consent, ad blockers or later events may exist. |
| `M04-GA4-PAGEVIEW-NOT-OBSERVED`<br>GA4 tag present but no page_view hit observed | medium | heuristic | browser | A loaded tag that never sends a page_view usually means a misconfigured config tag or a consent setup that suppresses all hits. | Not observed in the tested flow — consent mode may delay hits until consent is granted. |
| `M04-GA4-DUPLICATE-PAGEVIEW`<br>Duplicate GA4 page_view hits | high | verified | browser | Double-firing inflates sessions and page views and deflates engagement and conversion rates — decisions get made on wrong numbers. |  |
| `M04-GTM-MULTIPLE`<br>More than one GTM container | low | manual review | browser | Multiple containers are sometimes intentional (agency + in-house) but often cause duplicate tags and conflicting triggers. |  |
| `M04-GA4-MULTIPLE-IDS`<br>Multiple GA4 measurement IDs | low | manual review | browser | Sending to several GA4 properties can be deliberate (roll-up property) or a leftover from migrations that splits data. |  |
| `M04-DATALAYER-MISSING`<br>GTM present but dataLayer is empty | medium | heuristic | browser | Without dataLayer pushes GTM can only scrape the DOM, which makes conversion and attribution tracking fragile. |  |
| `M04-UA-LEGACY`<br>Legacy Universal Analytics code still present | low | verified | browser | Universal Analytics stopped processing data; legacy code adds page weight and confusion. |  |

## M05 — Ad tracking

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M05-PIXEL-DUPLICATE`<br>Ad pixel library loaded more than once | medium | verified | browser | Loading the same pixel twice commonly double-counts conversions, inflating reported ROAS and confusing bidding algorithms. | Observed in a single page load; event-level duplication may need a test conversion to confirm. |
| `M05-PIXEL-LOAD-FAILED`<br>Ad pixel library failed to load | low | heuristic | browser | A pixel that errors on load records nothing — campaigns optimise blind. | Live audits through the safety proxy may block some requests; confirm in a normal browser. |

## M06 — Lead forms

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M06-FIELD-NO-LABEL`<br>Form fields without an accessible label | high | verified | browser | Placeholder-only fields lose their hint as soon as users type, fail screen readers, and measurably increase form errors and abandonment. |  |
| `M06-EMAIL-TYPE`<br>Email field not using type="email" | medium | heuristic | browser | type=email shows the right mobile keyboard and gives free validation — fewer typos in captured leads. | Detected by field name/label containing 'email'. |
| `M06-PHONE-TYPE`<br>Phone field not using type="tel" | low | heuristic | browser | type=tel brings up the numeric keypad on mobile, reducing friction. |  |
| `M06-AUTOCOMPLETE-MISSING`<br>Contact fields missing autocomplete | low | heuristic | browser | Autofill can complete a lead form in one tap; without autocomplete hints browsers guess or do nothing. |  |
| `M06-PRECHECKED-OPTIN`<br>Marketing opt-in checkbox is pre-checked | high | heuristic | browser | Pre-ticked marketing consent is not valid consent under GDPR and many privacy laws, and erodes trust in your list. | Indicator only, not a legal determination. Detected by name/label keywords. |
| `M06-NOVALIDATE`<br>Form disables browser validation (novalidate) | low | manual review | browser | novalidate is fine when custom validation exists; otherwise bad data and silent failures get through. |  |
| `M06-NO-REQUIRED`<br>Lead form marks no field as required | low | heuristic | browser | Without required fields, empty or partial leads can be submitted and wasted. |  |
| `M06-TOO-MANY-FIELDS`<br>Long form (more than 8 visible fields) | low | heuristic | browser | Each extra field adds friction; long first-step forms typically convert worse. | A hypothesis to test, not a guaranteed uplift. |

## M07 — CRO / UX

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M07-NO-CTA-ABOVE-FOLD`<br>No call-to-action visible above the fold | medium | heuristic | browser | If visitors cannot see what to do next without scrolling, many leave — especially paid traffic landing on mobile. | CTAs are detected by text/class heuristics; a testable hypothesis, not a proven conversion problem. |
| `M07-TOO-MANY-CTAS`<br>Many competing CTAs above the fold | low | heuristic | browser | Too many equally weighted actions dilute focus (choice overload). | Hypothesis for testing. |
| `M07-HORIZONTAL-OVERFLOW`<br>Page scrolls horizontally on the tested viewport | high | verified | browser | Sideways scrolling on mobile feels broken and hides content and CTAs. |  |
| `M07-SMALL-TAP-TARGETS`<br>Tap targets smaller than 24×24 px | medium | verified | browser | Small links and buttons cause mis-taps on mobile (WCAG 2.2 SC 2.5.8 target size minimum). |  |

## M08 — Privacy / consent

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M08-TRACKING-BEFORE-CONSENT`<br>Marketing/analytics requests fire before consent | high | heuristic | browser | A consent banner is shown, but trackers send data before the visitor chooses — the banner is not actually controlling tags. | Privacy indicator, not a legal or compliance determination. Requirements differ by jurisdiction (GDPR, ePrivacy, DPDP, CCPA); consult a privacy specialist. |
| `M08-NO-CONSENT-BANNER`<br>Trackers present but no consent banner detected | medium | heuristic | browser | Where consent is required, loading marketing tags with no visible choice is a common compliance risk. | Privacy indicator, not a legal or compliance determination. Requirements differ by jurisdiction (GDPR, ePrivacy, DPDP, CCPA); consult a privacy specialist. Custom banners may not be recognised. |
| `M08-COOKIES-BEFORE-CONSENT`<br>Tracking cookies set before consent | medium | heuristic | browser | Analytics/advertising cookies written on first load, before any choice, undermine the consent banner. | Privacy indicator, not a legal or compliance determination. Requirements differ by jurisdiction (GDPR, ePrivacy, DPDP, CCPA); consult a privacy specialist. |
| `M08-PRECHECKED-OPTIONS`<br>Consent banner has pre-checked optional categories | medium | verified | browser | Pre-ticked boxes are not considered freely given consent in many regimes. | Privacy indicator, not a legal or compliance determination. Requirements differ by jurisdiction (GDPR, ePrivacy, DPDP, CCPA); consult a privacy specialist. |
| `M08-NO-REJECT-OPTION`<br>No reject option on the first banner layer | low | heuristic | browser | Making 'reject' harder than 'accept' is a dark pattern regulators increasingly act on. | Privacy indicator, not a legal or compliance determination. Requirements differ by jurisdiction (GDPR, ePrivacy, DPDP, CCPA); consult a privacy specialist. |

## M09 — Content

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M09-THIN-CONTENT`<br>Thin main content | low | heuristic | http | Pages with very little unique main content struggle to rank and rarely answer a visitor's question fully. | Threshold is 150 words of main content; some pages (contact, tools) are legitimately short. |
| `M09-LANG-MISSING`<br>Missing <html lang> attribute | medium | verified | http | The lang attribute tells screen readers how to pronounce text and helps search engines and translators. |  |
| `M09-EXACT-DUPLICATE`<br>Main content identical to another page | medium | verified | site | Identical pages split authority and confuse search engines about which to show. |  |
| `M09-NEAR-DUPLICATE`<br>Main content nearly identical to another page | low | heuristic | site | Near-copies (templated or lightly edited pages) compete with each other and add little for visitors. | Similarity is an estimated Jaccard index ≥ 0.8 over word 3-shingles of main content (MinHash); review before merging. |
| `M09-BROKEN-IMAGE`<br>Images fail to load | medium | verified | browser | Broken images look unprofessional and remove information (pricing charts, product shots) from the page. |  |

## M10 — Architecture

| Rule | Severity | Confidence | Layer | Why it matters | Caveat |
|---|---|---|---|---|---|
| `M10-ORPHAN-SITEMAP`<br>Sitemap page with no internal links | medium | heuristic | site | Pages only reachable from the sitemap get little internal authority and are invisible to visitors browsing the site — common with campaign landing pages. | Orphan status is relative to the pages crawled in this audit; links from uncrawled pages are not known. |
| `M10-DEEP-PAGE`<br>Page is more than 3 clicks from the start URL | low | heuristic | site | Deeply buried pages are crawled less often and are harder for visitors to find. | Click depth is measured over links found in this audit. |
| `M10-NOT-IN-SITEMAP`<br>Indexable page missing from the sitemap | low | heuristic | site | Sitemaps help search engines discover and prioritise pages; omissions often reveal stale sitemap generation. |  |

## Tag signatures (M04/M05/M08)

| Vendor | Category | Library pattern | Hit pattern |
|---|---|---|---|
| Google Tag Manager | tag manager | `googletagmanager\.com\/gtm\.js` | — |
| Google Analytics 4 | analytics | `googletagmanager\.com\/gtag\/js\?id=G-` | `(google-analytics\.com|analytics\.google\.com)\/g\/collect`<br>`\/g\/collect\?.*tid=G-` |
| Universal Analytics (legacy) | analytics | `google-analytics\.com\/analytics\.js`<br>`google-analytics\.com\/ga\.js` | `google-analytics\.com\/(r\/)?collect\?.*tid=UA-` |
| Google Ads | advertising | `googletagmanager\.com\/gtag\/js\?id=AW-`<br>`googleadservices\.com\/pagead\/conversion\.js` | `googleadservices\.com\/pagead\/conversion`<br>`googleads\.g\.doubleclick\.net\/pagead`<br>`google\.com\/pagead\/1p-conversion` |
| Google Floodlight / DV360 | advertising | — | `fls\.doubleclick\.net`<br>`ad\.doubleclick\.net\/activity` |
| Meta Pixel | advertising | `connect\.facebook\.net\/[^/]+\/fbevents\.js` | `facebook\.com\/tr[/?]` |
| LinkedIn Insight Tag | advertising | `snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js` | `px\.ads\.linkedin\.com`<br>`linkedin\.com\/px` |
| TikTok Pixel | advertising | `analytics\.tiktok\.com\/i18n\/pixel\/events\.js` | `analytics\.tiktok\.com\/api\/v2\/pixel` |
| X (Twitter) Pixel | advertising | `static\.ads-twitter\.com\/uwt\.js` | `analytics\.twitter\.com`<br>`t\.co\/i\/adsct` |
| Microsoft Advertising UET | advertising | `bat\.bing\.com\/bat\.js` | `bat\.bing\.com\/action` |
| Pinterest Tag | advertising | `s\.pinimg\.com\/ct\/core\.js` | `ct\.pinterest\.com` |
| Snap Pixel | advertising | `sc-static\.net\/scevent\.min\.js` | `tr\.snapchat\.com` |
| Hotjar | session replay | `static\.hotjar\.com` | `hotjar\.(com|io)\/api` |
| Microsoft Clarity | session replay | `clarity\.ms\/tag` | `\.clarity\.ms\/collect` |
