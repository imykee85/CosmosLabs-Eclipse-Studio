import { test, expect } from "@playwright/test";
import { hash } from "../../src/lib/i18n/text";

test.describe("language and local prices", () => {
  test("a visitor from Colombia gets Spanish and a peso badge next to each plan price; one from the US gets neither", async ({ browser }) => {
    const co = await browser.newContext({ extraHTTPHeaders: { "x-vercel-ip-country": "CO", "accept-language": "en-US" } });
    await co.route("**/api/i18n/es", (r) => r.fulfill({ json: { d: { [hash("Get started")]: "Empezar" }, n: 1, t: 1 } }));
    const page = await co.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator(".plan-card .pill-btn").first()).toHaveText("Empezar");
    await expect(page.locator(".plan-card .price-badge").first()).toContainText("COP");
    await expect(page.locator(".plan-price").first()).toContainText("$19"); // the real price stays in dollars
    await co.close();
    const us = await browser.newContext({ extraHTTPHeaders: { "x-vercel-ip-country": "US", "accept-language": "en-US" } });
    const p2 = await us.newPage();
    await p2.goto("/");
    await expect(p2.locator(".plan-card").first()).toBeVisible();
    await expect(p2.locator("html")).toHaveAttribute("lang", "en");
    expect(await p2.locator(".price-badge").count()).toBe(0);
    await us.close();
  });
});

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

  test("the sidebar follows the work (PLAN, CREATE, FILES, UTILITIES); Library is in the desktop sidebar, not in the phone drawer", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], entries: [], balance: 0, models: [] } }));
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto("/create");
    const side = page.locator(".ws-sidebar");
    expect((await side.locator(".ws-section-head").allInnerTexts()).map((t) => t.trim())).toEqual(["PLAN", "CREATE", "FILES", "UTILITIES"]);
    const rows = async (el: typeof side) => (await el.locator(".ws-item-text b").allInnerTexts()).map((t) => t.trim());
    expect(await rows(side)).toEqual(["Treatment", "Prompts", "Image Studio", "Video Studio", "Audio Studio", "Library", "Gallery", "Assets", "Ingredients", "Core", "Agents", "Canvas"]);
    // phone: the same groups in the drawer, without Library (it is the bottom tab)
    await page.setViewportSize({ width: 520, height: 900 });
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.locator(".mb-nav");
    expect((await drawer.locator(".ws-section-head").allInnerTexts()).map((t) => t.trim())).toEqual(["PLAN", "CREATE", "FILES", "UTILITIES"]);
    expect(await rows(drawer as typeof side)).toEqual(["Treatment", "Prompts", "Image Studio", "Video Studio", "Audio Studio", "Gallery", "Assets", "Ingredients", "Core", "Agents", "Canvas"]);
    await expect(page.locator(".mb-tabs").getByText("Library")).toBeVisible();
  });

  test("double-tapping the Create tab lists only the CREATE group", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], entries: [], balance: 0, models: [] } }));
    await page.setViewportSize({ width: 520, height: 900 });
    await page.goto("/create");
    const tab = page.locator(".mb-tabs a").filter({ hasText: /Image Studio|Create/ }).first();
    await tab.click();
    await tab.click();
    const menu = page.getByRole("menu", { name: "Shortcuts" });
    await expect(menu).toBeVisible();
    expect((await menu.locator(".ws-section-head").allInnerTexts()).map((t) => t.trim())).toEqual(["CREATE"]);
    expect((await menu.locator(".ws-item-text b").allInnerTexts()).map((t) => t.trim())).toEqual(["Image Studio", "Video Studio", "Audio Studio"]);
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
    expect(f.y - (e.y + e.height)).toBeLessThanOrEqual(12); // plain text sitting just above the box
    expect(f.y - (e.y + e.height)).toBeGreaterThanOrEqual(0);
    await expect(page.locator(".cr-hint")).toHaveCount(0);
    await page.click(".aw-btn");
    await page.fill(".aw-input textarea", "what went wrong?");
    await page.click('.aw-input button[type="submit"]');
    await expect.poll(() => sent?.context?.message).toBe("The provider said no.");
  });
});

test.describe("Atlas chat attachments", () => {
  test("the paperclip adds a picture and it travels with the message", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
      localStorage.setItem("eclipse-agent", "Atlas");
      localStorage.setItem("eclipse-agent-on", "1");
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0 } }));
    await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [] } }));
    await page.route("**/api/uploads", (r) => r.fulfill({ json: { id: "up1", kind: "asset", name: "pic", imageUrl: "/x.png", contentType: "image/png", sizeBytes: 1, width: 1, height: 1, projectId: null, createdAt: new Date().toISOString() } }));
    await page.route("**/api/uploads/direct/start", (r) => r.fulfill({ json: { error: "stop" }, status: 400 }));
    let sent: { context?: { pictures?: { id: string }[]; videos?: { id: string }[] } } | null = null;
    await page.route("**/api/agent/chat", (r) => { sent = r.request().postDataJSON(); return r.fulfill({ json: { text: "I see it.", actions: [] } }); });
    await page.goto("/create");
    await page.click(".aw-btn");
    await expect(page.locator(".aw-clip")).toBeVisible();
    await page.setInputFiles('.aw-input input[type="file"]', { name: "pic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") });
    await expect(page.locator(".aw-att-pic")).toHaveAttribute("title", "pic");
    await page.fill(".aw-input textarea", "what is this?");
    await page.click('.aw-input button[type="submit"]');
    await expect.poll(() => sent?.context?.pictures?.[0]?.id).toBe("up1");
    await expect(page.locator(".aw-attached img")).toHaveAttribute("alt", "pic");
    await expect(page.locator(".aw-att")).toHaveCount(0);
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

test.describe("treatment", () => {
  test("the planner chat builds a treatment, keeps it, and hands it to Prompts", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0 } }));
    let body: { mode?: string; messages?: { role: string; text: string }[]; treatment?: { title: string } } | null = null;
    await page.route("**/api/treatment/chat", (r) => {
      body = r.request().postDataJSON();
      return r.fulfill({ json: { text: "Nice. Who is it for?", treatment: { title: "Night Run", logline: "A courier races dawn across the city.", structure: ["Alarm rings", "The sprint", "Sunrise"] } } });
    });
    await page.goto("/treatment");
    await page.locator(".tr-start-card", { hasText: "Describe your idea" }).click();
    await page.fill("textarea", "a courier who races the sunrise");
    await page.click(".tr-send");
    await expect(page.locator(".tr-bubble", { hasText: "Nice. Who is it for?" })).toBeVisible();
    expect(body!.mode).toBe("concept");
    expect(body!.messages!.at(-1)!.text).toBe("a courier who races the sunrise");
    await expect(page.locator(".tr-plan")).toContainText("Night Run");
    await expect(page.locator(".tr-plan li")).toHaveCount(3);
    // kept through a refresh
    await page.reload();
    await expect(page.locator(".tr-plan")).toContainText("Night Run");
    await expect(page.locator(".tr-bubble", { hasText: "Nice. Who is it for?" })).toBeVisible();
    // carried on to Prompts
    await page.click(".tr-pill-go");
    await expect(page).toHaveURL(/\/prompts/);
    await expect(page.locator("textarea").first()).toHaveValue(/Night Run/);
  });
});

test.describe("Audio Studio", () => {
  const OPT = { diarize: false, loop: false, instrumental: false, minSeconds: null, maxSeconds: null, maxInputBytes: null, maxInputSeconds: null, long: false };
  const models = [
    { id: "eleven_v4", kind: "tts", options: OPT, label: "Eleven v4", provider: "elevenlabs", providerLabel: "ElevenLabs", tags: ["[whispers]", "[laughs]"], voiceOptional: false, ready: true, maxChars: 10000, note: null, pricing: { unit: "char", perUnit: 0.0125 }, supports: { emotionTags: true, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false } },
    { id: "speech-2.8-hd", kind: "tts", options: OPT, label: "MiniMax Speech 2.8 HD", provider: "minimax", providerLabel: "MiniMax", tags: ["(laughs)"], voiceOptional: false, ready: true, maxChars: 10000, note: null, pricing: null, supports: { emotionTags: true, speed: true, pitch: false, voiceClone: false, streaming: false, subtitles: false } },
    { id: "seed-audio-1.0", kind: "tts", options: OPT, label: "Seed Audio 1.0", provider: "seed", providerLabel: "Seed Audio", tags: [], voiceOptional: true, ready: true, maxChars: 3000, note: null, pricing: { unit: "max", credits: 50 }, supports: { emotionTags: false, speed: true, pitch: false, voiceClone: false, streaming: false, subtitles: false } },
    { id: "eleven_flash_v2_5", kind: "tts", options: OPT, label: "Flash v2.5", provider: "elevenlabs", providerLabel: "ElevenLabs", tags: [], voiceOptional: false, ready: true, maxChars: 40000, note: null, pricing: { unit: "char", perUnit: 0.00625 }, supports: { emotionTags: false, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false } },
  ];

  test("write, pick a voice, add a tag, generate once, and hear the result; tags grey out on a model without them", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    const sent: Record<string, unknown>[] = [];
    let items: unknown[] = [];
    await page.route("**/api/audio/models", (r) => r.fulfill({ json: { models } }));
    await page.route("**/api/audio/voices**", (r) => r.fulfill({ json: { voices: [{ voiceId: "voiceA", name: "Ana", accent: "british" }] } }));
    await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 100, charging: true, isAdmin: false, history: [] } }));
    await page.route(/\/api\/audio(\?scope=studio)?$/, (r) => r.fulfill({ json: { items } }));
    await page.route("**/api/audio/generate", (r) => {
      const body = JSON.parse(r.request().postData() ?? "{}");
      sent.push(body);
      const item = { id: "j1", status: "completed", error: null, text: body.text, chars: body.text.length, model: body.model, modelLabel: "Eleven v4", voiceId: body.voiceId, voiceName: body.voiceName, createdAt: new Date().toISOString(), durationMs: 4000, contentType: "audio/mpeg", sizeBytes: 64000, url: "data:audio/mpeg;base64,AAAA", fileName: "x.mp3" };
      items = [item];
      return r.fulfill({ json: item });
    });
    await page.goto("/voice");
    await page.fill("#vc-text", "Hello there.");
    await page.getByRole("option", { name: "Ana" }).click();
    await page.getByRole("button", { name: "Delivery" }).click();
    await page.getByRole("menuitem", { name: "[whispers]" }).click();
    await expect(page.locator("#vc-text")).toHaveValue("Hello there. [whispers] ");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.locator(".vc-take")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ model: "eleven_v4", voiceId: "voiceA", text: "Hello there. [whispers]" });
    await page.selectOption('select[aria-label="Voice model"]', "eleven_flash_v2_5");
    await expect(page.getByRole("button", { name: "Delivery" })).toBeDisabled();
    // Every provider is in the menu, grouped; a voice is chosen per provider; MiniMax offers its own (round-bracket) tags; Seed Audio runs without a voice.
    await expect(page.locator('select[aria-label="Voice model"] optgroup')).toHaveCount(3);
    await page.selectOption('select[aria-label="Voice model"]', "speech-2.8-hd");
    await expect(page.getByRole("option", { name: "Ana", selected: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Delivery" }).click();
    await expect(page.getByRole("menuitem", { name: "(laughs)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.selectOption('select[aria-label="Voice model"]', "seed-audio-1.0");
    await page.fill("#vc-text", "A calm narrator in the rain.");
    await expect(page.locator(".vc-cost")).toHaveText("50");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1]).toMatchObject({ model: "seed-audio-1.0", voiceId: "" });
  });

  test("New voice: clone needs a name, a recording and consent; design previews can be kept; an own voice can be deleted", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    const own: Record<string, unknown>[] = [];
    const sent: { path: string; body: string }[] = [];
    let deleted = "";
    const mine = (id: string, name: string, kind: string) => ({ voiceId: id, ownId: `own_${id}`, name, kind, provider: "elevenlabs", descriptive: kind === "cloned" ? "Your clone" : "Your design" });
    await page.route("**/api/audio/models", (r) => r.fulfill({ json: { models: models.map((m) => ({ ...m, canClone: true, canDesign: true })), voiceCosts: { clone: 40, design: 60 }, consentText: "I own this voice or have written permission to clone it." } }));
    await page.route("**/api/audio/voices?**", (r) => r.fulfill({ json: { voices: own.map((v) => ({ voiceId: v.voiceId, name: v.name, descriptive: v.descriptive, own: true, ownId: v.ownId, kind: v.kind })), ready: true } }));
    await page.route(/\/api\/audio(\?scope=studio)?$/, (r) => r.fulfill({ json: { items: [] } }));
    await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 500, charging: true, isAdmin: false, history: [] } }));
    await page.route("**/api/audio/voices/clone", (r) => { sent.push({ path: "clone", body: r.request().postData() ?? "" }); const v = mine("clone1", "My voice", "cloned"); own.push(v); return r.fulfill({ json: { voice: v } }); });
    await page.route("**/api/audio/voices/design", (r) => { sent.push({ path: "design", body: r.request().postData() ?? "" }); return r.fulfill({ json: { previews: [{ token: "tokA", sig: "s".repeat(32), url: "data:audio/mpeg;base64,AAAA", durationMs: 5000 }, { token: "tokB", sig: "t".repeat(32), url: "data:audio/mpeg;base64,AAAA", durationMs: 5000 }] } }); });
    await page.route("**/api/audio/voices/design/save", (r) => { sent.push({ path: "save", body: r.request().postData() ?? "" }); const v = mine("design1", "Warm narrator", "designed"); own.push(v); return r.fulfill({ json: { voice: v } }); });
    await page.route("**/api/audio/voices/mine/**", (r) => { deleted = r.request().url().split("/").pop() ?? ""; own.splice(0, own.length); return r.fulfill({ json: { ok: true } }); });

    await page.goto("/voice");
    await page.getByRole("button", { name: "Create a voice" }).click();
    const dlg = page.getByRole("dialog", { name: "Create a voice" });
    await expect(dlg.getByRole("button", { name: "Create voice" })).toContainText("40");
    await dlg.getByRole("button", { name: "Create voice" }).click();
    await expect(dlg.getByRole("alert")).toContainText("Give the voice a name");
    await dlg.getByLabel("Voice name").fill("My voice");
    await dlg.getByRole("button", { name: "Create voice" }).click();
    await expect(dlg.getByRole("alert")).toContainText("recording");
    await dlg.getByLabel("Voice recording").setInputFiles({ name: "me.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("ID3 fake audio") });
    await expect(dlg).toContainText("me.mp3");
    await dlg.getByRole("button", { name: "Create voice" }).click();
    await expect(dlg.getByRole("alert")).toContainText("permission");
    expect(sent).toHaveLength(0);
    await dlg.getByLabel("I own this voice or have written permission to clone it.").check();
    await dlg.getByRole("button", { name: "Create voice" }).click();
    await expect(dlg).toBeHidden();
    expect(sent[0].path).toBe("clone");
    expect(sent[0].body).toContain('name="consent"');
    expect(sent[0].body).toContain("elevenlabs");
    // the new voice is chosen and sits first in the strip
    await expect(page.getByRole("option", { name: "My voice" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Create a voice" }).click();
    await dlg.getByRole("tab", { name: "Design a voice" }).click();
    await dlg.getByLabel("Describe the voice").fill("too short");
    await dlg.getByRole("button", { name: "Design voice" }).click();
    await expect(dlg.getByRole("alert")).toContainText("at least 20");
    await dlg.getByLabel("Describe the voice").fill("A warm, calm woman in her forties with a soft accent");
    await dlg.getByRole("button", { name: "Design voice" }).click();
    await expect(dlg.getByRole("list", { name: "Voice previews" }).getByRole("listitem")).toHaveCount(2);
    await dlg.getByLabel("Voice name").fill("");
    await dlg.getByRole("button", { name: "Save voice" }).first().click();
    await expect(dlg.getByRole("alert")).toContainText("Name your voice");
    await dlg.getByLabel("Voice name").fill("Warm narrator");
    await dlg.getByRole("button", { name: "Save voice" }).first().click();
    await expect(dlg).toBeHidden();
    expect(JSON.parse(sent.find((x) => x.path === "save")!.body)).toMatchObject({ provider: "elevenlabs", token: "tokA", name: "Warm narrator" });
    await expect(page.getByRole("option", { name: "Warm narrator" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Search all voices" }).click();
    await page.getByRole("button", { name: "Delete Warm narrator" }).click();
    await page.getByRole("group", { name: "Delete Warm narrator?" }).getByRole("button", { name: "Delete" }).click();
    await expect.poll(() => deleted).toBe("own_design1");
    await expect(page.getByRole("button", { name: "Delete Warm narrator" })).toHaveCount(0);
  });

  test("Transcribe, Effects and Music: each mode collects its input, sends the right job, and a finished transcript can be read, copied and downloaded", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    const mk = (id: string, label: string, kind: string, provider: string, providerLabel: string, over: Record<string, unknown> = {}, ready = true) => ({
      id, label, kind, provider, providerLabel, ready, canClone: false, canDesign: false, maxChars: kind === "stt" ? 0 : 1000, note: null, tags: [], voiceOptional: false, pricing: { unit: "sec", perSec: 0.1 },
      options: { ...OPT, ...over }, supports: { emotionTags: false, speed: false, pitch: false, voiceClone: false, streaming: false, subtitles: false },
    });
    let all = [
      mk("eleven_v4", "Eleven v4", "tts", "elevenlabs", "ElevenLabs"),
      mk("scribe_v2", "ElevenLabs Scribe v2", "stt", "elevenlabs", "ElevenLabs", { diarize: true, maxInputBytes: 200 * 1048576 }),
      mk("asr-1.0", "MiniMax ASR 1.0", "stt", "minimax", "MiniMax", { maxInputBytes: 50 * 1048576 }),
      mk("eleven_text_to_sound_v2", "ElevenLabs Sound Effects", "sfx", "elevenlabs", "ElevenLabs", { loop: true, minSeconds: 0.5, maxSeconds: 30 }),
      mk("music_v2_5", "ElevenLabs Music", "music", "elevenlabs", "ElevenLabs", { instrumental: true, minSeconds: 3, maxSeconds: 240 }),
    ];
    const sent: Record<string, unknown>[] = [];
    let uploads = 0;
    const transcript = { text: "Hello there. Hi back", segments: [{ text: "Hello there.", start: 0, end: 0.9, speaker: "Speaker 1" }, { text: "Hi back", start: 65, end: 66, speaker: "Speaker 2" }] };
    const done = { id: "t1", kind: "stt", status: "completed", error: null, text: "talk.mp3", chars: 8, model: "scribe_v2", modelLabel: "ElevenLabs Scribe v2", voiceId: null, voiceName: null, createdAt: new Date().toISOString(), durationMs: 66000, contentType: null, sizeBytes: null, url: null, fileName: "x.txt", transcript };
    let items: unknown[] = [done];
    await page.route("**/api/audio/models", (r) => r.fulfill({ json: { models: all, voiceCosts: { clone: null, design: null }, consentText: "x" } }));
    await page.route("**/api/audio/voices?**", (r) => r.fulfill({ json: { voices: [], ready: true } }));
    await page.route(/\/api\/audio(\?scope=studio)?$/, (r) => r.fulfill({ json: { items } }));
    await page.route("**/api/credits", (r) => r.fulfill({ json: { balance: 500, charging: true, isAdmin: false, history: [] } }));
    await page.route("**/api/audio/input", (r) => { uploads++; return r.fulfill({ json: { key: "audio/u/in/abc.mp3", url: "http://localhost:3101/fake-r2/abc.mp3" } }); });
    await page.route("**/fake-r2/**", (r) => r.fulfill({ status: 200, body: "" }));
    await page.route("**/api/audio/generate", (r) => { sent.push(JSON.parse(r.request().postData() ?? "{}")); return r.fulfill({ json: { ...done, id: "n1", status: "pending", transcript: null } }); });

    await page.goto("/voice");
    // Transcribe
    await page.getByRole("tab", { name: "Transcribe" }).click();
    await page.getByRole("button", { name: "Transcribe" }).click();
    await expect(page.locator(".vc-error")).toContainText("Add a recording first");
    await page.getByLabel("Recording", { exact: true }).setInputFiles({ name: "talk.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(32000, 1) });
    await expect(page.getByText("talk.mp3 · 32 KB")).toBeVisible();
    await page.getByRole("button", { name: "Speakers" }).click();
    await page.getByRole("button", { name: "Transcribe" }).click();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ kind: "stt", model: "scribe_v2", inputKey: "audio/u/in/abc.mp3", inputName: "talk.mp3", diarize: true });
    expect(uploads).toBe(1);
    await page.selectOption('select[aria-label="Model"]', "asr-1.0");
    await expect(page.getByRole("button", { name: "Speakers" })).toBeDisabled();
    // the finished transcript: read with times, copy, download text and subtitles
    await page.getByRole("button", { name: "Show with times" }).click();
    await expect(page.getByRole("list", { name: "Transcript with times" })).toContainText("01:05");
    await expect(page.getByRole("list", { name: "Transcript with times" })).toContainText("Speaker 2");
    const [d1] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Subtitles" }).click()]);
    expect(d1.suggestedFilename()).toBe("talk.srt");
    const [d2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Text" }).click()]);
    expect(d2.suggestedFilename()).toBe("talk.txt");

    // Effects
    await page.getByRole("tab", { name: "Effects" }).click();
    await page.getByLabel("Describe the sound").fill("Rain on a tin roof");
    await page.selectOption('select[aria-label="Length"]', "5");
    await page.getByRole("button", { name: "Loop" }).click();
    await page.getByRole("button", { name: "Make sound" }).click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1]).toMatchObject({ kind: "sfx", model: "eleven_text_to_sound_v2", text: "Rain on a tin roof", durationSec: 5, loop: true });

    // Music: a default length, instrumental, and the longest length offered follows the model
    await page.getByRole("tab", { name: "Music" }).click();
    await page.getByLabel("Describe the music").fill("Warm slow piano");
    await page.getByRole("button", { name: "Instrumental" }).click();
    await expect(page.locator('select[aria-label="Length"] option').last()).toHaveText("4 min");
    await page.getByRole("button", { name: "Make music" }).click();
    await expect.poll(() => sent.length).toBe(3);
    expect(sent[2]).toMatchObject({ kind: "music", model: "music_v2_5", durationSec: 60, instrumental: true });

    // a provider that is not connected is named when you press the button
    all = all.map((m) => (m.kind === "music" ? { ...m, ready: false } : m));
    await page.reload();
    await page.getByRole("tab", { name: "Music" }).click();
    await page.getByLabel("Describe the music").fill("Warm slow piano");
    await page.getByRole("button", { name: "Make music" }).click();
    await expect(page.locator(".vc-error")).toContainText("ElevenLabs models are not available yet");
    expect(sent).toHaveLength(3);
    items = [];
  });

  test("before the provider key is set every control still responds and Generate says why it cannot go ahead", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
      localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    });
    let posted = 0;
    await page.route("**/api/audio/models", (r) => r.fulfill({ json: { models: models.map((m) => ({ ...m, ready: false })) } }));
    await page.route("**/api/audio/voices**", (r) => r.fulfill({ json: { voices: [], ready: false } }));
    await page.route(/\/api\/audio(\?scope=studio)?$/, (r) => r.fulfill({ json: { items: [] } }));
    await page.route("**/api/audio/generate", (r) => { posted++; return r.fulfill({ status: 503, json: { error: "x" } }); });
    await page.goto("/voice");
    await page.fill("#vc-text", "Hello there.");
    await page.getByRole("button", { name: "Delivery" }).click();
    await page.getByRole("menuitem", { name: "[whispers]" }).click();
    await expect(page.getByRole("button", { name: "Faster" })).toBeEnabled();
    await page.getByRole("button", { name: "Faster" }).click();
    await page.selectOption('select[aria-label="Voice model"]', "eleven_flash_v2_5");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.locator(".vc-error")).toContainText("not available yet");
    await page.getByRole("button", { name: "Search all voices" }).click();
    await expect(page.locator(".vc-none")).toContainText("not available yet");
    expect(posted).toBe(0);
  });
});
