import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Design Studio Motion (preview mode, every API mocked): a brief starts a motion, the sandboxed frame really draws the written code,
// comments pin to a moment, sound waits for approval, and Download turns the motion into a real MP4 in the browser.
const code = readFileSync("tests/fixtures/motion-sample.js", "utf8");
const now = new Date().toISOString();
const ver = (o: object = {}) => ({ id: "v1", n: 1, parentId: null, label: "GO BEYOND", kind: "create", aspect: "16:9", duration: 3, status: "ready", error: null, code, plan: "0-3s GO BEYOND", audio: null, comments: [], credits: 2, starred: false, createdAt: now, updatedAt: now, ...o });

async function setup(page: Page, v: object = {}) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let version: any = ver(v);
  await page.route("**/api/**", (r) => r.request().url().endsWith("/motion/frame") ? r.fallback() : r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/design/brand-kits**", (r) => r.fulfill({ json: { items: [] } }));
  await page.route(/\/api\/design\/motion(\/.*)?$/, (r) => {
    const u = new URL(r.request().url()), m = r.request().method();
    if (u.pathname.endsWith("/frame")) return r.fallback();
    if (m !== "GET") { const body = JSON.parse(r.request().postData() || "{}"); posts.push({ url: u.pathname, body });
      if (body.action === "comment") version = { ...version, comments: [{ id: "c1", t: body.t, x: body.x, y: body.y, text: body.text, at: now }] };
      if (body.action === "approve") version = { ...version, status: "ready", audio: { ...version.audio, approval: "approved" } };
      return r.fulfill({ json: { id: "m1", ok: true } }); }
    if (u.pathname.endsWith("/api/design/motion")) return r.fulfill({ json: { items: [] } });
    return r.fulfill({ json: { id: "m1", title: "Go Beyond", prompt: "GO BEYOND", settings: { aspect: "16:9", duration: 3, loop: false, audio: { sfx: false, music: false, voice: false }, brandKitId: null, model: "pro", approval: "ask", refs: [] }, createdAt: now, updatedAt: now, versions: [version] } });
  });
  return posts;
}
const tab = async (page: Page) => { await page.goto("/design"); await page.getByRole("tab", { name: /Motion/ }).click(); };
const ink = (page: Page) => page.frameLocator("iframe.mt-frame").locator("canvas").evaluate((c: HTMLCanvasElement) => {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 300) lit++; return lit;
});

test.describe("Design Studio Motion", () => {
  test("a brief starts a motion; the frame draws the code; a comment pins to the moment", async ({ page }) => {
    const posts = await setup(page);
    await tab(page);
    await page.getByRole("textbox", { name: "Describe your motion" }).fill("Bold kinetic type: GO BEYOND");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => posts.find((p) => p.url === "/api/design/motion")?.body.prompt).toBe("Bold kinetic type: GO BEYOND");
    await expect(page.getByRole("region", { name: "Motion editor" })).toBeVisible();
    await page.getByRole("slider", { name: "Time" }).fill("1.5");
    await expect.poll(() => ink(page), { timeout: 15_000 }).toBeGreaterThan(50);
    await expect(page.locator(".mt-err")).toHaveCount(0);
    if (process.env.MT_SHOT) await page.screenshot({ path: process.env.MT_SHOT });
    await page.getByRole("button", { name: /^Comment$/ }).click();
    await page.getByRole("button", { name: "Click to pin a comment here" }).click({ position: { x: 100, y: 60 } });
    await page.getByRole("textbox", { name: "Comment" }).fill("Make this word gold");
    await page.getByRole("button", { name: "Comment", exact: true }).click();
    await expect.poll(() => posts.find((p) => p.body.action === "comment")?.body.text).toBe("Make this word gold");
  });

  test("sound waits for approval with its price", async ({ page }) => {
    const posts = await setup(page, { status: "approval", audio: { approval: "waiting", music: { prompt: "Upbeat synth", credits: 3, status: "waiting" } } });
    await tab(page); await page.getByRole("textbox", { name: "Describe your motion" }).fill("GO BEYOND");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    const box = page.getByRole("region", { name: "Generations to approve" });
    await expect(box.getByText("Upbeat synth")).toBeVisible();
    await box.getByRole("button", { name: /Approve and generate · 3 credits/ }).click();
    await expect.poll(() => posts.find((p) => p.body.action === "approve")).toBeTruthy();
  });

  test("Download makes a real MP4 in the browser", async ({ page }) => {
    await setup(page);
    await tab(page); await page.getByRole("textbox", { name: "Describe your motion" }).fill("GO BEYOND");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("slider", { name: "Time" }).fill("1.5");
    await expect.poll(() => ink(page), { timeout: 15_000 }).toBeGreaterThan(50);
    await page.getByRole("button", { name: "Download" }).click();
    const dl = page.waitForEvent("download", { timeout: 90_000 });
    await page.getByRole("dialog").getByRole("button", { name: "Download" }).click();
    const file = await (await dl).path();
    const head = readFileSync(file!).subarray(4, 8).toString("latin1");
    expect(head).toBe("ftyp");
  });
});
