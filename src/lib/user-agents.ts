import { checkPrompt } from "@/lib/moderation";

// Agents people make for themselves. Atlas is built in; these sit beside it. Everything a person types is checked here before it is stored.
export const MAX_AGENTS = 5;
export const NAME_MAX = 24;
export const ROLE_MAX = 80;
export const INSTRUCTIONS_MIN = 10;
export const INSTRUCTIONS_MAX = 1500;
const RESERVED = ["atlas"];

export type AgentInput = { name: string; role: string; instructions: string };

export function parseAgentInput(body: unknown): { ok: true; value: AgentInput } | { ok: false; error: string } {
  const b = (body ?? {}) as { name?: unknown; role?: unknown; instructions?: unknown };
  const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim() : "";
  const role = typeof b.role === "string" ? b.role.replace(/\s+/g, " ").trim() : "";
  const instructions = typeof b.instructions === "string" ? b.instructions.trim() : "";
  if (name.length < 2 || name.length > NAME_MAX || !/^[\p{L}\p{N}][\p{L}\p{N} '\-]*$/u.test(name)) return { ok: false, error: `Give the agent a name of 2 to ${NAME_MAX} letters or numbers.` };
  if (RESERVED.includes(name.toLowerCase())) return { ok: false, error: "That name belongs to a built-in agent. Choose another." };
  if (role.length > ROLE_MAX) return { ok: false, error: `Keep the description under ${ROLE_MAX} characters.` };
  if (instructions.length < INSTRUCTIONS_MIN || instructions.length > INSTRUCTIONS_MAX) return { ok: false, error: `Describe how it should behave (${INSTRUCTIONS_MIN} to ${INSTRUCTIONS_MAX} characters).` };
  const check = checkPrompt(`${name}\n${role}\n${instructions}`);
  if (!check.ok) return { ok: false, error: check.reason };
  return { ok: true, value: { name, role, instructions } };
}
