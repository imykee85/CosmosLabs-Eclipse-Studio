import { test, expect } from "@playwright/test";

// Owner report: opening an earlier Atlas chat made the history show the current chat in place of the others. This seeds three chats and checks each stays itself.
test("opening an earlier Atlas chat keeps every chat separate", async ({ page }) => {
  const msg = (id: string, role: "user" | "agent", text: string) => ({ id, role, text });
  const pastA = { id: "pa", at: Date.now() - 3000, title: "A question", messages: [msg("a1", "user", "A question"), msg("a2", "agent", "A answer")] };
  const pastB = { id: "pb", at: Date.now() - 2000, title: "B question", messages: [msg("b1", "user", "B question"), msg("b2", "agent", "B answer")] };
  await page.addInitScript((seed) => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    localStorage.setItem("eclipse-agent", "Atlas");
    localStorage.setItem("eclipse-agent-on", "1");
    localStorage.setItem("eclipse-agent-history-Atlas", JSON.stringify([seed.pastA, seed.pastB]));
    localStorage.setItem("eclipse-agent-chat-Atlas", JSON.stringify([{ id: "c1", role: "user", text: "Current question" }, { id: "c2", role: "agent", text: "Current answer" }]));
  }, { pastA, pastB });
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0 } }));
  await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [] } }));
  await page.goto("/create");
  await page.locator(".aw-btn").click();
  await expect(page.locator(".aw-panel")).toBeVisible();
  await page.click("button[aria-label='Chat history']");
  await expect(page.locator(".aw-past-row")).toHaveCount(2);
  await page.click(".aw-past-row button >> text=A question");
  // The open chat is A, not the current one.
  await expect(page.locator(".aw-panel")).toContainText("A answer");
  await expect(page.locator(".aw-panel")).not.toContainText("Current answer");
  // History now holds B and the current chat (filed in place of A).
  await page.click("button[aria-label='Chat history']");
  const titles = await page.locator(".aw-past-row b").allInnerTexts();
  expect(titles.sort()).toEqual(["B question", "Current question"].sort());
  await page.locator(".aw-past-row button", { hasText: "B question" }).click();
  await expect(page.locator(".aw-panel")).toContainText("B answer");
  await page.click("button[aria-label='Chat history']");
  const titles2 = await page.locator(".aw-past-row b").allInnerTexts();
  expect(titles2.sort()).toEqual(["A question", "Current question"].sort());
});

// A reply that the server ends with its time-limit message must show that message and free the chat for the next one.
test("a reply that runs out of time shows its message and the chat takes the next message", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    localStorage.setItem("eclipse-agent", "Atlas");
    localStorage.setItem("eclipse-agent-on", "1");
  });
  let asked = 0;
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0 } }));
  await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [] } }));
  await page.route("**/api/agent/chat", (r) => { asked++; return r.fulfill({ status: 202, json: { runId: `r${asked}` } }); });
  await page.route("**/api/agent/runs/r*", (r) => r.request().method() === "DELETE"
    ? r.fulfill({ json: { ok: true } })
    : r.fulfill({ json: { status: "done", result: { status: 502, body: { error: "The agent took too long to answer. Try again with a shorter video or fewer pictures." } } } }));
  await page.goto("/create");
  await page.locator(".aw-btn").click();
  await expect(page.locator(".aw-panel")).toBeVisible();
  await page.locator(".aw-panel textarea").fill("Watch my video and give feedback");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator(".aw-panel")).toContainText("took too long to answer");
  await expect(page.locator(".aw-panel")).not.toContainText("Moving things around");
  await page.locator(".aw-panel textarea").fill("Are you there?");
  await page.keyboard.press("Control+Enter");
  await expect.poll(() => asked).toBe(2);
});

// Owner report: after Stop, the next chat got stuck. A stopped reply must not block the chat that follows.
test("after Stop, the next message gets its reply", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eclipse-project", JSON.stringify({ id: "p1", name: "Demo" }));
    localStorage.setItem("eclipse-projects", JSON.stringify([{ id: "p1", name: "Demo", updatedAt: new Date().toISOString(), deletedAt: null }]));
    localStorage.setItem("eclipse-agent", "Atlas");
    localStorage.setItem("eclipse-agent-on", "1");
  });
  let asked = 0;
  const stopped: string[] = [];
  await page.route("**/api/**", (r) => r.fulfill({ json: { items: [], renders: [], entries: [], balance: 0 } }));
  await page.route("**/api/models**", (r) => r.fulfill({ json: { models: [] } }));
  await page.route("**/api/agent/chat", (r) => { asked++; return r.fulfill({ status: 202, json: { runId: `s${asked}` } }); });
  await page.route("**/api/agent/runs/s*", (r) => {
    const id = r.request().url().split("/").pop() ?? "";
    if (r.request().method() === "POST") { stopped.push(id); return r.fulfill({ json: { ok: true } }); }
    if (r.request().method() === "DELETE") return r.fulfill({ json: { ok: true } });
    // The first reply never arrives until it is stopped; the second one is answered.
    if (id === "s1") return r.fulfill({ json: stopped.includes("s1") ? { status: "canceled" } : { status: "pending" } });
    return r.fulfill({ json: { status: "done", result: { status: 200, body: { text: "Second reply arrived." } } } });
  });
  await page.goto("/create");
  await page.locator(".aw-btn").click();
  await page.locator(".aw-panel textarea").fill("First question");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator(".aw-panel .aw-stop, .aw-panel button[aria-label='Stop']")).toBeVisible();
  await page.locator(".aw-panel button[aria-label='Stop']").click();
  await expect(page.locator(".aw-panel")).toContainText("Stopped.");
  // Stop frees the chat at once: the next message goes through straight away.
  await page.locator(".aw-panel textarea").fill("Second question");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator(".aw-panel")).toContainText("Second reply arrived.", { timeout: 15000 });
  expect(asked).toBe(2);
});
