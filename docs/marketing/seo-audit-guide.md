# SEO audit guide

This guide covers three modules: **M01 Technical SEO**, **M09 Content** and **M10 Architecture**. M01 and M09 checks run on **every checked page** over HTTP, so they are not sampled. Site-level checks compare pages with each other.

## What is checked

| Area               | Rules (severity · confidence)                                                                                                                                                                        | Why it matters to marketers                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Status & redirects | HTTP error (high · confirmed), redirect chain > 1 hop (medium · confirmed), sitemap URL redirects or errors (medium · confirmed)                                                                     | Error pages lose campaign and organic traffic; chains slow every click from ads and emails |
| Titles             | missing (high), multiple (low), duplicate across pages (medium) — confirmed; length outside 15–60 chars (low · potential)                                                                            | The title is your headline in search results and browser tabs                              |
| Meta descriptions  | missing (medium), duplicate (low) — confirmed; length outside 50–160 (low · potential)                                                                                                               | Your organic "ad copy"; missing ones get replaced with arbitrary text                      |
| Canonicals         | missing (low), multiple (medium), points to another host (high) — confirmed                                                                                                                          | A staging-domain canonical can ask search engines to index the wrong site                  |
| Indexing           | noindex page listed in sitemap (high · confirmed)                                                                                                                                                    | Often an accidental noindex on a page you want found                                       |
| Headings           | no H1 (medium), multiple H1 (low) — confirmed                                                                                                                                                        | Clear page headline for people and search engines                                          |
| International      | invalid hreflang code (medium · confirmed)                                                                                                                                                           | Wrong language versions shown to searchers                                                 |
| Structured data    | JSON-LD does not parse (medium · confirmed)                                                                                                                                                          | Broken markup is ignored, so the page loses rich-result eligibility                        |
| Mobile             | no viewport meta tag (high · confirmed)                                                                                                                                                              | Mobile visitors see a zoomed-out desktop page                                              |
| Links              | links to broken internal URLs (high · confirmed)                                                                                                                                                     | Visitors are stranded mid-journey                                                          |
| Content (M09)      | thin main content (low · potential), missing `lang` (medium · confirmed), exact duplicate (medium · confirmed), near-duplicate (low · potential), broken images (medium · confirmed, browser sample) | Duplicate and thin pages compete with each other                                           |
| Architecture (M10) | sitemap page with no internal links (medium · potential), more than 3 clicks deep (low · potential), indexable page missing from sitemap (low · potential)                                           | Hard-to-reach pages get less attention from visitors and crawlers                          |

## How to interpret results

- **Template-level issues first.** "Missing meta description on 119 pages (/products/:slug)" is one fix in the product template.
- **Confirmed vs potential.** Length and thin-content rules are approximations. Search engines truncate by pixel width, not characters.
- **JSON-LD** is checked for syntax only, not schema.org vocabulary or rich-result eligibility. Use Google's Rich Results Test for that.
- **Orphans and click depth** are relative to what was crawled. If the crawl was limited by a page cap or a path filter, some "orphans" may be linked from uncrawled pages.

## When to involve a developer

Canonicals, redirects, viewport, hreflang and template titles are code or CMS-configuration changes. Copy fixes (titles, descriptions, thin content) can usually be done in the CMS by marketing.

## What automated checks cannot verify

- Keyword relevance, search intent, content quality and E-E-A-T
- Backlinks, rankings and Search Console coverage
- Whether search engines actually indexed or ranked a page

## Prioritising

1. Broken pages and links on high-traffic or campaign URLs
2. Indexing conflicts (noindex in sitemap, cross-host canonicals)
3. Template-level title, description and H1 issues
4. Duplicates and architecture

Fixing these removes known obstacles. It does not guarantee ranking changes.
