import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Read-only checks against the committed demo audits. */

async function latestAudit(page: Page): Promise<string> {
  const r = await page.request.get("/api/audits");
  const { audits } = (await r.json()) as { audits: { id: string }[] };
  return audits[0]!.id;
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Playwright's own frame instrumentation is refused by the sandboxed report iframe; not an app error.
  page.on(
    "console",
    (m) => m.type() === "error" && !m.text().includes("frame is sandboxed") && errors.push(m.text()),
  );
  return errors;
}

test("every audit section renders and navigates without errors", async ({ page }) => {
  const errors = collectErrors(page);
  const id = await latestAudit(page);
  await page.goto(`/audits/${id}`);
  await expect(page.getByRole("heading", { level: 2, name: /issues|failing/i }).first()).toBeVisible();
  for (const [tab, check] of [
    ["Issues", page.getByRole("table", { name: /issue types/i })],
    ["Pages", page.getByRole("table", { name: /discovered urls/i })],
    ["Categories", page.getByRole("link", { name: /technical seo/i }).first()],
    ["Recommendations", page.getByRole("table", { name: /remediation backlog/i })],
    ["Export", page.getByTitle("HTML report preview")],
    ["Overview", page.getByText("Scope & coverage")],
  ] as const) {
    await page
      .getByRole("navigation", { name: "Audit sections" })
      .getByRole("link", { name: new RegExp(`^${tab}`) })
      .click();
    await expect(check).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("issue explorer filters are reflected in the URL and the evidence sheet loads findings", async ({
  page,
}) => {
  const id = await latestAudit(page);
  await page.goto(`/audits/${id}/issues`);
  const rows = page.getByRole("table", { name: /issue types/i }).locator("tbody tr");
  const before = await rows.count();
  await page.getByRole("button", { name: /^High/ }).click();
  await expect(page).toHaveURL(/severity=high/);
  await expect.poll(() => rows.count()).toBeLessThan(before);

  await page.keyboard.press("/");
  await expect(page.getByLabel("Search issues")).toBeFocused();
  await page.getByLabel("Search issues").fill("consent");
  await expect(page).toHaveURL(/q=consent/);

  await rows.first().getByRole("button").last().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Why it matters")).toBeVisible();
  await expect(sheet.locator("article").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("page inspector opens from the URL explorer", async ({ page }) => {
  const id = await latestAudit(page);
  await page.goto(`/audits/${id}/pages?sort=failures`);
  await page
    .getByRole("table", { name: /discovered urls/i })
    .locator("tbody tr a")
    .first()
    .click();
  await expect(page.getByText("Technical summary")).toBeVisible();
  await expect(page.getByText(/Issues on this page/)).toBeVisible();
});

test("theme toggle persists across navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: /toggle light and dark/i })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/history");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("demo mode disables scanning", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start audit" })).toBeDisabled();
  const r = await page.request.post("/api/audits", { data: { url: "https://example.com" } });
  expect(r.status()).toBe(403);
});

for (const theme of ["dark", "light"] as const) {
  test(`key screens have no serious axe violations (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const id = await latestAudit(page);
    for (const path of [
      "/",
      `/audits/${id}`,
      `/audits/${id}/issues`,
      `/audits/${id}/pages`,
      `/audits/${id}/recommendations`,
      "/history",
    ]) {
      await page.goto(path);
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .exclude("iframe")
        .analyze();
      const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
    }
  });
}
