import { expect, test } from "@playwright/test";

// Atlas in Audio Studio (preview mode, every API mocked): the switch, a script he writes going into the box, and his Generate starting the take.
const OPT = { diarize: false, loop: false, instrumental: false, minSeconds: null, maxSeconds: null, maxInputBytes: null, maxInputSeconds: null, long: false };
const models = [{ id: "eleven_v4", kind: "tts", kinds: ["tts"], options: OPT, label: "Eleven v4", provider: "elevenlabs", providerLabel: "ElevenLabs", tags: ["[whispers]"], voiceOptional: false, ready: true, maxChars: 10000, note: null, pricing: { unit: "char", perUnit: 0.0125 }, supports: { emotionTags: true, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false } }];

test("Atlas can be switched on in Audio Studio, sees the script box, fills it and starts the take", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    localStorage.setItem("eclipse-agent", "Atlas");
  });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], entries: [], balance: 100 } }));
  await page.route("**/api/audio/models", (r) => r.fulfill({ json: { models } }));
  await page.route("**/api/audio/voices**", (r) => r.fulfill({ json: { voices: [{ voiceId: "voiceA", name: "Ana" }], ready: true } }));
  let sent: { context?: { page?: string; settings?: string[] } } | null = null;
  await page.route("**/api/agent/chat", (r) => { sent = r.request().postDataJSON(); return r.fulfill({ json: { runId: "r1" } }); });
  const script = "Welcome to the city that never sleeps. [whispers] Neither do we.";
  await page.route("**/api/agent/runs/r1", (r) => r.fulfill({ json: { status: "done", result: { status: 200, body: { text: "Here is a script.", actions: [{ kind: "generate", label: "Generate", prompt: script }] } } } }));
  const takes: Record<string, unknown>[] = [];
  await page.route("**/api/audio/generate", (r) => { takes.push(r.request().postDataJSON()); return r.fulfill({ json: { id: "j1", status: "pending", text: script } }); });

  await page.goto("/voice");
  await page.getByRole("option", { name: "Ana" }).click();
  const sw = page.getByRole("switch", { name: "Let the agent help in Audio Studio" });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await page.click(".aw-btn");
  await page.fill(".aw-input textarea", "write me a city promo voiceover");
  await page.click('.aw-input button[type="submit"]');
  await expect.poll(() => sent?.context?.page).toBe("voice");
  expect(sent!.context!.settings!.join(" ")).toMatch(/Mode: Speak/);
  expect(sent!.context!.settings!.join(" ")).toMatch(/Voice: Ana/);
  // A reply with a prompt becomes a proposal card; Apply and generate fills the box and starts the take.
  await page.getByRole("button", { name: /Apply and generate/ }).click();
  await expect.poll(() => takes.length).toBe(1);
  expect(takes[0]).toMatchObject({ model: "eleven_v4", voiceId: "voiceA", text: script });
});
