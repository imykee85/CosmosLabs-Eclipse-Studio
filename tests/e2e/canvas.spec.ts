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

  test("the wrapper nodes, List and Group can all be added", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    for (const label of ["Assistant", "Image editor", "Upscaler", "List", "Voiceover", "Sound effects", "Music"]) await addFromPanel(page, `^${label}$`);
    await expect(page.locator(".react-flow__node")).toHaveCount(7);
    for (const title of ["Assistant", "Image editor", "Upscaler", "List", "Voiceover", "Sound effects", "Music"]) await expect(page.locator(".cv-n-title", { hasText: new RegExp(`^${title}`) }).first()).toBeVisible();
  });

  test("the Assistant writes text from an instruction and shows it", async ({ page }) => {
    await seed(page);
    let sent: { instruction?: string } = {};
    await page.route("**/api/canvas/assistant", async (r) => { sent = r.request().postDataJSON(); await r.fulfill({ json: { text: "A short, punchy ad script." } }); });
    await openNewCanvas(page);
    await addFromPanel(page, "^Assistant$");
    await page.getByLabel("Instruction").fill("Write a 10 second ad");
    await page.getByRole("button", { name: /^Run/ }).click();
    await expect(page.getByLabel("Assistant result")).toHaveValue("A short, punchy ad script.");
    expect(sent.instruction).toBe("Write a 10 second ad");
  });

  test("a List fans an image generator out: one run per line, after a confirmation", async ({ page }) => {
    await seed(page);
    await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [{ id: "m", label: "Model", blurb: "x", ratios: ["1:1"], resolutions: [], maxBatch: 4, maxPrompt: 2000, verified: true, autoPick: true, seed: { supported: false }, maxReferences: 0, requiresReference: false, credits: null, prices: null, batch: 1 }] } }));
    const prompts: string[] = [];
    let n = 0;
    await page.route("**/api/generate", async (r) => { prompts.push(r.request().postDataJSON().prompt); await r.fulfill({ json: { id: `g${++n}` } }); });
    await page.route("**/api/generations/**", (r) => r.fulfill({ json: { status: "completed" } }));
    await openNewCanvas(page);
    await addFromPanel(page, "Image generator");
    await page.getByRole("button", { name: "Add a node that feeds Image generator" }).click();
    await page.getByRole("menuitem", { name: /List/ }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await page.getByLabel("List items").fill("red dress\nblue suit");
    await page.getByLabel("Prompt", { exact: true }).fill("Studio photo of a");
    await expect(page.locator(".cv-chip", { hasText: "2 items" })).toBeVisible();
    await page.getByRole("button", { name: /^Generate/ }).click();
    const ask = page.getByRole("alertdialog");
    await expect(ask).toContainText("2 times");
    await ask.locator(".sa-go").click();
    await expect.poll(() => prompts.length).toBe(2);
    expect(prompts[0]).toContain("Studio photo of a. red dress");
    expect(prompts[1]).toContain("Studio photo of a. blue suit");
  });

  test("a node dragged with helper lines on still moves", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    await addFromPanel(page, "Text prompt");
    const node = page.locator(".react-flow__node").first();
    // zoom out a little so the node's title is clear of the toolbar
    await page.mouse.move(1000, 560);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(300);
    const before = await node.boundingBox();
    const title = node.locator(".cv-n-title");
    const t = (await title.boundingBox())!;
    await page.mouse.move(t.x + 20, t.y + 10);
    await page.mouse.down();
    await page.mouse.move(t.x + 160, t.y + 90, { steps: 6 });
    await page.mouse.up();
    const after = await node.boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(80);
    expect(Math.abs(after!.y - before!.y)).toBeGreaterThan(40);
  });

  test("grouping selected nodes draws a titled frame behind them, which can be renamed and recoloured", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    await addFromPanel(page, "Text prompt");
    await addFromPanel(page, "Character");
    await page.keyboard.press("v");
    const pane = await page.locator(".react-flow__pane").boundingBox();
    await page.mouse.move(pane!.x + 4, pane!.y + 120);
    await page.mouse.down();
    await page.mouse.move(pane!.x + pane!.width - 4, pane!.y + pane!.height - 4, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Group the selected nodes" }).click();
    await expect(page.locator(".react-flow__node-group")).toHaveCount(1);
    await page.getByLabel("Group name").fill("Hero shot");
    await expect(page.getByLabel("Group name")).toHaveValue("Hero shot");
    await page.getByRole("button", { name: "Colour green" }).click();
    await expect(page.getByRole("button", { name: "Colour green" })).toHaveClass(/is-on/);
  });

  test("settings: wire style, mouse wheel and the shortcut list; the choice is remembered", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    await page.getByRole("button", { name: "Canvas settings" }).click();
    const modal = page.getByRole("dialog", { name: "Canvas settings" });
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Open the node list")).toBeVisible();
    await modal.getByLabel("Wire style").selectOption("step");
    await modal.getByLabel("Mouse wheel").selectOption("pan");
    await modal.getByLabel("Helper lines").click();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "Canvas settings" }).click();
    await expect(page.getByLabel("Wire style")).toHaveValue("step");
    await expect(page.getByLabel("Mouse wheel")).toHaveValue("pan");
    await expect(page.getByLabel("Helper lines")).toHaveAttribute("aria-checked", "false");
  });

  test("share and comments say they need an account in preview mode; templates still save in this browser", async ({ page }) => {
    await seed(page);
    await openNewCanvas(page);
    await page.getByRole("button", { name: /^Share/ }).click();
    await expect(page.getByText("Sharing needs an account")).toBeVisible();
    await page.getByRole("button", { name: /^Comments/ }).click();
    await expect(page.getByText("Comments need an account")).toBeVisible();
    await addFromPanel(page, "Text prompt");
    await page.getByRole("button", { name: /Templates/ }).click();
    await page.getByLabel("Template name").fill("My ad");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("My ad")).toBeVisible();
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
    await page.getByLabel("Search nodes").fill("text prompt");
    await expect(page.locator(".cv-tile")).toHaveCount(1);
    await page.getByRole("button", { name: /Text prompt/i }).first().tap();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(sheet).toHaveCount(0); // choosing a node closes the sheet
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  });
});
