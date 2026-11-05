import { expect, test } from "@playwright/test";

// The Editor chip in Video Studio opens Eclipse's own timeline editor (preview mode, every API answered by a mock).
async function setup(page: import("@playwright/test").Page) {
  const { execFileSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const out = path.join(tmpdir(), `ve-${Date.now()}.webm`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-f", "lavfi", "-i", "sine", "-t", "3", "-c:v", "libvpx-vp9", "-c:a", "libopus", out]);
  const clip = readFileSync(out);
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const video = { id: "v1", prompt: "a clip", model: "seedance_2_5", modelLabel: "Seedance 2.5", status: "completed", error: null, credits: 1, createdAt: new Date().toISOString(), deletedAt: null, references: null, seed: null, seedLocked: false, projectId: "p1", fileName: "a.webm", contentType: "video/webm", sizeBytes: clip.length, width: 320, height: 180, resolution: "720p", startedAt: null, imageUrl: "/api/generations/v1/file", kind: "video", durationSec: 3, aspectRatio: "16:9" };
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [video] } }));
  await page.route("**/api/generations/v1/file", (r) => r.fulfill({ status: 200, contentType: "video/webm", body: clip }));
  return video;
}

test("Editor: clip on the timeline, split, title, aspect, and Save keeps an MP4 as a new video", async ({ page }) => {
  test.setTimeout(240_000);
  const video = await setup(page);
  const seen: { start?: Record<string, unknown>; put?: Buffer; finish?: Record<string, unknown> } = {};
  await page.route("**/api/uploads/direct/start", (r) => { seen.start = JSON.parse(r.request().postData() || "{}"); r.fulfill({ json: { url: "https://storage.test/put", key: "u/x/vid-1.mp4" } }); });
  await page.route("https://storage.test/put", (r) => { seen.put = r.request().postDataBuffer() ?? undefined; r.fulfill({ status: 200, body: "" }); });
  await page.route("**/api/uploads/direct/finish", (r) => { seen.finish = JSON.parse(r.request().postData() || "{}"); r.fulfill({ json: { ...video, id: "v2" } }); });
  await page.goto("/generate");
  const chip = page.getByRole("toolbar", { name: "Video tools" }).getByRole("button", { name: /Editor/ });
  await expect(chip).toBeDisabled();
  await page.locator(".cr-earlier button").first().click();
  await chip.click();
  const dlg = page.getByRole("dialog", { name: "Video editor" });
  await expect(dlg.locator(".ve-r1 .ve-block")).toHaveCount(1, { timeout: 20_000 });
  // move the playhead to the middle and split
  const ruler = dlg.locator(".ve-ruler"); const rb = (await ruler.boundingBox())!;
  await page.mouse.click(rb.x + 90, rb.y + 10); // 1.5 s at 60 px per second
  await dlg.getByRole("button", { name: /Split/ }).click();
  await expect(dlg.locator(".ve-r1 .ve-block")).toHaveCount(2);
  // a title
  await dlg.getByRole("tab", { name: "Text" }).click();
  await dlg.getByRole("button", { name: /Add title/ }).click();
  await expect(dlg.locator(".ve-r3 .ve-block")).toHaveCount(1);
  await dlg.getByLabel("Title text").fill("Hello");
  await expect(dlg.locator(".ve-r3 .ve-block")).toContainText("Hello");
  // aspect ratio changes the preview shape
  await dlg.getByRole("tab", { name: "Ratio" }).click();
  await dlg.getByRole("radio", { name: "9:16" }).click();
  const c = (await dlg.locator("canvas").evaluate((el) => [(el as HTMLCanvasElement).width, (el as HTMLCanvasElement).height])) as number[];
  expect(c[1]).toBeGreaterThan(c[0]);
  // undo brings the shape back
  await dlg.getByRole("button", { name: "Undo" }).click();
  const c2 = (await dlg.locator("canvas").evaluate((el) => [(el as HTMLCanvasElement).width, (el as HTMLCanvasElement).height])) as number[];
  expect(c2[0]).toBeGreaterThan(c2[1]);
  // save
  await dlg.getByRole("button", { name: "Save to Library" }).click();
  await expect(dlg).toBeHidden({ timeout: 200_000 });
  expect(seen.start?.fileKind).toBe("video");
  expect(seen.start?.contentType).toBe("video/mp4");
  expect(seen.put?.subarray(4, 8).toString()).toBe("ftyp");
  expect(seen.finish?.fileKind).toBe("video");
});

test("Editor works at a phone width without sideways page scroll", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 520, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await setup(page);
  await page.goto("/generate");
  await page.locator(".cr-earlier button").first().click();
  await page.getByRole("toolbar", { name: "Video tools" }).getByRole("button", { name: /Editor/ }).click();
  const dlg = page.getByRole("dialog", { name: "Video editor" });
  await expect(dlg.locator(".ve-r1 .ve-block")).toHaveCount(1, { timeout: 20_000 });
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(over).toBe(false);
  await page.screenshot({ path: process.env.VE_SHOT || "/tmp/ve-phone.png" });
  await ctx.close();
});
