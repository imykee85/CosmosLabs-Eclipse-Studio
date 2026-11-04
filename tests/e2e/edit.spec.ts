import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// The image editor in preview mode (every API answered by a mock): Edit (Prompt, Visual) and Retouch (Replace, Erase with Brush, Lasso, Click).
let PNG: Buffer; // a real picture, big enough to click on
test.beforeAll(async () => { PNG = await sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 120, g: 120, b: 130 } } }).png().toBuffer(); });
const model = { id: "m", label: "Editor", blurb: "x", ratios: ["1:1"], resolutions: ["2k"], maxBatch: 4, maxPrompt: 2000, verified: true, autoPick: true, seed: { supported: false }, maxReferences: 4, requiresReference: false, prices: { "2k": 40 }, batch: 1 };
const done = (id: string) => ({ id, prompt: "a car", model: "m", modelLabel: "Editor", fileName: `${id}.png`, contentType: "image/png", sizeBytes: 1, width: 1, height: 1, resolution: "2k", projectId: "p1", aspectRatio: "1:1", seed: 1, seedLocked: false, references: null, status: "completed", error: null, imageUrl: `/api/generations/${id}/file`, kind: "image", durationSec: null, hasAudio: null, credits: null, startedAt: null, createdAt: new Date().toISOString(), deletedAt: null });

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const sent: { prompt: string; references: { type: string; id: string }[] }[] = [];
  const kept: Record<string, unknown>[] = [];
  let n = 0;
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [model] } }));
  await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 100, charging: true, isAdmin: false, history: [], freeImages: 0 } }));
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [done("src1")] } }));
  await page.route(/\/api\/generations\/[^/?]+\/(file|thumb)/, (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
  await page.route(/\/api\/generations\/(c\d|k\d)$/, (r) => r.fulfill({ json: done(r.request().url().split("/").pop()!) }));
  await page.route("**/api/generate", (r) => { sent.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ json: { id: `c${++n}` } }); });
  await page.route("**/api/uploads", (r) => r.request().method() === "POST" ? r.fulfill({ status: 201, json: { id: "up1", kind: "asset", name: "Retouch selection", projectId: "p1", contentType: "image/jpeg", sizeBytes: 1, width: 1, height: 1, imageUrl: "", createdAt: new Date().toISOString() } }) : r.fulfill({ json: { items: [] } }));
  await page.route("**/api/edit/keep", (r) => { kept.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ json: { id: "k1" } }); });
  await page.route("**/api/edit/history**", (r) => r.fulfill({ json: { steps: [{ id: "src1", parentId: null, op: "original", prompt: "a car", createdAt: new Date().toISOString() }], current: "src1" } }));
  return { sent, kept };
}

async function openEditor(page: Page) {
  await page.goto("/create");
  await page.locator('[aria-label="Your five most recent renders"] button').first().click();
  await page.locator(".cr-tray button", { hasText: "Edit" }).first().click();
  const ed = page.getByRole("dialog", { name: "Image editor" });
  await expect(ed).toBeVisible();
  await expect(ed.locator(".ed-frame img").first()).toBeVisible();
  return ed;
}

// a drag across the picture with the mouse
async function drag(page: Page, ed: ReturnType<Page["locator"]>, pts: [number, number][]) {
  const box = await ed.locator(".ed-frame").boundingBox();
  if (!box) throw new Error("no frame");
  const at = ([x, y]: [number, number]) => [box.x + box.width * x, box.y + box.height * y] as const;
  await page.mouse.move(...at(pts[0]));
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...at(p), { steps: 4 });
  await page.mouse.up();
}

test.describe("Image editor", () => {
  test("Edit, Prompt: variations appear, one can be previewed and kept", async ({ page }) => {
    const { sent, kept } = await setup(page);
    const ed = await openEditor(page);
    await expect(ed.getByRole("button", { name: "Edit" }).last()).toHaveAttribute("aria-pressed", "true");
    await expect(ed.locator(".gen-btn")).toBeDisabled(); // nothing written yet
    await ed.getByLabel("Instruction").fill("change from daytime to night");
    await ed.locator(".ed-chip").click();
    await expect(ed.locator(".ed-step b")).toHaveText("2");
    await ed.getByRole("button", { name: "More images" }).click();
    await ed.locator(".ed-chip").click();
    await expect(ed.locator(".gen-btn")).toContainText("12"); // 3 images at 4 credits
    await ed.locator(".gen-btn").click();
    await expect(ed.locator(".ed-thumb")).toHaveCount(3);
    await expect(ed.locator(".ed-thumb img")).toHaveCount(3, { timeout: 15000 });
    expect(sent.length).toBe(3);
    expect(sent[0].prompt).toContain("change from daytime to night");
    expect(sent[0].prompt).toContain("Change only what is asked"); // the keep-identical block is added behind the scenes
    expect(sent[0].references).toEqual([{ type: "render", id: "src1" }]);
    await ed.locator(".ed-thumb").nth(1).hover();
    await expect(ed.locator(".ed-over").first()).toBeVisible();
    await ed.locator(".ed-thumb").nth(1).click();
    await ed.getByRole("button", { name: /Keep this one/ }).click();
    await expect.poll(() => kept.length).toBe(1);
    expect(kept[0]).toMatchObject({ parentId: "src1", op: "prompt", prompt: "change from daytime to night" });
    expect(kept[0].resultId).toMatch(/^c\d$/);
    await expect(ed.locator(".ed-thumb")).toHaveCount(0); // back to editing the kept version
  });

  test("Edit, Visual: a click drops a pin and the pins become the instruction", async ({ page }) => {
    const { sent } = await setup(page);
    const ed = await openEditor(page);
    await ed.getByRole("tab", { name: "Visual" }).click();
    await expect(ed.getByText("Add annotations by clicking on the image")).toBeVisible();
    const box = await ed.locator(".ed-frame").boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.6);
    await ed.getByLabel("Change at point 1").fill("body yellow");
    await page.mouse.click(box!.x + box!.width * 0.8, box!.y + box!.height * 0.2);
    await ed.getByLabel("Change at point 2").fill("seats black");
    await expect(ed.locator(".ed-pin")).toHaveCount(2);
    await ed.locator(".gen-btn").click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[0].prompt).toMatch(/1\. At the point 40% from the left and 60% from the top: body yellow\./);
    expect(sent[0].prompt).toMatch(/2\. At the point 80%/);
  });

  test("Retouch: brush, lasso and click build a selection; undo, redo and clear work; Erase sends the selection as a second picture", async ({ page }) => {
    const { sent } = await setup(page);
    const ed = await openEditor(page);
    await ed.getByRole("button", { name: "Retouch" }).click();
    await expect(ed.getByLabel("Instruction")).toHaveAttribute("placeholder", "Draw a selection and describe what you want to change");
    const gen = ed.locator(".gen-btn");
    await expect(gen).toBeDisabled();
    await expect(ed.getByLabel("Undo")).toBeDisabled();
    const slider = ed.getByLabel("Brush size").locator("input");
    await slider.fill("100");
    await expect(ed.getByLabel("Brush size").locator("span")).toHaveText("100");
    await drag(page, ed, [[0.3, 0.3], [0.6, 0.3], [0.6, 0.6]]);
    await expect(ed.getByLabel("Undo")).toBeEnabled();
    await ed.getByLabel("Instruction").fill("black glass");
    await expect(gen).toBeEnabled();
    await ed.getByLabel("Undo").click();
    await expect(gen).toBeDisabled();
    await ed.getByLabel("Redo").click();
    await expect(gen).toBeEnabled();
    await ed.getByLabel("Clear the selection").click();
    await expect(gen).toBeDisabled();
    await ed.getByLabel("Selection tool").locator("select").selectOption("lasso");
    await drag(page, ed, [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]);
    await expect(gen).toBeEnabled();
    await ed.getByRole("tab", { name: "Erase" }).click();
    await expect(ed.getByLabel("Instruction")).toHaveAttribute("placeholder", "Draw a selection to erase");
    await expect(gen).toBeEnabled(); // the selection stays; Erase needs no words
    await gen.click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[0].prompt).toContain("Remove everything inside the blue area");
    expect(sent[0].references).toEqual([{ type: "render", id: "src1" }, { type: "upload", id: "up1" }]); // the original, then the picture with the selection painted on
  });

  test("Retouch on a model with a real mask sends the selection as a mask, not as a second picture", async ({ page }) => {
    const { sent } = await setup(page);
    await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [{ ...model, id: "gpt", label: "Masked", maskEdit: true }] } }));
    const ed = await openEditor(page);
    await ed.getByRole("button", { name: "Retouch" }).click();
    await drag(page, ed, [[0.3, 0.3], [0.6, 0.4], [0.6, 0.6]]);
    await ed.getByRole("tab", { name: "Erase" }).click();
    await ed.locator(".gen-btn").click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[0].prompt).toContain("masked area");
    expect(sent[0].prompt).not.toContain("blue");
    expect(sent[0].references).toEqual([{ type: "render", id: "src1" }]); // only the picture
    expect((sent[0] as unknown as { maskId: string }).maskId).toBe("up1"); // and the selection as its mask
  });

  test("the history and the recent pictures are on the screen, and the editor closes", async ({ page }) => {
    await setup(page);
    const ed = await openEditor(page);
    await ed.getByLabel("History").click();
    await expect(ed.getByRole("complementary", { name: "Editing history" })).toContainText("Original");
    await expect(ed.getByLabel("Hold to compare with the original")).toBeVisible();
    await ed.getByLabel("Zoom in").click();
    await expect(ed.locator(".ed-zoom span")).toContainText("130%");
    await page.keyboard.press("Escape");
    await expect(ed).toHaveCount(0);
  });
});
