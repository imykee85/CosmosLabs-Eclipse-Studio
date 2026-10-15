import { hash, lift, restore, skipPath, translatable } from "./text";

// The in-browser translator: walks the page's text (and a few attributes), swaps English for the visitor's language, and keeps doing so as the app changes the page.
// Only the text node's value is changed (no wrapper elements), so React keeps working; when React writes new English text the observer translates it again.
// Not translated: anything inside translate="no" / [data-no-translate] (people's own prompts, chats, names, file names), code, text boxes' contents, SVG, and the legal and admin pages.

const SKIP_SELECTOR = '[translate="no"],[data-no-translate],script,style,noscript,code,pre,textarea,svg,[contenteditable=""],[contenteditable="true"]';
const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const BATCH = 60;
const PARALLEL = 3;
const STORE_MAX = 9000;

type Entry = { src: string; applied: string | null };

export function startTranslator(lang: string, onFirstDone: () => void): () => void {
  const storeKey = `eclipse-i18n-${lang}`;
  const dict = new Map<string, string>();
  try { for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(storeKey) || "{}") as Record<string, string>)) dict.set(k, v); } catch { /* start empty */ }
  const missed = new Map<string, number>(); // key -> when it last failed to translate (retry after a minute)
  let allowed = new Set<string>(); // hashes of the interface strings that may be translated (loaded below); anything else stays exactly as written
  const texts = new WeakMap<Text, Entry>();
  const attrs = new WeakMap<Element, Record<string, Entry>>();
  let stopped = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  const dirty = new Set<Node>();
  let firstDone = false;

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const all = [...dict.entries()];
        const keep = all.length > STORE_MAX ? all.slice(all.length - STORE_MAX) : all;
        localStorage.setItem(storeKey, JSON.stringify(Object.fromEntries(keep)));
      } catch { /* storage full or blocked: the server cache still serves */ }
    }, 800);
  };

  type Job = { key: string; template: string; nums: string[]; apply: (translated: string) => void };
  const pending = new Map<string, { template: string; jobs: Job[]; visible: boolean }>();
  // Text on (or just below) the screen is translated first, so the page can be shown while the rest follows in the background.
  const onScreen = (el: Element | null) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > -150 && r.top < innerHeight + 500; };

  function plan(value: string, apply: (translated: string) => void, near: Element | null): boolean {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(value)!;
    const core = m[2];
    if (!translatable(core)) return false;
    const { template, nums } = lift(core);
    const key = hash(template);
    if (!allowed.has(key)) return false; // not interface text (a person's own words, a name): never leaves the browser
    const wrap = (t: string) => { const r = restore(t, nums); if (r != null) apply(m[1] + r + m[3]); };
    const hit = dict.get(key);
    if (hit != null) { wrap(hit); return true; }
    const failedAt = missed.get(key);
    if (failedAt && Date.now() - failedAt < 60_000) return false;
    if (failedAt === Number.MAX_SAFE_INTEGER) return false;
    const slot = pending.get(key) ?? { template, jobs: [], visible: false };
    if (!slot.visible && onScreen(near)) slot.visible = true;
    slot.jobs.push({ key, template, nums, apply: wrap });
    pending.set(key, slot);
    return true;
  }

  function visitText(node: Text) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_SELECTOR)) return;
    const v = node.nodeValue ?? "";
    const prev = texts.get(node);
    if (prev && v === prev.applied) return; // our own translation
    const entry: Entry = { src: v, applied: null };
    texts.set(node, entry);
    plan(v, (t) => { if (stopped || node.nodeValue !== entry.src) return; node.nodeValue = t; entry.applied = t; }, parent);
  }

  function visitAttrs(el: Element) {
    if (el.closest(SKIP_SELECTOR)) return;
    let rec = attrs.get(el);
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v == null) continue;
      if (rec?.[a] && rec[a].applied === v) continue;
      const entry: Entry = { src: v, applied: null };
      rec = rec ?? {}; rec[a] = entry; attrs.set(el, rec);
      plan(v, (t) => { if (stopped || el.getAttribute(a) !== entry.src) return; el.setAttribute(a, t); entry.applied = t; }, el);
    }
  }

  function scan(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) { visitText(root as Text); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const el = root as Element;
    if (el.closest(SKIP_SELECTOR)) return;
    visitAttrs(el);
    el.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach(visitAttrs);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) visitText(n as Text);
  }

  async function flush(onlyVisible: boolean) {
    const entries = [...pending.entries()].filter(([, slot]) => !onlyVisible || slot.visible);
    if (entries.length === 0) return;
    for (const [k] of entries) pending.delete(k);
    const chunks: typeof entries[] = [];
    for (let i = 0; i < entries.length; i += BATCH) chunks.push(entries.slice(i, i + BATCH));
    let next = 0;
    const worker = async () => {
      while (next < chunks.length && !stopped) {
        const chunk = chunks[next++];
        try {
          const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, texts: chunk.map(([, s]) => s.template) }) });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as { translations?: (string | null | false)[] };
          chunk.forEach(([key, slot], i) => {
            const t = data.translations?.[i];
            if (typeof t === "string" && t) { dict.set(key, t); slot.jobs.forEach((j) => j.apply(t)); }
            else if (t === false) missed.set(key, Number.MAX_SAFE_INTEGER); // not interface text after all: never ask again this visit
            else missed.set(key, Date.now());
          });
          persist();
        } catch {
          chunk.forEach(([key]) => missed.set(key, Date.now()));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, worker));
  }

  async function run(roots: Iterable<Node>) {
    if (stopped || skipPath(location.pathname)) { if (!firstDone) { firstDone = true; onFirstDone(); } return; }
    for (const r of roots) if (r.isConnected) scan(r);
    await flush(true); // what the visitor can see
    if (!firstDone) { firstDone = true; onFirstDone(); }
    await flush(false); // everything else, in the background
  }

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "childList") r.addedNodes.forEach((n) => dirty.add(n));
      else dirty.add(r.target);
    }
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { const roots = [...dirty]; dirty.clear(); void run(roots); }, 100);
  });

  const start = () => {
    if (stopped) return;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    void run([document.body]);
  };
  // The list of translatable strings loads first (a separate chunk, only for visitors who need a translation).
  const begin = () => { if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once: true }); };
  import("./manifest-hashes.json").then((m) => { allowed = new Set(m.default as string[]); begin(); }).catch(() => { if (!firstDone) { firstDone = true; onFirstDone(); } });

  return () => { stopped = true; observer.disconnect(); clearTimeout(scanTimer); clearTimeout(saveTimer); };
}
