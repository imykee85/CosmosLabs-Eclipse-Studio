import { expect, test, type Page } from "@playwright/test";

// Design Studio with Atlas (preview mode, every API mocked): the Atlas switch, Atlas's Make button attaching a picture to the motion composer,
// and a video clip drawn inside a motion by the real sandboxed frame.
const now = new Date().toISOString();

async function base(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    localStorage.setItem("eclipse-agent", "Atlas");
  });
  await page.route("**/api/**", (r) => (r.request().url().endsWith("/motion/frame") ? r.fallback() : r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } })));
  await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [{ id: "m", label: "Model", blurb: "x", ratios: ["1:1", "16:9"], resolutions: [], maxBatch: 4, maxPrompt: 2000, verified: true, autoPick: true, seed: { supported: false }, maxReferences: 0, requiresReference: false, credits: null }] } }));
}

test.describe("Design Studio and Atlas", () => {
  test("Atlas can be switched on in Design Studio, and his Make button attaches a picture to the motion", async ({ page }) => {
    await base(page);
    let sent: { context?: { page?: string; make?: boolean } } | null = null;
    await page.route("**/api/agent/chat", (r) => {
      sent = r.request().postDataJSON();
      return r.fulfill({ json: { runId: "r1" } });
    });
    await page.route("**/api/agent/runs/r1", (r) => r.fulfill({ json: { status: "done", result: { status: 200, body: { text: "Here is a plate for the background.", actions: [{ kind: "make", label: "Make this picture", prompt: "Warm coffee steam on black", asset: "image", ratio: "16:9" }] } } } }));
    const started: Record<string, unknown>[] = [];
    await page.route("**/api/generate", (r) => { started.push(r.request().postDataJSON()); return r.fulfill({ json: { id: "g1", status: "pending" } }); });
    await page.route("**/api/generations/g1/status", (r) => r.fulfill({ json: { id: "g1", status: "completed", kind: "image" } }));

    await page.goto("/design");
    await page.getByRole("tab", { name: /Motion/ }).click();
    const sw = page.getByRole("switch", { name: "Let the agent help in Design Studio" });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await page.click(".aw-btn");
    await page.fill(".aw-input textarea", "make me a background plate");
    await page.click('.aw-input button[type="submit"]');
    await expect.poll(() => sent?.context?.page).toBe("design");
    expect(sent!.context!.make).toBe(true);
    await page.getByRole("button", { name: "Make this picture" }).click();
    await expect.poll(() => started.length).toBe(1);
    expect(started[0]).toMatchObject({ prompt: "Warm coffee steam on black", aspectRatio: "16:9" });
    await expect(page.locator('.mt-composer .mt-pic img[src="/api/generations/g1/file"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".mt-composer .mt-pic em", { hasText: "@1" })).toBeVisible();
  });

  test("a motion draws its video clip with M.clip in the real frame", async ({ page }) => {
    const { execFileSync } = await import("node:child_process");
    const { readFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const out = path.join(tmpdir(), `mt-clip-${Date.now()}.webm`);
    const ff = (await import("@ffmpeg-installer/ffmpeg")).default.path;
    execFileSync(ff, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-t", "3", "-c:v", "libvpx-vp9", out]);
    const clip = readFileSync(out);
    await base(page);
    await page.route("**/api/generations/v1/file", (r) => r.fulfill({ status: 200, contentType: "video/webm", body: clip }));
    const code = "return { background: '#000000', render(g, t) { M.clip(g, 0, 0, 0, M.W, M.H, { fit: 'cover' }); } };";
    const version = { id: "x1", n: 1, parentId: null, label: "clip", kind: "create", aspect: "16:9", duration: 3, status: "ready", error: null, code, plan: "", audio: null, comments: [], credits: 0, starred: false, createdAt: now, updatedAt: now };
    await page.route(/\/api\/design\/motion(\/.*)?$/, (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.endsWith("/frame")) return r.fallback();
      if (r.request().method() !== "GET") return r.fulfill({ json: { id: "m1" } });
      if (u.pathname.endsWith("/api/design/motion")) return r.fulfill({ json: { items: [] } });
      return r.fulfill({ json: { id: "m1", title: "Clip", prompt: "x", settings: { aspect: "16:9", duration: 3, loop: false, audio: { sfx: false, music: false, voice: false }, brandKitId: null, model: "claude-sonnet-5-5", approval: "ask", refs: [], clips: [{ id: "v1", label: "test pattern", duration: 3 }], defaults: {} }, createdAt: now, updatedAt: now, versions: [version] } });
    });
    await page.goto("/design");
    await page.getByRole("tab", { name: /Motion/ }).click();
    await page.getByRole("textbox", { name: "Describe your motion" }).fill("play my clip");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("slider", { name: "Time" }).fill("1.2");
    const lit = () => page.frameLocator("iframe.mt-frame").locator("canvas").evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 300) n++; return n;
    });
    await expect.poll(lit, { timeout: 20_000 }).toBeGreaterThan(1000);
    await expect(page.locator(".mt-err")).toHaveCount(0);
  });
});
