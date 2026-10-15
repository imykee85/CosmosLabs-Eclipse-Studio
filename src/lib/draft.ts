// What a person has lined up in a prompt box (text, settings, attached pictures and clips) is kept in this browser as they go, so an accidental refresh
// or a tap on the wrong link does not lose it. One draft per screen; it follows whatever is in the box, so sending the prompt (which clears the box)
// clears the draft too. Pictures are stored as ids only: their addresses are rebuilt on the way back in. Cleared at sign-out with the rest.
const KEY = (screen: string) => `eclipse-draft-${screen}`;

export function readDraft<T>(screen: string): Partial<T> | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(screen)) ?? "null");
    return raw && typeof raw === "object" ? (raw as Partial<T>) : null;
  } catch { return null; }
}

export function writeDraft(screen: string, value: unknown) {
  try { localStorage.setItem(KEY(screen), JSON.stringify(value)); } catch { /* storage blocked or full: the draft just is not kept */ }
}

export type StoredPick = { type: "upload" | "render"; id: string; label: string; sec?: number | null };

// Keeps only well-formed picks, so a damaged or old draft cannot break the screen.
export function cleanPicks(input: unknown, max: number): StoredPick[] {
  if (!Array.isArray(input)) return [];
  const out: StoredPick[] = [];
  for (const p of input as Partial<StoredPick>[]) {
    if ((p?.type !== "upload" && p?.type !== "render") || typeof p.id !== "string" || !p.id || p.id.length > 64) continue;
    out.push({ type: p.type, id: p.id, label: typeof p.label === "string" ? p.label.slice(0, 120) : "", ...(typeof p.sec === "number" ? { sec: p.sec } : {}) });
    if (out.length >= max) break;
  }
  return out;
}

// A picture's stable address inside the app (the signed links in a stored pick would have expired).
export const pickUrl = (p: { type: "upload" | "render"; id: string }) => (p.type === "upload" ? `/api/uploads/${p.id}/file` : `/api/generations/${p.id}/file`);
