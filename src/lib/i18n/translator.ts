import { hash, lift, restore, skipPath, translatable } from "./text";

// The in-browser translator. The whole interface of one language is ONE dictionary (downloaded once, kept in memory and in this browser's storage), so translating is a look-up: nothing is requested while someone
// uses the app and nothing is ever seen changing. It walks the page's text (and a few attributes), swaps English for the translation, and keeps doing so as the app changes the page: the MutationObserver
// callback runs before the browser paints, so new screens arrive already translated. Only the text node's value is changed (no wrapper elements), so React keeps working.
// Not translated: anything inside translate="no" / [data-no-translate] (people's own prompts, chats, names), code, text boxes' contents, SVG, and the legal and admin pages.
// Text that is not in the dictionary (a person's own words, a name) stays exactly as it is: the dictionary only holds wording written in the code.

export type Dict = Record<string, string>;

const SKIP_SELECTOR = '[translate="no"],[data-no-translate],script,style,noscript,code,pre,textarea,svg,[contenteditable=""],[contenteditable="true"]';
const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;

type Entry = { src: string; applied: string | null };

export function startTranslator(dict: Dict): () => void {
  const texts = new WeakMap<Text, Entry>();
  const attrs = new WeakMap<Element, Record<string, Entry>>();
  let stopped = false;

  /** The translation of `value` (keeping its surrounding spaces), or null when it is not interface wording. */
  function lookup(value: string): string | null {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(value)!;
    const core = m[2];
    if (!translatable(core)) return null;
    const { template, nums } = lift(core);
    const t = dict[hash(template)];
    if (t == null) return null;
    const r = restore(t, nums);
    return r == null ? null : m[1] + r + m[3];
  }

  function visitText(node: Text) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_SELECTOR)) return;
    const v = node.nodeValue ?? "";
    const prev = texts.get(node);
    if (prev && v === prev.applied) return; // our own translation
    const t = lookup(v);
    texts.set(node, { src: v, applied: t });
    if (t != null && t !== v) node.nodeValue = t;
  }

  function visitAttrs(el: Element) {
    if (el.closest(SKIP_SELECTOR)) return;
    let rec = attrs.get(el);
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v == null) continue;
      if (rec?.[a] && rec[a].applied === v) continue;
      const t = lookup(v);
      rec = rec ?? {}; rec[a] = { src: v, applied: t };
      attrs.set(el, rec);
      if (t != null && t !== v) el.setAttribute(a, t);
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

  const observer = new MutationObserver((records) => {
    if (stopped || skipPath(location.pathname)) return;
    const seen = new Set<Node>();
    for (const r of records) {
      if (r.type === "childList") r.addedNodes.forEach((n) => seen.add(n));
      else seen.add(r.target);
    }
    for (const n of seen) if (n.isConnected) scan(n);
  });

  const start = () => {
    if (stopped) return;
    if (!skipPath(location.pathname)) scan(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once: true });

  return () => { stopped = true; observer.disconnect(); };
}

// ---- Getting the dictionary: from this browser's copy at once, refreshed from the server (which is cached at the edge) for next time.
const KEY = (lang: string) => `eclipse-i18n-dict-${lang}`;

export function readStoredDict(lang: string): Dict | null {
  try { const v = JSON.parse(localStorage.getItem(KEY(lang)) || "null") as { d?: Dict } | null; return v?.d && Object.keys(v.d).length ? v.d : null; } catch { return null; }
}

export async function fetchDict(lang: string): Promise<Dict | null> {
  try {
    const res = await fetch(`/api/i18n/${lang}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { d?: Dict };
    if (!j.d || !Object.keys(j.d).length) return null;
    try { localStorage.setItem(KEY(lang), JSON.stringify({ d: j.d, at: Date.now() })); } catch { /* full or blocked: the server copy is quick anyway */ }
    return j.d;
  } catch { return null; }
}
