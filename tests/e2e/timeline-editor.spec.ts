import { expect, test } from "@playwright/test";

// The Editor chip in Video Studio (preview mode, every API answered by a mock): it needs a finished clip in the preview; it opens the timeline editor
// in a frame on Eclipse's own address, puts the clip on the timeline and Save renders it and keeps it as a new video.
test("Editor chip opens the timeline editor on the preview clip and Save keeps the result as a new video", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const clip = Buffer.from("00000020667479706d703432000000006d70343269736f6d00000008667265650000000000", "hex");
  const video = { id: "v1", prompt: "a clip", model: "seedance_2_5", modelLabel: "Seedance 2.5", status: "completed", error: null, credits: 1, createdAt: new Date().toISOString(), deletedAt: null, references: null, seed: null, seedLocked: false, projectId: "p1", fileName: "a.mp4", contentType: "video/mp4", sizeBytes: clip.length, width: 640, height: 360, resolution: "720p", startedAt: null, imageUrl: "/api/generations/v1/file", kind: "video", durationSec: 3 };
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [video] } }));
  await page.route("**/api/generations", (r) => r.fulfill({ json: { items: [video] } }));
  await page.route("**/api/generations/v1/file", (r) => r.fulfill({ status: 200, contentType: "video/mp4", body: clip }));
  await page.goto("/generate");
  const chip = page.getByRole("toolbar", { name: "Video tools" }).getByRole("button", { name: /Editor/ });
  await expect(chip).toBeVisible();
  await expect(chip).toBeDisabled(); // nothing in the preview yet
  await page.locator(".cr-earlier button").first().click(); // the clip goes into the preview
  await expect(chip).toBeEnabled({ timeout: 15_000 });
  await chip.click();
  const dlg = page.getByRole("dialog", { name: "Video editor" });
  await expect(dlg).toBeVisible();
  const frame = dlg.locator("iframe");
  await expect(frame).toHaveAttribute("src", /\/filmcraft\/index\.html/);
  // the editor program file is served by Eclipse itself and can be framed by it
  const r = await page.request.get("/filmcraft/index.html");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  const w = await page.request.get("/filmcraft/filmcraft_web_bg.wasm", { headers: { Range: "bytes=0-3" } });
  expect([200, 206]).toContain(w.status());
  expect(w.headers()["content-type"]).toContain("application/wasm");
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
});

test("Save renders the timeline in the editor and sends the result as a new video", async ({ page }) => {
  test.setTimeout(240_000);
  const { execFileSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const ff = (await import("@ffmpeg-installer/ffmpeg")).default.path;
  const out = path.join(tmpdir(), `te-${Date.now()}.mp4`);
  execFileSync(ff, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-f", "lavfi", "-i", "sine", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", out]);
  const clip = readFileSync(out);
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const video = { id: "v1", prompt: "a clip", model: "seedance_2_5", modelLabel: "Seedance 2.5", status: "completed", error: null, credits: 1, createdAt: new Date().toISOString(), deletedAt: null, references: null, seed: null, seedLocked: false, projectId: "p1", fileName: "a.mp4", contentType: "video/mp4", sizeBytes: clip.length, width: 320, height: 180, resolution: "720p", startedAt: null, imageUrl: "/api/generations/v1/file", kind: "video", durationSec: 2 };
  const seen: { start?: Record<string, unknown>; put?: Buffer; finish?: Record<string, unknown> } = {};
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [video] } }));
  await page.route("**/api/generations/v1/file", (r) => r.fulfill({ status: 200, contentType: "video/mp4", body: clip }));
  await page.route("**/api/uploads/direct/start", (r) => { seen.start = JSON.parse(r.request().postData() || "{}"); r.fulfill({ json: { url: "https://storage.test/put", key: "u/x/vid-1.mp4" } }); });
  await page.route("https://storage.test/put", (r) => { seen.put = r.request().postDataBuffer() ?? undefined; r.fulfill({ status: 200, body: "" }); });
  await page.route("**/api/uploads/direct/finish", (r) => { seen.finish = JSON.parse(r.request().postData() || "{}"); r.fulfill({ json: { ...video, id: "v2" } }); });
  await page.goto("/generate");
  await page.locator(".cr-earlier button").first().click();
  await page.getByRole("toolbar", { name: "Video tools" }).getByRole("button", { name: /Editor/ }).click();
  const dlg = page.getByRole("dialog", { name: "Video editor" });
  const save = dlg.getByRole("button", { name: "Save to Library" });
  await expect(save).toBeEnabled({ timeout: 90_000 }); // the clip is on the timeline
  await save.click();
  await expect(dlg).toBeHidden({ timeout: 180_000 });
  expect(seen.start?.fileKind).toBe("video");
  expect(seen.start?.contentType).toBe("video/mp4");
  expect(Number(seen.start?.size)).toBeGreaterThan(1000);
  expect(seen.put?.subarray(4, 8).toString()).toBe("ftyp"); // a real MP4 came out of the editor
  expect(seen.finish?.fileKind).toBe("video");
});
