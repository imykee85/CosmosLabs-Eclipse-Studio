import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// Upscale in both studios' tool trays (preview mode, every API answered by a mock): the image panel in Image Studio and the clip panel in Video Studio.
let PNG: Buffer;
test.beforeAll(async () => { PNG = await sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 120, g: 120, b: 130 } } }).png().toBuffer(); });
const model = { id: "m", label: "Editor", blurb: "x", ratios: ["1:1"], resolutions: ["2k"], maxBatch: 4, maxPrompt: 2000, verified: true, autoPick: true, seed: { supported: false }, maxReferences: 4, requiresReference: false, prices: { "2k": 40 }, batch: 1 };
const base = { prompt: "a thing", model: "m", modelLabel: "Editor", status: "completed", error: null, credits: 1, createdAt: new Date().toISOString(), deletedAt: null, references: null, seed: null, seedLocked: false, projectId: "p1", resolution: "2k", startedAt: null };
const image = { ...base, id: "img1", fileName: "a.png", contentType: "image/png", sizeBytes: 1, width: 600, height: 400, aspectRatio: "3:2", imageUrl: "/api/generations/img1/file", kind: "image" };
const clip = { ...base, id: "vid1", fileName: "a.mp4", contentType: "video/mp4", sizeBytes: 1, width: 1280, height: 720, aspectRatio: "16:9", imageUrl: "/api/generations/vid1/file", kind: "video", durationSec: 5 };

async function setup(page: Page, kind: "image" | "video", available: boolean) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const started: Record<string, unknown>[] = [];
  const quotes: Record<string, unknown>[] = [];
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [model] } }));
  await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 100, charging: true, isAdmin: false, history: [], freeImages: 0 } }));
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [kind === "image" ? image : clip] } }));
  await page.route(/\/api\/generations\/[^/?]+\/(file|thumb)/, (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
  await page.route("**/api/upscale/quote", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: { available } });
    const b = JSON.parse(r.request().postData() || "{}"); quotes.push(b);
    return r.fulfill({ json: kind === "image" ? { ok: true, kind, outW: b.scale * 600, outH: b.scale * 400, credits: 30 } : { ok: true, kind, outW: b.target === "4k" ? 3840 : 1920, outH: b.target === "4k" ? 2160 : 1080, credits: 50 } });
  });
  await page.route("**/api/upscale", (r) => { started.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ json: { item: { ...(kind === "image" ? image : clip), id: "new1", status: "pending", imageUrl: null } } }); });
  return { started, quotes };
}

test("Image Studio: Upscale opens the panel, shows the new size and price, and starts the upscale", async ({ page }) => {
  const { started, quotes } = await setup(page, "image", true);
  await page.goto("/create");
  await page.locator('[aria-label="Your five most recent renders"] button').first().click();
  await page.locator(".cr-tray button", { hasText: "Upscale" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Upscale" });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText("To 1200 × 800")).toBeVisible(); // 2x of 600 x 400
  await expect(dlg.getByText("From 600 × 400")).toBeVisible();
  await dlg.getByRole("radio", { name: "4x" }).click();
  await expect(dlg.getByText("To 2400 × 1600")).toBeVisible();
  await dlg.getByRole("radio", { name: "Creative" }).click();
  await expect(dlg.getByText("Adds new detail, best for AI pictures")).toBeVisible();
  await expect(dlg.getByText("Creativity")).toBeVisible();
  await expect.poll(() => quotes.at(-1)).toMatchObject({ sourceId: "img1", preset: "creative", scale: 4 }); // the price is asked again for the new style
  await dlg.getByRole("button", { name: /Upscale/ }).last().click();
  await expect(dlg).toBeHidden();
  expect(started[0]).toMatchObject({ sourceId: "img1", preset: "creative", scale: 4, creativity: 3 });
});

test("Video Studio: Upscale needs a clip, offers 1080p and 4K and starts the upscale", async ({ page }) => {
  const { started } = await setup(page, "video", true);
  await page.goto("/generate");
  const tray = page.getByRole("toolbar", { name: "Video tools" });
  const chip = tray.getByRole("button", { name: /Upscale/ });
  await expect(chip).toHaveCount(0);
  await page.locator(".cr-earlier button").first().click();
  await expect(chip).toBeEnabled({ timeout: 15_000 });
  await chip.click();
  const dlg = page.getByRole("dialog", { name: "Upscale" });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText("To 1920 × 1080")).toBeVisible();
  await dlg.getByRole("radio", { name: "4K" }).click();
  await expect(dlg.getByText("To 3840 × 2160")).toBeVisible();
  await dlg.getByRole("radio", { name: "Faithful" }).click();
  await dlg.getByRole("button", { name: /Upscale/ }).last().click();
  await expect(dlg).toBeHidden();
  expect(started[0]).toMatchObject({ sourceId: "vid1", preset: "faithful", target: "4k" });
});

test("the panel says so when Upscale is not switched on", async ({ page }) => {
  await setup(page, "video", false);
  await page.goto("/generate");
  await page.locator(".cr-earlier button").first().click();
  await page.getByRole("toolbar", { name: "Video tools" }).getByRole("button", { name: /Upscale/ }).click();
  const dlg = page.getByRole("dialog", { name: "Upscale" });
  await expect(dlg.getByText("Upscale isn't available yet.")).toBeVisible();
  await expect(dlg.getByRole("button", { name: /Upscale/ }).last()).toBeDisabled();
});

test("a picture or clip from the Library or Gallery opens in its studio with the tools (?tool=<id>)", async ({ page }) => {
  // the studio's own history is empty: the item is found by its id
  await setup(page, "image", true);
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [] } }));
  await page.route(/\/api\/generations\/img1$/, (r) => r.fulfill({ json: image }));
  await page.goto("/create?tool=img1");
  await expect(page.locator(".cr-tray.is-open button", { hasText: "Upscale" })).toBeVisible({ timeout: 15_000 });

  const p2 = await page.context().newPage();
  await setup(p2, "video", true);
  await p2.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [] } }));
  await p2.route(/\/api\/generations\/vid1$/, (r) => r.fulfill({ json: clip }));
  await p2.goto("/generate?tool=vid1");
  const tray = p2.getByRole("toolbar", { name: "Video tools" });
  await expect(tray.getByRole("button", { name: /Upscale/ })).toBeVisible({ timeout: 15_000 });
  await expect(tray.getByRole("button", { name: /Editor/ })).toBeVisible();
});
