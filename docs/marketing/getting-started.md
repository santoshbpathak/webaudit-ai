# Getting started (for marketers)

This guide takes you from installation to your first useful audit. You don't need to be a developer, but you will paste a few commands into a terminal once.

## 1. Install (one time, about 10 minutes)

You need **Node.js 22.19 or newer**. Download the LTS installer from nodejs.org. Then open a terminal and run:

```bash
corepack enable
git clone https://github.com/santoshbpathak/webaudit-ai.git
cd webaudit-ai
pnpm install --frozen-lockfile
pnpm --filter @webaudit/browser exec playwright install chromium
```

If something fails, run `pnpm webaudit doctor`. It checks every requirement and tells you what to fix. More help: [installation and troubleshooting](../development/installation.md).

## 2. Start the app

```bash
pnpm dev
```

Open **http://127.0.0.1:3000** in your browser. Everything runs on your computer. Nothing is uploaded anywhere.

## 3. Try the demo site first

WebAudit AI ships with **Fernhill Finance**, a made-up website with deliberate problems. Start it in a second terminal:

```bash
pnpm fixture
```

The app blocks private addresses by default, so start the app with the demo host allowed:

```bash
WEBAUDIT_ALLOW_PRIVATE_HOSTS=127.0.0.1 pnpm dev
```

In the app, enter `http://127.0.0.1:4100/`, choose **Smart**, and click **Start audit**. You can watch the crawl live, and it finishes in about a minute.

## 4. Audit your own site

Enter your homepage URL and pick a mode:

| Mode                | When to use it                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Quick**           | One page: a campaign landing page, or checking a fix                                                      |
| **Smart** (default) | A routine audit of up to 500 pages. Browser checks run on a representative sample (one page per template) |
| **Deep**            | Before a launch or migration. Browser checks on every page; much slower                                   |

**Tips:**

- Start with **Smart**.
- Use **Device** to switch between mobile (default) and desktop.
- Open **Advanced crawler controls** to limit the crawl to a section (for example `/blog/*`) or exclude paths.
- WebAudit AI respects robots.txt and waits between requests. Please only audit sites you own or are allowed to test.

## 5. Read the results

1. **Overview**: what was covered, the top priorities, and MarTech signals (analytics, pixels, consent).
2. **Issues**: every issue type, with filters by severity, category and confidence. Click a row for the evidence.
3. **Pages**: which pages have the most issues. Click a page to inspect it.
4. **Categories**: checks passed out of checks evaluated, for each area.
5. **Recommendations**: the prioritised to-do list with effort estimates.
6. **Export**: an HTML report for stakeholders, plus CSV, JSON and Markdown.

Next: [Understanding findings](understanding-findings.md) · [Understanding scores](understanding-scores.md) · [Reporting to stakeholders](reporting-guide.md).

## What WebAudit AI does not do

- It doesn't log in, fill in forms, or click through checkout.
- It doesn't certify legal compliance (GDPR, ePrivacy, ADA/WCAG) or promise rankings or conversions.
- It sees what an anonymous first-time visitor sees on one page load per sampled page.
