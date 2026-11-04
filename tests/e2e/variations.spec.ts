import { expect, test, type Page } from "@playwright/test";

// Variations in Image Studio (preview mode, every API answered by a mock): the tray chip opens its own panel, the controls follow the brief's rules,
// and a run makes one render per cell, follows them, then offers the contact sheet.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const model = { id: "m", label: "Editor", blurb: "x", ratios: ["1:1", "16:9", "4:3"], resolutions: ["2k"], maxBatch: 4, maxPrompt: 2000, verified: true, autoPick: true, seed: { supported: true, min: 1, max: 1000000 }, maxReferences: 4, requiresReference: false, prices: { "2k": 40 }, batch: 1 };
const done = (id: string) => ({ id, prompt: "a street", model: "m", modelLabel: "Editor", fileName: `${id}.png`, contentType: "image/png", sizeBytes: 1, width: 1, height: 1, resolution: "2k", projectId: "p1", aspectRatio: "1:1", seed: 1, seedLocked: false, references: null, status: "completed", error: null, imageUrl: `/api/generations/${id}/file`, kind: "image", durationSec: null, hasAudio: null, credits: null, startedAt: null, createdAt: new Date().toISOString(), deletedAt: null });

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const sent: string[] = [];
  let n = 0;
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [model] } }));
  await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 100, charging: true, isAdmin: false, history: [], freeImages: 0 } }));
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [done("src1")] } }));
  await page.route(/\/api\/generations\/[^/?]+\/(file|thumb)/, (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
  await page.route(/\/api\/generations\/(c\d|sheet1)$/, (r) => r.fulfill({ json: done(r.request().url().split("/").pop()!) }));
  await page.route("**/api/generate", (r) => { sent.push(JSON.parse(r.request().postData() || "{}").prompt); r.fulfill({ json: { id: `c${++n}` } }); });
  await page.route("**/api/variations/sheet", (r) => r.fulfill({ json: { id: "sheet1" } }));
  return sent;
}

// the tool tray appears once a finished picture is showing in the preview: click the latest one in the history row
async function openChip(page: Page) {
  await page.goto("/create");
  await page.locator('[aria-label="Your five most recent renders"] button').first().click();
  const chip = page.locator(".cr-tray button", { hasText: "Variations" });
  await expect(chip).toBeVisible({ timeout: 15000 });
  await chip.click();
  return page.getByRole("dialog", { name: "Variations" });
}

test.describe("Variations", () => {
  test("its own chip opens its own panel; Reframe holds one view per cell", async ({ page }) => {
    await setup(page);
    const panel = await openChip(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("tab")).toHaveText(["Reframe", "Storyboard", "People", "Custom"]);
    await expect(panel.locator(".cr-vars-count span").first()).toHaveText("4/4"); // 2x2: four views ticked
    await expect(panel.locator('.cr-vars-checks input:not(:checked)').first()).toBeDisabled(); // untick one first
    await panel.locator('.cr-vars-checks input:checked').first().uncheck();
    await expect(panel.locator(".cr-vars-count span").first()).toHaveText("3/4");
    await expect(panel.locator(".cr-var-err")).toContainText("Choose 4 perspectives");
    await panel.getByLabel("Grid").selectOption("3x3");
    await expect(panel.locator(".cr-vars-count span").first()).toHaveText("9/9");
  });

  test("People needs the consent tick; Storyboard counts scenes", async ({ page }) => {
    await setup(page);
    const panel = await openChip(page);
    await panel.getByRole("tab", { name: "People" }).click();
    await panel.getByRole("tab", { name: "Age" }).click();
    await expect(panel.getByText(/Adult ages only/)).toBeVisible();
    await expect(panel.locator(".cr-var-err")).toContainText("Confirm the picture is yours");
    await expect(panel.locator(".gen-btn")).toBeDisabled();
    await panel.locator(".cr-vars-consent input").check();
    await expect(panel.locator(".gen-btn")).toBeEnabled();
    await panel.getByRole("tab", { name: "Storyboard" }).click();
    await panel.getByLabel("Auto").uncheck();
    await panel.locator("textarea").fill("Scene 1: a\nScene 2: b\nScene 3: c");
    await expect(panel.locator(".cr-var-err")).toContainText("needs 4 scenes and you wrote 3");
  });

  test("a Custom run makes one render per cell, follows them and offers the sheet", async ({ page }) => {
    const sent = await setup(page);
    const panel = await openChip(page);
    await panel.getByRole("tab", { name: "Custom" }).click();
    await panel.locator("textarea").fill("this street in spring, summer, autumn and winter");
    await expect(panel.locator(".gen-btn")).toContainText("16"); // 4 cells at 4 credits
    await panel.locator(".gen-btn").click();
    await expect(panel.locator(".cr-vars-cell")).toHaveCount(4);
    await expect(panel.locator(".cr-vars-cell img")).toHaveCount(4, { timeout: 15000 });
    expect(sent.length).toBe(4);
    expect(new Set(sent).size).toBe(4);
    await expect(panel.getByRole("button", { name: /Open the sheet/ })).toBeEnabled({ timeout: 15000 });
    await panel.getByRole("button", { name: /Open the sheet/ }).click();
    await expect(page.locator(".cr-vars-view img")).toBeVisible();
    await page.keyboard.press("Escape");
    await panel.locator(".cr-vars-cell").first().click();
    await expect(page.getByRole("button", { name: "Compare" })).toBeVisible();
  });
});
