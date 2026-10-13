import { test, expect } from "@playwright/test";

test.describe("public site", () => {
  test("the landing page loads with its heading and a way in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Eclipse/);
    await expect(page.getByRole("heading", { name: /Eclipse Studio/i }).first()).toBeVisible();
  });

  test("terms and privacy are public", async ({ page }) => {
    for (const path of ["/terms", "/privacy"]) {
      const r = await page.goto(path);
      expect(r?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("search and sharing files are public and sensible", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("/api/");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/terms");
    const og = await request.get("/opengraph-image");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
  });

  test("an unknown address shows the not-found page", async ({ page }) => {
    const r = await page.goto("/this-page-does-not-exist");
    expect(r?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("security headers are set", async ({ request }) => {
    const r = await request.get("/");
    const h = r.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toBeTruthy();
  });
});

test.describe("signed-in app (demo mode)", () => {
  test("the demo login reaches the dashboard", async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill('input[type="email"]', "demo@eclipse.test");
    await page.fill('input[type="password"]', "demo1234");
    await page.locator('button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("a project opens the studios and the Library shows uniform tiles", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    const base = { prompt: "x", model: "m", modelLabel: "M", status: "completed", error: null, credits: 1, createdAt: new Date().toISOString(), deletedAt: null, references: null, seed: null, seedLocked: false, projectId: "p1", fileName: "a", contentType: "image/png", sizeBytes: 10, width: null, height: null, resolution: null, startedAt: null, imageUrl: "https://example.test/a.png" };
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await page.route("https://example.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
    await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [{ ...base, id: "i1", kind: "image", aspectRatio: "16:9" }, { ...base, id: "i2", kind: "image", aspectRatio: "9:16" }, { ...base, id: "i3", kind: "image", aspectRatio: "1:1" }] } }));
    await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 100, entries: [] } }));
    await page.goto("/library?kind=all");
    const tiles = page.locator(".lib-tile img");
    await expect(tiles).toHaveCount(3);
    const sizes = await tiles.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }));
    expect(new Set(sizes).size).toBe(1); // every tile the same fixed square, whatever the picture's shape
  });

  test("Image Studio and Video Studio open", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], entries: [], balance: 0, models: [], creditsOn: false, paused: false, ready: true } }));
    await page.goto("/create");
    await expect(page.getByRole("heading", { name: "Image Studio" })).toBeVisible();
    await page.goto("/generate");
    await expect(page.getByRole("heading", { name: "Video Studio" })).toBeVisible();
  });
});

test.describe("agents", () => {
  test("Atlas is the built-in agent and you can create your own", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    const mine: { id: string; name: string; role: string; instructions: string }[] = [];
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], entries: [], balance: 0, models: [] } }));
    await page.route("**/api/user-agents", async (r) => {
      if (r.request().method() === "POST") { const b = r.request().postDataJSON(); const a = { id: "a1", ...b }; mine.push(a); return r.fulfill({ json: a }); }
      return r.fulfill({ json: { items: mine } });
    });
    await page.goto("/agents");
    await expect(page.getByRole("heading", { name: "Atlas" })).toBeVisible();
    await page.getByRole("button", { name: /Create your own/ }).click();
    await page.getByPlaceholder("For example Nova").fill("Nova");
    await page.getByPlaceholder(/Tone, focus/).fill("Ask about the season first and keep replies short.");
    await page.getByRole("button", { name: "Save agent" }).click();
    await expect(page.getByRole("heading", { name: "Nova" })).toBeVisible();
    // the new agent is chosen, and the prompt box chip shows it
    await page.goto("/create");
    await expect(page.locator('button[title="Choose your agent"]')).toContainText("Nova");
    await page.locator('button[title="Choose your agent"]').click();
    await expect(page.getByRole("menuitemradio", { name: /Atlas/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Create your own agent/ })).toBeVisible();
  });
});

test.describe("prompt box messages", () => {
  test("an error sits on the top edge of the Image Studio prompt box and Atlas is told about it", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
      localStorage.setItem("eclipse-agent", "Atlas");
      localStorage.setItem("eclipse-agent-on", "1");
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0 } }));
    await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [{ id: "m", label: "Model", blurb: "x", ratios: ["1:1"], resolutions: [], maxBatch: 4, maxPrompt: 2000, verified: true, autoPick: true, seed: { supported: false }, maxReferences: 0, requiresReference: false, credits: null }] } }));
    await page.route("**/api/generate", (r) => r.fulfill({ status: 400, json: { error: "The provider said no." } }));
    let sent: { context?: { message?: string } } | null = null;
    await page.route("**/api/agent/chat", (r) => { sent = r.request().postDataJSON(); return r.fulfill({ json: { text: "ok", actions: [] } }); });
    await page.goto("/create");
    await page.fill("textarea", "a red square");
    await page.click(".cr-go");
    const edge = page.locator(".cr-edge");
    await expect(edge).toHaveText("The provider said no.");
    const e = (await edge.boundingBox())!;
    const f = (await page.locator("form.cr-box").boundingBox())!;
    expect(Math.abs(e.y + e.height - f.y)).toBeLessThanOrEqual(2);
    await expect(page.locator(".cr-hint")).toHaveCount(0);
    await page.click(".aw-btn");
    await page.fill(".aw-input input", "what went wrong?");
    await page.click('.aw-input button[type="submit"]');
    await expect.poll(() => sent?.context?.message).toBe("The provider said no.");
  });
});

test.describe("prompt box drafts", () => {
  const seed = async (page: import("@playwright/test").Page) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0 } }));
    await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [{ id: "m", label: "Model", blurb: "x", ratios: ["1:1", "9:16"], resolutions: [], maxBatch: 4, maxPrompt: 2000, verified: true, autoPick: true, seed: { supported: false }, maxReferences: 3, requiresReference: false, credits: null }] } }));
  };

  test("Image Studio keeps the text and the attached pictures through a refresh", async ({ page }) => {
    await seed(page);
    await page.goto("/create");
    await page.fill("textarea", "a red square on a table");
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("eclipse-draft-create") ?? "{}");
      localStorage.setItem("eclipse-draft-create", JSON.stringify({ ...d, refs: [{ type: "upload", id: "u1", label: "jacket" }, { type: "render", id: "r1", label: "face" }] }));
    });
    await page.reload();
    await expect(page.locator("textarea")).toHaveValue("a red square on a table");
    await expect(page.locator(".cr-refs img, .cr-ref img")).toHaveCount(2);
  });

  test("Video Studio keeps the text through a refresh", async ({ page }) => {
    await seed(page);
    await page.goto("/generate");
    await page.fill("textarea", "a slow dolly shot");
    await page.reload();
    await expect(page.locator("textarea")).toHaveValue("a slow dolly shot");
  });

  test("a prompt sent from another page wins over the saved draft", async ({ page }) => {
    await seed(page);
    await page.goto("/create");
    await page.fill("textarea", "old draft");
    await page.goto("/create?prompt=from%20Prompts");
    await expect(page.locator("textarea")).toHaveValue("from Prompts");
  });
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 520, height: 900 }, isMobile: true, hasTouch: true, screen: { width: 390, height: 844 } });
  test("the app fills a phone at 520 px with no sideways scroll", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], entries: [], balance: 0, models: [], creditsOn: false, paused: false, ready: true } }));
    await page.goto("/create");
    await page.waitForTimeout(800);
    const w = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(w.inner).toBe(520);
    expect(w.scroll).toBeLessThanOrEqual(520);
  });
});
