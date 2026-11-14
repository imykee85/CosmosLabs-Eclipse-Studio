import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { drive, enqueue } from "@/lib/sandbox/runner";
import { scoutEnabled, scoutInputFor } from "@/lib/sandbox/kinds/scout";
import { JobInputError } from "@/lib/sandbox/kinds/types";
import { jobView } from "@/lib/sandbox/view";

// Atlas runs the location-scout helper in a cloud computer (see sandbox/kinds/scout.ts): scout_photos looks up real photo candidates on Wikimedia Commons,
// scout_pack downloads chosen ones into a zip with a contact sheet and a credits file, check_scout reports a job. Growth and up (same as web search).
export const SCOUT_TOOLS: Anthropic.Tool[] = [
  { name: "scout_photos", description: "Run the location-scout helper: search Wikimedia Commons for real photographs of a place (up to 6 search phrases, such as the place name, a landmark or a street). Returns candidates with exact file titles, creator, licence and link. Use it for location work after you have a shortlist of places; say what you searched. Takes about 20 to 60 seconds.", input_schema: { type: "object", properties: { queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 }, limit: { type: "integer", minimum: 3, maximum: 20, description: "Results per phrase, default 10." } }, required: ["queries"] } },
  { name: "scout_pack", description: "Download up to 12 chosen Commons photos (exact titles from scout_photos, like File:Name.jpg), check their licences and build a zip with the originals, a contact sheet and a credits file. The contact sheet is saved to the person's Assets. NOTHING in the pack has been looked at by a person or by you: say they are unchecked candidates. Takes 1 to 3 minutes: tell the user, then use check_scout.", input_schema: { type: "object", properties: { name: { type: "string", description: "A short name for the pack." }, titles: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 }, exclude_sharealike: { type: "boolean", description: "Leave out CC BY-SA photos." } }, required: ["name", "titles"] } },
  { name: "check_scout", description: "Look up a scout_photos or scout_pack job: status and, when done, the candidates or the zip link and contact sheet.", input_schema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] } },
];
export const SCOUT_NAMES = new Set(SCOUT_TOOLS.map((t) => t.name));
export const isScoutTool = (n: string) => SCOUT_NAMES.has(n);

const str = (v: unknown, n = 200) => (typeof v === "string" ? v.slice(0, n) : "");
type Run = { content: string; isError?: boolean };

async function report(job: Parameters<typeof jobView>[0]): Promise<string> {
  const v = await jobView(job);
  return JSON.stringify({ job_id: v.id, status: v.status, message: v.message, ...(v.status === "succeeded" ? { result: v.output } : {}), ...(v.error ? { problem: v.error.message } : {}) });
}

export async function runScoutTool(userId: string, name: string, a: Record<string, unknown>): Promise<Run> {
  if (name === "check_scout") {
    const job = await db.sandboxJob.findFirst({ where: { id: str(a.job_id, 60), userId, kind: "media.scout" } });
    return job ? { content: await report(job) } : { content: "No scout job with that id.", isError: true };
  }
  if (!scoutEnabled()) return { content: "Photo scouting is not available yet.", isError: true };
  const id = `sbx${randomUUID().replace(/-/g, "").slice(0, 21)}`;
  const body = name === "scout_photos"
    ? { mode: "search", queries: Array.isArray(a.queries) ? a.queries.map((q) => str(q, 100)).filter(Boolean).slice(0, 6) : [], ...(typeof a.limit === "number" ? { limit: Math.round(a.limit) } : {}) }
    : { mode: "pack", name: str(a.name, 70), titles: Array.isArray(a.titles) ? a.titles.map((t) => str(t, 220)).slice(0, 12) : [], ...(a.exclude_sharealike === true ? { noShareAlike: true } : {}) };
  let input;
  try { input = scoutInputFor(userId, id, body); } catch (e) { if (e instanceof JobInputError) return { content: e.message, isError: true }; throw e; }
  const q = await enqueue("media.scout", userId, input, { id });
  if (!q.ok) return { content: q.error, isError: true };
  const job = await drive(q.job.id, name === "scout_photos" ? 40_000 : 20_000).catch(() => null);
  return { content: await report(job ?? q.job) };
}
