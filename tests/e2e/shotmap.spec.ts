import { expect, test, type Page } from "@playwright/test";

// ShotMap in Video Studio (preview mode, every API answered by a mock): the start screen, building and arranging a scene (Compose), camera keyframes on the
// timeline (Motion), looking through the camera, and recording the shot in the browser and handing it to Video Studio as the camera-motion reference.
async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const calls: string[] = [];
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  const clipVideo = { id: "v1", prompt: "a clip", model: "seedance_2_5", modelLabel: "Seedance 2.5", status: "completed", error: null, credits: 1, createdAt: new Date().toISOString(), deletedAt: null, references: null, seed: null, seedLocked: false, projectId: "p1", fileName: "a.mp4", contentType: "video/mp4", sizeBytes: 10, width: 320, height: 180, resolution: "720p", startedAt: null, imageUrl: "/api/generations/v1/file", kind: "video", durationSec: 3, aspectRatio: "16:9" };
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [clipVideo] } }));
  await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 100, charging: true, isAdmin: false, history: [], freeImages: 0 } }));
  await page.route("**/api/uploads/direct/start", (r) => { calls.push("start"); r.fulfill({ json: { url: `${new URL(page.url()).origin}/fake-put`, key: "u/x/guide.mp4" } }); });
  await page.route("**/fake-put", (r) => { calls.push(`put ${r.request().postDataBuffer()?.length ?? 0}`); r.fulfill({ status: 200, body: "" }); });
  await page.route("**/api/uploads/direct/finish", (r) => { calls.push("finish"); r.fulfill({ json: { id: "g9", kind: "video", status: "completed", durationSec: 2, width: 854, height: 480 } }); });
  return calls;
}
async function openShotMap(page: Page) {
  await page.goto("/generate");
  await page.getByRole("button", { name: "a clip" }).first().click();
  await page.getByRole("button", { name: /^Motion/ }).click();
  await page.getByRole("menuitemradio", { name: /ShotMap/ }).click();
  return page.getByRole("dialog", { name: "ShotMap" });
}

test.describe("ShotMap", () => {
  test("start screen: sources, templates, a coming-soon note for real places, and an empty scene", async ({ page }) => {
    await setup(page);
    const d = await openShotMap(page);
    await expect(d.getByText("Start from")).toBeVisible();
    await d.getByRole("button", { name: /Real environment/ }).click();
    await d.getByRole("tab", { name: "Place" }).click();
    await d.getByRole("button", { name: "Choose location" }).click();
    await expect(d.getByText(/coming soon/)).toBeVisible();
    await d.getByRole("button", { name: /Virtual scene/ }).click();
    await expect(d.getByRole("button", { name: "Create virtual scene" })).toBeDisabled();
    await d.getByRole("button", { name: "Templates" }).click();
    await expect(d.getByRole("button", { name: /Mountain summit/ })).toBeVisible();
    await d.getByRole("tab", { name: "None" }).click();
    await d.getByRole("button", { name: "Create empty scene" }).click();
    await expect(d.getByRole("tablist", { name: "Mode" })).toBeVisible();
    await expect(d.getByRole("complementary", { name: "Scene" }).getByText("Camera 1")).toBeVisible();
  });

  test("a prompt builds the scene through the assistant", async ({ page }) => {
    await setup(page);
    let sent: Record<string, unknown> = {};
    await page.route("**/api/shot/ask", async (r) => {
      sent = JSON.parse(r.request().postData() || "{}");
      const w = sent.world as { items: unknown[]; name: string };
      r.fulfill({ json: { summary: "Built a summit.", world: { ...w, name: "Alps", items: [...w.items, { id: "s1", name: "Summit", kind: "shape", shape: "cone", groupId: null, pos: [0, 0, -20], rot: [0, 0, 0], scale: [30, 20, 30], color: "#7a7f8a", visible: true, locked: false }] } } });
    });
    const d = await openShotMap(page);
    await d.getByRole("textbox", { name: "Describe your scene" }).fill("Alpine mountains with two climbers on the summit");
    await d.getByRole("button", { name: "Create virtual scene" }).click();
    await expect(d.getByRole("complementary", { name: "Scene" }).getByText("Summit")).toBeVisible();
    expect(sent.mode).toBe("build");
    await expect(d.getByText("Built a summit.")).toBeVisible();
  });

  test("compose: add from the panel, edit in the inspector, undo", async ({ page }) => {
    await setup(page);
    const d = await openShotMap(page);
    await d.getByRole("tab", { name: "None" }).click();
    await d.getByRole("button", { name: "Create empty scene" }).click();
    await d.getByRole("button", { name: "Add", exact: true }).click();
    const add = d.getByRole("dialog", { name: "Add to scene" });
    await add.getByRole("tab", { name: "Shapes" }).click();
    await add.getByRole("button", { name: "Sphere" }).click();
    const insp = d.getByRole("complementary", { name: "Inspector" });
    await expect(insp.getByText("Sphere 1")).toBeVisible();
    await insp.getByRole("textbox", { name: "Y" }).first().fill("2");
    await insp.getByRole("textbox", { name: "Y" }).first().press("Enter");
    await expect(insp.getByRole("textbox", { name: "Y" }).first()).toHaveValue("2");
    await d.getByRole("button", { name: "Undo" }).click();
    await expect(insp.getByRole("textbox", { name: "Y" }).first()).toHaveValue("0");
    await insp.getByRole("tab", { name: "Appearance" }).click();
    await expect(insp.getByRole("textbox", { name: "What it is in the video" })).toBeVisible();
  });

  test("motion: keyframes on the timeline, the camera view, then Use video records and hands over", async ({ page }) => {
    const calls = await setup(page);
    const d = await openShotMap(page);
    await d.getByRole("button", { name: "Templates" }).click();
    await d.getByRole("button", { name: /Street corner/ }).click();
    await d.getByRole("tab", { name: "Motion" }).click();
    await d.getByRole("textbox", { name: "Shot duration in seconds" }).fill("2");
    const row = d.locator(".ss-tl-row.is-cam");
    await expect(row.locator(".ss-diamond")).toHaveCount(1); // the template's second key (10 s) lies past the shortened shot
    const box = (await row.boundingBox())!;
    await row.dblclick({ position: { x: Math.min(box.width - 20, 12 + (box.width - 24) * 0.5), y: 18 } });
    await expect(row.locator(".ss-diamond")).toHaveCount(2);
    const pop = d.getByRole("dialog", { name: "Camera settings" });
    await expect(pop).toBeVisible();
    await pop.getByRole("button", { name: "Longer lens" }).click();
    await expect(pop.getByText("50mm")).toBeVisible();
    await pop.getByRole("button", { name: "Enter camera" }).click();
    await expect(d.getByText("Editing camera view")).toBeVisible();
    await d.getByRole("button", { name: "Done (Esc)" }).click();
    await d.getByRole("button", { name: "Easing" }).click();
    await d.getByRole("menuitemradio", { name: "Ease In-Out" }).click();
    await expect(d.getByRole("button", { name: "Easing" })).toContainText("Ease In-Out");
    await d.getByRole("button", { name: "Use video" }).click();
    await d.getByRole("radio", { name: "480p" }).click();
    await d.getByRole("button", { name: /^Use video Record/ }).click();
    await expect(page.getByRole("dialog", { name: "ShotMap" })).toHaveCount(0, { timeout: 40_000 });
    expect(calls[0]).toBe("start"); expect(Number(calls[1].split(" ")[1])).toBeGreaterThan(1000); expect(calls[2]).toBe("finish");
    await expect(page.locator("textarea").first()).toHaveValue(/camera-motion reference/);
  });

  test("it fits a phone without sideways scroll", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 520, height: 900 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await setup(page);
    const d = await openShotMap(page);
    await d.getByRole("button", { name: "Templates" }).click();
    await d.getByRole("button", { name: /Living room/ }).click();
    for (const m of ["Compose", "Motion", "Shoot"]) {
      await d.getByRole("tab", { name: m }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
    await expect(d.getByRole("button", { name: "Take a still" })).toBeVisible();
    await ctx.close();
  });
});
