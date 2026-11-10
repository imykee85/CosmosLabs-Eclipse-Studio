// Captures the real Eclipse app screens for the launch video (brief Part 4B).
// The app runs locally in preview mode (no sign-in) and every API call is answered with demo data, so nothing real is shown.
// Usage: node capture.mjs <screen|all> <desktop|phone>   (server must run on :3100)
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire("/home/user/CosmosLabs-Eclipse-Studio/package.json");
const { chromium } = require("playwright-core");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "captures");
const BASE = "http://localhost:3100";
const which = process.argv[2] || "all", layout = process.argv[3] || "desktop";
const PHONE = layout === "phone";
const img = (name) => fs.readFileSync(path.join(HERE, "../../public", name));

const OPT = { diarize: false, loop: false, instrumental: false, minSeconds: null, maxSeconds: null, maxInputBytes: null, maxInputSeconds: null, long: false };
const voiceModels = [
  { id: "eleven_v4", kind: "tts", options: OPT, label: "Eleven v4", provider: "elevenlabs", providerLabel: "ElevenLabs", tags: ["[whispers]", "[laughs]"], voiceOptional: false, ready: true, maxChars: 10000, note: null, pricing: { unit: "char", perUnit: 0.0125 }, supports: { emotionTags: true, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false } },
];
const memories = [
  ["projects", "Skincare launch teaser: 15 s vertical, hero shot of the serum on wet stone"],
  ["style", "Warm cinematic light, soft shadows, 35 mm film grain"],
  ["products", "Glow Berry mist: pink glass bottle, gold cap, label always readable"],
  ["characters", "Maya: early 30s, curly hair, cream linen shirt, calm confident look"],
  ["tastes", "No busy backgrounds. Prefers close product shots and slow camera moves"],
  ["style", "Brand colours: deep red, warm off-white, black"],
  ["projects", "Autumn lookbook: six looks, city at golden hour"],
  ["products", "Serum No. 3: amber dropper bottle, matte black box"],
].map(([topic, text], i) => ({ id: `m${i}`, topic, text, source: i % 3 ? "user" : "agent", createdAt: new Date(Date.now() - i * 3600e3).toISOString() }));

async function page_(browser) {
  const ctx = await browser.newContext(PHONE
    ? { viewport: { width: 520, height: 1125 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, colorScheme: "dark" }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Skincare launch" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Skincare launch", updatedAt: new Date().toISOString(), deletedAt: null }]));
    localStorage.setItem("eclipse-first-tour", "1"); localStorage.setItem("eclipse-welcome-offer", "1");
    localStorage.setItem("eclipse-agent", "Atlas");
    localStorage.setItem("eclipse-theme", "dark");
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0, models: [] } }));
  await page.route("**/api/access", (r) => r.fulfill({ json: { plan: "scale", features: ["studios", "atlas", "canvas", "core", "shotmap", "agents", "plans", "api", "teams"], admin: false, gating: true } }));
  return page;
}
const shot = async (page, name, opts = {}) => { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `${name}-${layout}.png`), ...opts }); console.log("saved", name); };
// Hide what must not be in the film: Soon tags, credit pills (a balance), the test-mode avatar initials stay generic.
const tidy = (page) => page.addStyleTag({ content: `.soon-tag,.credit-pill,.ws-team{visibility:hidden!important} nextjs-portal{display:none!important}` });

const screens = {
  async memory(page) {
    await page.route("**/api/memory", (r) => r.fulfill({ json: { items: memories } }));
    await page.goto(BASE + "/memory"); await page.waitForTimeout(1500); await tidy(page);
    await shot(page, "memory");
  },
  async atlas(page) {
    await page.addInitScript(() => localStorage.setItem("eclipse-agent-on:create", "1"));
    let asked = 0;
    await page.route("**/api/agent/chat", (r) => r.fulfill({ json: { runId: "r1" } }));
    await page.route("**/api/agent/runs/r1", (r) => r.request().method() === "DELETE" ? r.fulfill({ json: { ok: true } })
      : (++asked < 4 ? r.fulfill({ json: { status: "running" } }) : r.fulfill({ json: { status: "done", result: { status: 200, body: { text: "Here is a stronger direction for the teaser.", actions: [{ kind: "use_prompt", label: "Use this prompt", prompt: "A product launch teaser for a skincare brand: the amber serum bottle on wet black stone, one slow push in, warm window light, water beads catching the light" }], controls: { ratio: "9:16" } } } } })));
    await page.goto(BASE + "/create"); await page.waitForTimeout(1200); await tidy(page);
    await page.fill("form.cr-box textarea", "Make a product launch teaser for a skincare brand");
    await page.click(".aw-btn"); await page.waitForSelector(".aw-panel");
    await shot(page, "atlas-1-open");
    await page.fill(".aw-panel textarea", "Make a product launch teaser for a skincare brand");
    await page.keyboard.press("Control+Enter"); await page.waitForTimeout(700);
    await shot(page, "atlas-2-working");
    await page.waitForSelector(".aw-prop", { timeout: 30000 }); await page.waitForTimeout(500);
    await shot(page, "atlas-3-answer");
  },
  async canvas(page) {
    await page.goto(BASE + "/canvas"); await page.getByRole("button", { name: /New canvas/ }).first().click(); await page.waitForSelector(".cv-wrap"); await tidy(page);
    await page.getByRole("button", { name: /Templates/ }).click(); await page.waitForTimeout(400);
    await shot(page, "canvas-0-templates");
    await page.getByText("Starter flow").click(); await page.waitForTimeout(600);
    await page.getByRole("button", { name: /Templates/ }).click().catch(() => {});
    await page.addStyleTag({ content: ".cv-wrap .react-flow__panel.top,.react-flow__minimap,.react-flow__controls{visibility:hidden!important}" });
    await page.locator(".react-flow__controls-fitview").click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "canvas-1-flow");
  },
  async audio(page) {
    await page.route("**/api/audio/models", (r) => r.fulfill({ json: { models: voiceModels } }));
    await page.route("**/api/audio/voices**", (r) => r.fulfill({ json: { voices: [{ voiceId: "v1", name: "Ana", accent: "british", gender: "female" }, { voiceId: "v2", name: "Marcus", accent: "american", gender: "male" }, { voiceId: "v3", name: "Leila", accent: "french", gender: "female" }, { voiceId: "v4", name: "Kofi", accent: "ghanaian", gender: "male" }], ready: true } }));
    await page.goto(BASE + "/voice"); await page.waitForTimeout(1800); await tidy(page);
    await shot(page, "audio-0");
    await page.getByText("Ana", { exact: true }).click().catch(() => {});
    await page.locator("textarea").first().fill("Your skin, at its calmest. [whispers] Meet the new Glow Berry mist.");
    await page.waitForTimeout(800);
    await shot(page, "audio-1");
  },
  async shotmap(page) {
    const clip = { id: "v1", prompt: "a clip", model: "seedance_2_5", modelLabel: "Seedance 2.5", status: "completed", error: null, credits: 1, createdAt: new Date().toISOString(), deletedAt: null, references: null, seed: null, seedLocked: false, projectId: "p1", fileName: "a.mp4", contentType: "video/mp4", sizeBytes: 10, width: 320, height: 180, resolution: "720p", startedAt: null, imageUrl: "/api/generations/v1/file", kind: "video", durationSec: 3, aspectRatio: "16:9" };
    await page.route("**/api/generations?**", (r) => r.fulfill({ json: { items: [clip] } }));
    await page.goto(BASE + "/generate"); await page.waitForTimeout(1200); await tidy(page);
    await page.getByRole("button", { name: "a clip" }).first().click();
    await page.getByRole("toolbar", { name: "Video tools" }).getByRole("button", { name: /ShotMap/ }).click();
    const panel = page.getByRole("dialog", { name: "ShotMap" }); await panel.waitFor(); await page.waitForTimeout(2500);
    await shot(page, "shotmap-shot");
    await panel.getByRole("button", { name: "Stage", exact: true }).click(); await page.waitForTimeout(2500);
    await shot(page, "shotmap-stage");
  },
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server", "--no-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
for (const name of which === "all" ? Object.keys(screens) : [which]) {
  const page = await page_(browser);
  try { await screens[name](page); } catch (e) { console.log("FAILED", name, String(e).slice(0, 300)); await shot(page, name + "-FAILED").catch(() => {}); }
  await page.context().close();
}
await browser.close();
