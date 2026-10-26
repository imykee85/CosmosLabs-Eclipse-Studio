import { expect, test, type Page } from "@playwright/test";

// The Canvas editor in preview mode (no sign-in): boards are kept in the browser. The API is answered with empty lists.
async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0, models: [] } }));
}

async function openNewCanvas(page: Page) {
  await page.goto("/canvas");
  await page.getByRole("button", { name: /New canvas/ }).first().click();
  await expect(page.locator(".cv-wrap")).toBeVisible();
}

async function addFromPanel(page: Page, label: string) {
  await page.getByRole("button", { name: /Add node/ }).click();
  await page.getByRole("button", { name: new RegExp(label, "i") }).first().click();
}

test.describe("Canvas on desktop", () => {
  test("add nodes, undo and redo with the buttons and the keyboard, N opens the node list", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    await addFromPanel(page, "Text prompt");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await page.waitForTimeout(600); // a change is filed as an undo step a moment after the last edit
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog", { name: "Nodes" })).toBeVisible();
    await page.getByRole("button", { name: /Character/ }).first().click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await page.keyboard.press("Control+Shift+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
  });

  test("the node list filters by category and by search", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    await page.getByRole("button", { name: /Add node/ }).click();
    await page.getByRole("tab", { name: "Input" }).click();
    await expect(page.getByRole("button", { name: /Character/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Image generator/i })).toHaveCount(0);
    await page.getByRole("tab", { name: "All" }).click();
    await page.getByLabel("Search nodes").fill("video");
    await expect(page.locator(".cv-tile")).toHaveCount(2); // Video generator and Video (clip)
  });

  test("select mode: a box round two nodes selects both and one button deletes them", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    await addFromPanel(page, "Text prompt");
    await addFromPanel(page, "Character");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await page.keyboard.press("v");
    await expect(page.getByRole("button", { name: /Select mode/ })).toHaveAttribute("aria-pressed", "true");
    const pane = await page.locator(".react-flow__pane").boundingBox();
    expect(pane).toBeTruthy();
    await page.mouse.move(pane!.x + 4, pane!.y + 120);
    await page.mouse.down();
    await page.mouse.move(pane!.x + pane!.width - 4, pane!.y + pane!.height - 4, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("button", { name: /Delete 2 selected nodes/ }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("the board is kept after a reload", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    await addFromPanel(page, "Text prompt");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.locator(".cv-status")).toContainText(/Saved/);
    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });
});

test.describe("Canvas on a phone", () => {
  test.use({ viewport: { width: 520, height: 900 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the editor fits the screen, the toolbar is reachable and nodes can be added", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const add = page.getByRole("button", { name: /Add node/ });
    await expect(add).toBeVisible();
    const box = await add.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 520).toBeTruthy();
    // the toolbar is docked low on the board, above the tab bar
    expect(box!.y).toBeGreaterThan(450);
    await add.tap();
    const sheet = page.getByRole("dialog", { name: "Nodes" });
    await expect(sheet).toBeVisible();
    const sb = await sheet.boundingBox();
    expect(sb && sb.width >= 500 && sb.x <= 1).toBeTruthy(); // a full-width bottom sheet
    await page.getByLabel("Search nodes").fill("text");
    await expect(page.locator(".cv-tile")).toHaveCount(1);
    await page.getByRole("button", { name: /Text prompt/i }).first().tap();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(sheet).toHaveCount(0); // choosing a node closes the sheet
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  });
});
