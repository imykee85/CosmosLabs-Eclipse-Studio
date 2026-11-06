import { test, expect, type Page } from "@playwright/test";

// Core's message box on a phone: a video attached shows as a tile in the top row (like a picture); the first three controls are + , mic and Ingredients (icon);
// Send always stays inside the box.
async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0, models: [] } }));
}

test.describe("Core message box", () => {
  test.use({ viewport: { width: 520, height: 900 }, screen: { width: 390, height: 844 }, isMobile: true });

  test("+, mic and Ingredients come first, and Send stays inside the box", async ({ page }) => {
    await seed(page);
    await page.goto("/connect");
    const box = page.locator(".cn-box");
    await expect(box).toBeVisible();
    const tools = page.locator(".cn-tools > .cn-round, .cn-tools > .cn-tools-more > *");
    const first = await page.locator(".cn-tools > button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(first.slice(0, 3)).toEqual(["Add a file", "Voice input", expect.stringMatching(/^Ingredients/)]);
    const boxBox = await box.boundingBox();
    const sendBox = await page.locator(".cn-send").boundingBox();
    expect(boxBox && sendBox).toBeTruthy();
    expect(sendBox!.x + sendBox!.width).toBeLessThanOrEqual(boxBox!.x + boxBox!.width + 0.5);
    expect(sendBox!.x).toBeGreaterThanOrEqual(boxBox!.x);
    expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(boxBox!.y + boxBox!.height + 0.5);
    expect(await tools.count()).toBeGreaterThan(0);
  });
});
