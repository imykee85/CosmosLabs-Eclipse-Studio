import { expect, test, type Page } from "@playwright/test";

// Design Studio (preview mode, every API mocked): the three tabs, graphic starters that open Image Studio, the 3D generator form and its model list.
async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
  });
  const posts: Record<string, unknown>[] = [];
  const models = [
    { id: "meshy_v7_image_to_3d", label: "Meshy 7", maker: "Meshy", modes: ["image"], minImages: 1, maxImages: 1, blurb: "One picture to a textured model", polyMin: 100, polyMax: 300000, polyDefault: 30000, credits: 4 },
    { id: "meshy_multi_image_to_3d", label: "Meshy Multi-view", maker: "Meshy", modes: ["multi"], minImages: 1, maxImages: 4, blurb: "Several views", polyMin: 100, polyMax: 300000, polyDefault: 30000, credits: 5 },
    { id: "meshy_v6_text_to_3d", label: "Meshy 6 (text)", maker: "Meshy", modes: ["text"], minImages: 0, maxImages: 0, blurb: "Describe it", polyMin: 100, polyMax: 300000, polyDefault: 30000, credits: 3 },
  ];
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 100 } }));
  await page.route("**/api/design/3d**", (r) => {
    if (r.request().method() === "POST") { posts.push(JSON.parse(r.request().postData() || "{}")); return r.fulfill({ json: { id: "m1", status: "pending" } }); }
    return r.fulfill({ json: { items: [{ id: "m0", model: "meshy_v7_image_to_3d", modelLabel: "Meshy 7", mode: "image", name: "Old boat", prompt: "", status: "failed", error: "The model could not be made. Nothing was charged.", sizeBytes: null, createdAt: new Date().toISOString(), fileUrl: null, inputs: [] }], models } });
  });
  return posts;
}

test.describe("Design Studio", () => {
  test("tabs: 3D is first, Graphics is gone, Motion shows its composer", async ({ page }) => {
    await setup(page);
    await page.goto("/design");
    await expect(page.getByRole("main").getByRole("heading", { name: "Design Studio" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /3D/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Graphics" })).toHaveCount(0);
    await page.getByRole("tab", { name: /Motion/ }).click();
    await expect(page.getByRole("textbox", { name: "Describe your motion" })).toBeVisible();
  });

  test("3D: modes switch the models; text mode sends the words; failures are shown plainly", async ({ page }) => {
    const posts = await setup(page);
    await page.goto("/design");
    const gen = page.getByRole("region", { name: "3D generator" });
    await expect(gen.getByRole("button", { name: "Make 3D model" })).toBeDisabled();
    await expect(gen.getByText("The model could not be made. Nothing was charged.")).toBeVisible();
    await gen.getByRole("combobox", { name: "How to start" }).selectOption({ label: "Describe it" });
    await expect(gen.getByRole("combobox", { name: "3D model" })).toContainText("Meshy 6 (text)");
    await gen.getByRole("textbox", { name: "Describe the model" }).fill("A weathered wooden fishing boat");
    await gen.getByRole("button", { name: /Make 3D model/ }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ model: "meshy_v6_text_to_3d", mode: "text", prompt: "A weathered wooden fishing boat", refs: [] });
    await gen.getByRole("combobox", { name: "How to start" }).selectOption({ label: "Several views" });
    await expect(gen.getByText(/front, left, right, back/)).toBeVisible();
  });

  test("it fits a phone without sideways scroll, and the Create page lists the studio", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 520, height: 900 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await setup(page);
    await page.goto("/design");
    await expect(page.getByRole("main").getByRole("heading", { name: "Design Studio" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.goto("/project");
    await expect(page.getByRole("link", { name: /Design Studio/ })).toHaveAttribute("href", "/design");
    await ctx.close();
  });
});
