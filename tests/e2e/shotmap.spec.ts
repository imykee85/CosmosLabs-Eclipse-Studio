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
  const clipVideo = { id: "v1", prompt: "a clip", model: "seedance_2_5", modelLabel: "Seedance 2.5", status: "completed", error: null, credits: 1, createdAt: new Date().toISOString(), deletedAt: null, references: null, seed: null, seedLocked: false, projectId: "p1", fileName: "a.mp4", contentType: "video/mp4", sizeBytes: 10, width: 320, height: 180, resolution: "720p", startedAt: null, imageUrl: "/api/generations/v1/file", kind: "video", durationSec: 3, aspectRatio: "16:9" };
  await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [clipVideo] } }));
  await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 100, charging: true, isAdmin: false, history: [], freeImages: 0 } }));
  await page.route("**/api/sandbox/jobs", (r) => {
    jobs.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status: 202, json: { job: { id: "j1", kind: "media.shotguide", status: "succeeded", message: null, error: null, creditsCharged: 0, output: { generationId: "g1", url: "/api/none/guide.mp4", durationSec: 8, width: 854, height: 480 } } } });
  });
  return jobs;
}

async function pick(page: Page) { await page.getByRole("button", { name: "a clip" }).first().click(); }

test.describe("ShotMap", () => {
  test("rebuild from a picture fills the scene and Edit scene opens only when asked", async ({ page }) => {
    await setup(page);
    await page.route("**/api/shot/rebuild", (r) => r.fulfill({ json: { setup: { kit: "street", cast: [{ id: "rp1", kind: "person", label: "", color: "red", x: 1, z: 0, moves: false, toX: 1, toZ: 0, build: "woman", pose: "sitting", pose2: null, pose2At: 3, vtype: "car" }], objects: [{ id: "ro1", type: "bench", x: 1, z: 0, rot: 0, scale: 1 }], lensMm: 50, distance: 5, vertical: 0, preset: "push-in", durationS: 8, shake: 0, aspect: "1:1", seed: 7 }, people: 1, objects: 1 } }));
    await page.goto("/generate");
    await pick(page);
    await page.getByRole("button", { name: /^Motion/ }).click(); await page.getByRole("menuitemradio", { name: /ShotMap/ }).click();
    const panel = page.getByRole("dialog", { name: "ShotMap" });
    await expect(panel.getByText("Edit scene")).toBeVisible();
    await expect(panel.locator("details.sm-edit")).not.toHaveAttribute("open", ""); // folded by default, picture or not
    await panel.getByPlaceholder("Paste the video prompt (optional)").fill("She sits on the bench");
    await panel.getByRole("button", { name: "Rebuild the scene" }).click();
    await expect(panel.getByText(/Rebuilt with 1 person and 1 object/)).toBeVisible();
    await expect(panel.locator("details.sm-edit")).not.toHaveAttribute("open", "");
    await panel.getByText("Edit scene").click();
    await expect(panel.getByRole("tablist", { name: "Objects" })).toBeVisible();
    await expect(panel.getByRole("tablist", { name: "Objects" }).getByRole("tab")).toHaveCount(1);
  });

  test("chip, tray, panel, guide and the hand-over to Video Studio", async ({ page }) => {
    const jobs = await setup(page);
    await page.goto("/generate");
    const tray = page.getByRole("toolbar", { name: "Video tools" });
    await expect(tray.getByRole("button", { name: /Relight/ })).toHaveCount(0);
    await pick(page);
    await page.getByRole("button", { name: /^Motion/ }).click(); await page.getByRole("menuitemradio", { name: /ShotMap/ }).click();
    const panel = page.getByRole("dialog", { name: "ShotMap" });
    await expect(panel).toBeVisible();
    const mv = panel.getByRole("group", { name: "Camera move", exact: true });
    await mv.getByRole("button", { name: /Dolly/ }).click(); // push in is the default: tapping it again clears it
    await expect(mv.getByRole("button", { name: /Dolly/ })).not.toHaveClass(/is-on/);
    await mv.getByRole("button", { name: /Dolly/ }).click();
    await panel.getByRole("listbox", { name: "Camera move: Dolly" }).getByRole("button", { name: "Out" }).click();
    await expect(mv.getByRole("button", { name: /Dolly/ })).toContainText("Out");
    await panel.getByRole("group", { name: "Second move", exact: true }).getByRole("button", { name: /Orbit/ }).click();
    await panel.getByRole("listbox", { name: "Second move: Orbit" }).getByRole("button", { name: "360°" }).click();
    await expect(panel.getByRole("group", { name: "How the moves combine" })).toBeVisible();
    await panel.getByRole("button", { name: "One after the other" }).click();
    await expect(panel.locator("#sm-split")).toBeVisible();
    await expect(panel.locator("#sm-rot, #sm-vert, #sm-speed")).toHaveCount(3);
    await expect(panel.getByRole("group", { name: "Aspect ratio" })).toHaveCount(0);
    // the preview draws (WebGL may be missing in some browsers: then the message shows instead and the rest still works)
    await expect(panel.locator("canvas.sm-canvas, .cr-light-flat").first()).toBeVisible({ timeout: 15000 });
    await panel.getByRole("group", { name: "Camera move", exact: true }).getByRole("button", { name: /Look/ }).click();
    await panel.getByRole("listbox", { name: "Camera move: Look" }).getByRole("button", { name: "Shin height" }).click();
    await panel.getByRole("button", { name: "Add a camera" }).click();
    await expect(panel.getByRole("tab", { name: "2" })).toBeVisible();
    await panel.getByRole("button", { name: "Remove this camera" }).click();
    await expect(mv.getByRole("button", { name: /Look/ })).toContainText("Shin height");
    await panel.getByRole("button", { name: "Stage", exact: true }).click();
    await expect(panel.locator("canvas.sm-orbit, .cr-light-flat").first()).toBeVisible({ timeout: 15000 });
    await expect(panel.locator("canvas.sm-inset, .cr-light-flat").first()).toBeVisible();
    await panel.locator("canvas.sm-orbit").hover(); await page.mouse.wheel(0, 200);
    await panel.getByRole("button", { name: "Map", exact: true }).click();
    await expect(panel.locator("svg.sm-map")).toBeVisible();
    await panel.getByText("Edit scene").click(); // the scene controls are folded until needed
    await panel.getByLabel("Add an object").selectOption("horse");
    await expect(panel.locator("svg.sm-map rect")).toHaveCount(1);
    await panel.getByRole("button", { name: "Remove this object" }).click();
    await expect(panel.locator("svg.sm-map rect")).toHaveCount(0);
    await panel.getByLabel("Then", { exact: true }).selectOption("walking");
    await panel.getByRole("button", { name: "Add another action" }).click();
    await expect(panel.getByLabel("Action 3", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Add a person" }).click();
    await expect(panel.getByRole("tablist", { name: "Cast" }).getByRole("tab")).toHaveCount(2);
    await panel.getByRole("button", { name: "Add a vehicle with a driver" }).click();
    await expect(panel.getByRole("tablist", { name: "Cast" }).getByRole("tab")).toHaveCount(4);
    await panel.getByLabel("Who is this").fill("a barista in her thirties");
    await panel.getByRole("button", { name: "Make guide video" }).click();
    await expect(panel.getByLabel("Guide video")).toBeVisible();
    const sent = jobs[0] as { kind: string; input: { scene: { cameras: unknown[]; actors: unknown[]; shots: { aspect: string }[] }; res: string } };
    expect(sent.kind).toBe("media.shotguide"); expect(sent.input.scene.shots[0].aspect).toBe("1:1"); expect(sent.input.scene.actors.length).toBe(3); expect(sent.input.res).toBe("480");
    await panel.getByRole("button", { name: "Use in Video Studio" }).click();
    await expect(panel).toBeHidden();
    await expect(page.locator("#vs-prompt")).toHaveValue(/Use video 1 only as the guide/);
    await expect(page.locator("#vs-prompt")).toHaveValue(/barista in her thirties/);
    await expect(page.getByRole("button", { name: /Ingredients \(1\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Video model/ })).toContainText("Seedance 2.5");
    await expect(page.locator("#vs-prompt")).toHaveValue(/ignore the shape of its frame/);
  });
  test("it fits a phone without sideways scroll", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 520, height: 900 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await setup(page);
    await page.goto("/generate");
    await pick(page);
    await page.getByRole("button", { name: /^Motion/ }).click(); await page.getByRole("menuitemradio", { name: /ShotMap/ }).click();
    const panel = page.getByRole("dialog", { name: "ShotMap" });
    await expect(panel).toBeVisible();
    const over = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
    await ctx.close();
  });
});
