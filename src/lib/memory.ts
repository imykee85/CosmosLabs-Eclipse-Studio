// What Eclipse remembers. Topics match the five nodes on the Memory map.
export const MEMORY_TOPICS = ["projects", "products", "characters", "style", "tastes"] as const;
export type MemoryTopic = (typeof MEMORY_TOPICS)[number];
export const TOPIC_LABEL: Record<MemoryTopic, string> = { projects: "Projects", products: "Products", characters: "Characters", style: "Style", tastes: "Tastes" };
export const isTopic = (t: unknown): t is MemoryTopic => typeof t === "string" && (MEMORY_TOPICS as readonly string[]).includes(t);
export const MEMORY_TEXT_MAX = 400;
export const MEMORY_LIMIT = 300; // per user
export type MemoryItem = { id: string; topic: MemoryTopic; text: string; source: "user" | "agent"; createdAt: string };

// Pasted notes become memories: one per non-empty line (long lines are cut). A line that starts with a label such as
// "Style: ..." or "Products - ..." goes under that topic; every other line goes under the chosen fallback topic.
const IMPORT_LABELS: Record<string, MemoryTopic> = { project: "projects", projects: "projects", product: "products", products: "products", character: "characters", characters: "characters", style: "style", styles: "style", taste: "tastes", tastes: "tastes" };
export function parseImportLine(raw: string, fallback: MemoryTopic): { topic: MemoryTopic; text: string } | null {
  const l = raw.replace(/^[-*•\d.)\s]+/, "").replace(/^\*\*|\*\*(?=\s*:)/g, "").trim();
  const m = l.match(/^([A-Za-z]+)(?:\s*:|\s+[-–])\s*(.+)$/);
  const labelled = m && IMPORT_LABELS[m[1].toLowerCase()];
  const text = (labelled ? m![2] : l).replace(/\*\*/g, "").trim().slice(0, MEMORY_TEXT_MAX);
  return text ? { topic: labelled || fallback, text } : null;
}

// Text from an uploaded file, ready for the import route: JSON arrays of strings (or of objects with a text, memory or content
// field) become one line each; anything else is used as it is, one fact per line.
export const MEMORY_FILE_MAX_BYTES = 200 * 1024;
export function memoryFileToText(name: string, raw: string): string {
  if (/\.json$/i.test(name)) {
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : Array.isArray(data?.memories) ? data.memories : null;
      if (list) {
        const lines = list.map((x: unknown) => (typeof x === "string" ? x : x && typeof x === "object" ? String((x as Record<string, unknown>).text ?? (x as Record<string, unknown>).memory ?? (x as Record<string, unknown>).content ?? "") : "")).map((l: string) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
        if (lines.length) return lines.join("\n");
      }
    } catch {}
  }
  return raw;
}
