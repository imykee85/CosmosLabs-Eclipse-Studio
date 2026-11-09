import { test, expect, type Page } from "@playwright/test";

// Owner 2026-11-09: a free account could open the crowned collections and Motion graphics from the dashboard. Everything below the projects (except the tools
// section) is for Growth and Scale: on Free or Starter a click opens the upgrade pop-up, even when the plan arrives late.
async function seed(page: Page, plan: string, delayMs = 0) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-first-tour", "1"); localStorage.setItem("eclipse-welcome-offer", "1"); // the first-run pop-ups have been seen
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], entries: [], balance: 0, models: [], projects: [] } }));
  await page.route("**/api/access", async (r) => { if (delayMs) await new Promise((res) => setTimeout(res, delayMs)); await r.fulfill({ json: { plan, features: [], admin: false, gating: true } }); });
}

const targets = [
  ["an Explore card", 'a[aria-label="Portraits"]'],
  ["a video library card", 'a[aria-label="Filmmaking"]'],
  ["Motion graphics", 'a[aria-label="Motion graphics"]'],
  ["a Looks card", 'a[aria-label="Photography"]'],
] as const;

test.describe("premium cards on the dashboard", () => {
  for (const plan of ["free", "starter"]) {
    for (const [name, sel] of targets) {
      test(`on ${plan}, ${name} opens the upgrade pop-up and stays on the dashboard`, async ({ page }) => {
        await seed(page, plan);
        await page.goto("/dashboard");
        const card = page.locator(sel).first();
        await card.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500); // the plan has arrived
        await card.click({ force: true });
        await expect(page.getByRole("alertdialog")).toContainText("Premium collections are included in the Growth and Scale plans.");
        await expect(page).toHaveURL(/\/dashboard/);
      });
    }
    test(`on ${plan}, "Discover all videos" opens the upgrade pop-up`, async ({ page }) => {
      await seed(page, plan);
      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Discover all videos" }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Discover all videos" }).click();
      await expect(page.getByRole("alertdialog")).toContainText("Premium collections");
      await expect(page).toHaveURL(/\/dashboard/);
    });
  }

  test("a click before the plan has arrived waits for it, and still stops a free account", async ({ page }) => {
    await seed(page, "free", 1500);
    await page.goto("/dashboard");
    const card = page.locator('a[aria-label="Portraits"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.click({ force: true }); // well before the plan answer
    await expect(page.getByRole("alertdialog")).toContainText("Premium collections", { timeout: 8000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("on Growth the same click opens the collection", async ({ page }) => {
    await seed(page, "growth");
    await page.goto("/dashboard");
    const card = page.locator('a[aria-label="Portraits"]').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await card.click({ force: true });
    await expect(page).toHaveURL(/\/collections\/portraits/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("without sign-in configured (preview), the premium pages load and show no lock screen", async ({ page }) => {
    await seed(page, "free");
    for (const path of ["/collections/portraits", "/motion"]) {
      await page.goto(path);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByText("Upgrade to open it")).toHaveCount(0);
    }
  });

  test("the tools section stays open to everyone", async ({ page }) => {
    await seed(page, "free");
    await page.goto("/dashboard");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Discover all tools" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Discover all tools" }).click();
    await expect(page).toHaveURL(/\/tools/);
  });
});
