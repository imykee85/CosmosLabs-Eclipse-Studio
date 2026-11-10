import { test, expect } from "@playwright/test";

// Prompts: engine tabs are named plainly, "New chat" keeps the chat in History, History brings it back, and the chip row is icons.
test("Prompts keeps chats in History and the engine tabs have short names", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    localStorage.setItem("eclipse-first-tour", "1");
    localStorage.setItem("eclipse-welcome-offer", "1");
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0 } }));
  await page.route("**/api/prompts/chat", (r) => r.fulfill({ json: { text: "```\nA red cup on marble\n```" } }));
  await page.goto("/prompts");
  await expect(page.getByRole("tab", { name: "Seedance" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Kling" })).toBeVisible();
  await expect(page.locator(".pm-blurb")).toHaveText("Expert in helping you analyze images and write, improve, and structure prompts for AI image generation and editing.");
  // Ingredients is an icon only.
  await expect(page.getByRole("button", { name: "Ingredients" })).toHaveText("");
  await page.fill("textarea", "a red cup");
  await page.click(".pm-send");
  await expect(page.locator(".pm-block")).toContainText("A red cup on marble");
  await page.click("button[aria-label='New chat']");
  await expect(page.locator(".pm-msg")).toHaveCount(0);
  await page.click("button[aria-label='Chat history']");
  await expect(page.locator(".pm-past-row")).toHaveCount(1);
  await page.click(".pm-past-row > button:first-child");
  await expect(page.locator(".pm-block")).toContainText("A red cup on marble");
  // Opening it leaves no copy behind in the list (the blank chat had nothing to file).
  await page.click("button[aria-label='Chat history']");
  await expect(page.locator(".pm-past-row")).toHaveCount(0);
});
