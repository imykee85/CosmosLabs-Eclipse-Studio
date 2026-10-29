// The browser side of chat saving, run in Node with a small fake of browser storage and a fake copy of the account API.
import test from "node:test";
import assert from "node:assert/strict";

// A fake browser: one storage per "device", but the Storage class and window are shared (the code patches Storage.prototype).
class FakeStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}
const g = globalThis as unknown as Record<string, unknown>;
const win = new EventTarget() as EventTarget & Record<string, unknown>;
g.window = win; g.Storage = FakeStorage;
const server = new Map<string, { value: string; at: number }>();
g.fetch = async (url: string, init?: { method?: string; body?: string }) => {
  const u = new URL(url, "http://x");
  const ok = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
  if (init?.method === "PUT") {
    const b = JSON.parse(init.body!);
    const ex = server.get(b.key);
    if (!ex || ex.at <= b.clientAt) server.set(b.key, { value: b.value, at: b.clientAt });
    return ok({ ok: true });
  }
  const key = u.searchParams.get("key");
  if (key === null) return ok({ items: [...server].map(([k, v]) => ({ key: k, at: v.at })) });
  const hit = server.get(key);
  return hit ? ok(hit) : ok({ error: "x" }, 404);
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("a chat written on one device reaches the account and then another device", async () => {
  const sync = await import("../../src/lib/chat-sync");
  const device1 = new FakeStorage();
  g.localStorage = device1;
  sync.installSync();
  device1.setItem("eclipse-agent-chat-atlas", '[{"id":"a","role":"user","text":"hello"}]');
  device1.setItem("eclipse-theme", "light");
  assert.ok(device1.getItem(sync.SYNC_AT + "eclipse-agent-chat-atlas"), "the write was stamped");
  assert.equal(device1.getItem(sync.SYNC_AT + "eclipse-theme"), null, "other keys are not tracked");
  await wait(1800);
  assert.equal(server.get("eclipse-agent-chat-atlas")?.value.includes("hello"), true, "sent to the account after a moment");
  assert.equal(server.has("eclipse-theme"), false);

  // Logging out clears the browser; the account keeps the chat.
  const { clearAccountData } = await import("../../src/lib/clear-account-data");
  clearAccountData();
  assert.equal(device1.getItem("eclipse-agent-chat-atlas"), null);
  assert.equal(server.has("eclipse-agent-chat-atlas"), true, "still on the account after sign-out");

  // Logging in again (a fresh browser): the chat comes back and the screens are told.
  const device2 = new FakeStorage();
  g.localStorage = device2;
  sync.installSync();
  let told: string[] = [];
  win.addEventListener(sync.PULLED_EVENT, (e) => { told = (e as CustomEvent<string[]>).detail; });
  await sync.pullSync();
  assert.ok(device2.getItem("eclipse-agent-chat-atlas")?.includes("hello"));
  assert.deepEqual(told, ["eclipse-agent-chat-atlas"]);
  assert.equal(device2.getItem(sync.SYNC_AT + "eclipse-agent-chat-atlas"), String(server.get("eclipse-agent-chat-atlas")!.at));
  sync.stopSync();
});

test("a browser's older chats are sent up when the account has none, and a newer local copy wins", async () => {
  const sync = await import("../../src/lib/chat-sync");
  server.clear();
  const dev = new FakeStorage();
  g.localStorage = dev;
  sync.installSync();
  dev.m.set("eclipse-prompts-ai-master", '[{"id":"1","role":"user","text":"old chat"}]'); // from before saving existed: no stamp
  await sync.pullSync();
  await wait(1200);
  assert.equal(server.get("eclipse-prompts-ai-master")?.value.includes("old chat"), true);
  // The account has a copy from 10 seconds ago; this device edits it now: the newer one is kept on the account.
  server.set("eclipse-treatment-p1", { value: "{}", at: Date.now() - 10_000 });
  dev.setItem("eclipse-treatment-p1", '{"plan":"newer"}');
  await sync.pullSync();
  await wait(1800);
  assert.equal(server.get("eclipse-treatment-p1")?.value, '{"plan":"newer"}');
  sync.stopSync();
});

test("after sign-out nothing is sent", async () => {
  const sync = await import("../../src/lib/chat-sync");
  server.clear();
  const dev = new FakeStorage();
  g.localStorage = dev;
  sync.installSync();
  dev.setItem("eclipse-agent-chat-atlas", "[1]");
  sync.stopSync();
  await wait(1800);
  assert.equal(server.size, 0);
});
