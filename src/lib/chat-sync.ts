// Keeps the chats in this browser in step with the person's account (see `chat-state.ts`). The chat code is unchanged: it still reads and writes browser
// storage. Here every write to a chat key is noticed (a patched `localStorage.setItem`), stamped with the time and sent to the account a moment later;
// when the app opens, keys that are newer on the account are fetched into the browser. After a pull, `eclipse-sync-pulled` tells the screens to re-read.
export const SYNC_PREFIXES = ["eclipse-agent-chat-", "eclipse-agent-history-", "eclipse-prompts-", "eclipse-treatment-"];
export const SYNC_AT = "eclipse-sync-at:";
export const PULLED_EVENT = "eclipse-sync-pulled";
const DELAY_MS = 1500;
const MAX_CHARS = 1_500_000;

export const isSyncKey = (k: string) => k.length <= 120 && SYNC_PREFIXES.some((p) => k.startsWith(p));

type Win = Window & { __eclipseSync?: { original: (k: string, v: string) => void; pulling: boolean; off: boolean } };
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const tooBig = new Set<string>();

function state() { return (window as Win).__eclipseSync; }

export function installSync(): void {
  const w = window as Win;
  if (w.__eclipseSync) { w.__eclipseSync.off = false; return; }
  const original = Storage.prototype.setItem;
  w.__eclipseSync = { original: (k, v) => original.call(localStorage, k, v), pulling: false, off: false };
  Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
    original.call(this, key, value);
    const s = state();
    if (this === localStorage && s && !s.off && !s.pulling && isSyncKey(key)) {
      try { original.call(localStorage, SYNC_AT + key, String(Date.now())); } catch {}
      schedule(key);
    }
  };
}

/** Stops sending (sign-out): pending sends are dropped so a chat never goes to the next person's account. */
export function stopSync(): void {
  const s = state();
  if (s) s.off = true;
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
}

function schedule(key: string, delay = DELAY_MS) {
  const old = timers.get(key);
  if (old) clearTimeout(old);
  timers.set(key, setTimeout(() => { timers.delete(key); void push(key); }, delay));
}

async function push(key: string, keepalive = false, tries = 0): Promise<void> {
  const s = state();
  if (!s || s.off || tooBig.has(key)) return;
  let value: string | null = null, at = 0;
  try { value = localStorage.getItem(key); at = Number(localStorage.getItem(SYNC_AT + key) ?? 0) || Date.now(); } catch { return; }
  if (value === null) return;
  if (value.length > MAX_CHARS) { tooBig.add(key); return; }
  try {
    const r = await fetch("/api/chat-state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value, clientAt: at }), keepalive: keepalive && value.length < 60_000 });
    if (r.status === 413) tooBig.add(key);
    else if (!r.ok && r.status >= 500 && tries < 3) setTimeout(() => void push(key, false, tries + 1), 15_000 * (tries + 1));
  } catch { if (tries < 3) setTimeout(() => void push(key, false, tries + 1), 15_000 * (tries + 1)); }
}

/** Sends whatever is waiting right now (the page is being hidden or closed). */
export function flushSync(): void {
  const keys = [...timers.keys()];
  keys.forEach((k) => { const t = timers.get(k); if (t) clearTimeout(t); timers.delete(k); void push(k, true); });
}

/** Brings the account and this browser level: newer on the account is fetched, newer (or missing) on the account is sent. */
export async function pullSync(): Promise<void> {
  const s = state();
  if (!s || s.off) return;
  let items: { key: string; at: number }[];
  try {
    const r = await fetch("/api/chat-state");
    if (!r.ok) return;
    items = ((await r.json()) as { items?: { key: string; at: number }[] }).items ?? [];
  } catch { return; }
  const onServer = new Map(items.map((i) => [i.key, i.at]));
  const changed: string[] = [];
  for (const [key, at] of onServer) {
    if (!isSyncKey(key)) continue;
    let localAt = 0;
    try { localAt = Number(localStorage.getItem(SYNC_AT + key) ?? 0) || 0; } catch {}
    if (at > localAt) {
      try {
        const r = await fetch(`/api/chat-state?key=${encodeURIComponent(key)}`);
        if (!r.ok) continue;
        const d = (await r.json()) as { value?: string; at?: number };
        if (typeof d.value !== "string") continue;
        s.pulling = true;
        try { s.original(key, d.value); s.original(SYNC_AT + key, String(d.at ?? at)); } finally { s.pulling = false; }
        changed.push(key);
      } catch {}
    } else if (localAt > at) schedule(key, 200);
  }
  // Keys this browser has that the account has never seen (chats from before this existed, or made while offline) are sent up.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isSyncKey(k) && !onServer.has(k)) {
        if (!localStorage.getItem(SYNC_AT + k)) s.original(SYNC_AT + k, String(Date.now()));
        schedule(k, 400 + i * 50);
      }
    }
  } catch {}
  if (changed.length) window.dispatchEvent(new CustomEvent(PULLED_EVENT, { detail: changed }));
}
