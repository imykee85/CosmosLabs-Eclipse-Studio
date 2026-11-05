import { expect, test, type Page } from "@playwright/test";

// ShotMap in Video Studio (preview mode, every API answered by a mock): the chip opens a tray, the tray opens its own panel laid out like Relight,
// the controls change the preview, a guide is made through the sandbox job route and handed back to Video Studio as a reference clip with a built prompt.
async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const jobs: unknown[] = [];
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 100, charging: true, isAdmin: false, history: [], freeImages: 0 } }));
  await page.route("**/api/sandbox/jobs", (r) => {
    jobs.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status: 202, json: { job: { id: "j1", kind: "media.shotguide", status: "succeeded", message: null, error: null, creditsCharged: 0, output: { generationId: "g1", url: "/api/none/guide.mp4", durationSec: 8, width: 854, height: 480 } } } });
  });
  return jobs;
}

test.describe("ShotMap", () => {
  test("chip, tray, panel, guide and the hand-over to Video Studio", async ({ page }) => {
    const jobs = await setup(page);
    await page.goto("/generate");
    await page.getByRole("button", { name: "ShotMap", exact: true }).click();
    const tray = page.getByRole("toolbar", { name: "ShotMap moves" });
    await expect(tray.getByRole("button", { name: /Push in/ })).toBeVisible();
    await tray.getByRole("button", { name: /Orbit 180/ }).click();
    const panel = page.getByRole("dialog", { name: "ShotMap" });
    await expect(panel).toBeVisible();
    await expect(panel.locator(".cr-light-quick button.is-on", { hasText: "Orbit 180°" })).toBeVisible();
    // the preview draws (WebGL may be missing in some browsers: then the message shows instead and the rest still works)
    await expect(panel.locator("canvas.sm-canvas, .cr-light-flat").first()).toBeVisible({ timeout: 15000 });
    await panel.getByRole("button", { name: "Shin height" }).click();
    await expect(panel.getByRole("button", { name: "Shin height" })).toHaveClass(/is-on/);
    await panel.getByRole("button", { name: "Map" }).click();
    await expect(panel.locator("svg.sm-map")).toBeVisible();
    await panel.getByRole("button", { name: "Add a person" }).click();
    await expect(panel.getByRole("tab")).toHaveCount(2);
    await panel.getByRole("button", { name: "Add a vehicle with a driver" }).click();
    await expect(panel.getByRole("tab")).toHaveCount(4);
    await panel.getByLabel("Who is this").fill("a barista in her thirties");
    await panel.getByRole("button", { name: "9:16" }).click();
    await panel.getByRole("button", { name: "Make guide video" }).click();
    await expect(panel.getByLabel("Guide video")).toBeVisible();
    const sent = jobs[0] as { kind: string; input: { scene: { cameras: unknown[]; actors: unknown[]; shots: { aspect: string }[] }; res: string } };
    expect(sent.kind).toBe("media.shotguide"); expect(sent.input.scene.shots[0].aspect).toBe("9:16"); expect(sent.input.scene.actors.length).toBe(3); expect(sent.input.res).toBe("480");
    await panel.getByRole("button", { name: "Use in Video Studio" }).click();
    await expect(panel).toBeHidden();
    await expect(page.locator("#vs-prompt")).toHaveValue(/Use video 1 only as the guide/);
    await expect(page.locator("#vs-prompt")).toHaveValue(/barista in her thirties/);
    await expect(page.getByRole("button", { name: /Ingredients \(1\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Video model/ })).toContainText("Seedance 2.5");
  });
  test("it fits a phone without sideways scroll", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 520, height: 900 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await setup(page);
    await page.goto("/generate");
    await page.getByRole("button", { name: "ShotMap", exact: true }).click();
    await page.getByRole("toolbar", { name: "ShotMap moves" }).getByRole("button", { name: /Open ShotMap/ }).click();
    const panel = page.getByRole("dialog", { name: "ShotMap" });
    await expect(panel).toBeVisible();
    const over = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
    await ctx.close();
  });
});
