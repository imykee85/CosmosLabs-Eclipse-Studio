// What Eclipse remembers. Topics match the five nodes on the Memory map.
export const MEMORY_TOPICS = ["projects", "products", "characters", "style", "tastes"] as const;
export type MemoryTopic = (typeof MEMORY_TOPICS)[number];
export const TOPIC_LABEL: Record<MemoryTopic, string> = { projects: "Projects", products: "Products", characters: "Characters", style: "Style", tastes: "Tastes" };
export const isTopic = (t: unknown): t is MemoryTopic => typeof t === "string" && (MEMORY_TOPICS as readonly string[]).includes(t);
export const MEMORY_TEXT_MAX = 400;
export const MEMORY_LIMIT = 300; // per user
export type MemoryItem = { id: string; topic: MemoryTopic; text: string; source: "user" | "agent"; createdAt: string };
