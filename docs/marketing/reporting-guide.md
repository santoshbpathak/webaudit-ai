# Reporting to stakeholders

WebAudit AI produces several outputs from the same audit. Every number in them can be traced back to evidence.

## Exports (Export tab, or CLI `--out`)

| File                            | Best for                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTML report** (`report.html`) | Sharing with stakeholders. One self-contained file with no scripts. It has an executive summary, MarTech signals, priorities, category results and methodology |
| **CSV** (`findings.csv`)        | Spreadsheets and ticket imports. One row per failing finding, with URL, rule, severity, confidence and evidence                                                |
| **JSON** (`report.json`)        | Developers, dashboards, automation                                                                                                                             |
| **Markdown** (`summary.md`)     | Pasting into tickets, wikis, pull requests and GitHub job summaries                                                                                            |

> Exported reports contain excerpts of the audited pages. Treat them as you would the site's content, and don't post client reports publicly without permission.

## The executive summary

The summary at the top of the report and the Overview is **deterministic**. The same audit always gives the same text. It contains:

- a headline: issue groups, pages affected, how many are high or critical
- scope: URLs checked vs discovered, robots.txt blocks, skips, the browser sample size
- top priorities, with template and confidence
- MarTech signals: GA4 coverage, pixel duplicates, consent indicators, form friction

**Optional AI narrative.** With AI enabled, you can generate an executive summary or a 30-day roadmap in plainer business language. It is labelled **AI suggestion**, every statement cites issue ids, and you see exactly what is sent before you confirm. Treat it as a draft to edit.

## How to present results

1. **Lead with scope.** "We checked 139 pages, 25 in a real browser." This sets expectations and pre-empts "is the whole site broken?".
2. **Group by owner, not by tool category.**
   - Developers: templates, redirects, canonicals, components
   - Analytics: tags, dataLayer
   - Content: titles, descriptions, thin pages
   - Privacy and legal: consent indicators
3. **Use template counts.** "Fixing the product template resolves 4 issue groups across 119 pages" is clearer than 476 warnings.
4. **Show confidence.** Separate _Confirmed_ items from _Potential_ items that need a quick check.
5. **Avoid promises.** Say "removes a known obstacle to indexing", not "will increase traffic by X%". Say "consent indicator to review with legal", not "we are non-compliant".

## Tracking progress

Re-run the audit with the **same scope** and use **Compare** (History → Compare). It shows new, resolved and _not re-tested_ issues, and warns you when the two audits used different scopes or samples.
