import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { finalizeGeneration } from "@/lib/generation-jobs";

// Keeps an eye on a render that has just been started, on the server, so it is saved to our own storage even if the person closes the app the moment
// they press Generate. Vercel keeps the function alive for this after the response has gone out (`waitUntil`), up to the route's time limit (60 s):
// most renders finish well inside that. A longer one is still found the next time anyone opens the app or the daily job runs.
const POLL_EVERY_MS = 3000;
const WATCH_FOR_MS = 50_000;

async function watch(id: string): Promise<void> {
  const until = Date.now() + WATCH_FOR_MS;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
    try {
      const g = await db.generation.findUnique({ where: { id } });
      if (!g || (g.status !== "pending" && g.status !== "saving")) return; // finished (or failed, or deleted), by us or by someone opening the app
      const after = await finalizeGeneration(g);
      if (after.status !== "pending" && after.status !== "saving") return;
    } catch (err) {
      console.error("render watch failed", id, err);
    }
  }
}

export function watchRender(id: string): void {
  const job = watch(id).catch(() => {});
  try { waitUntil(job); } catch { /* not on Vercel: the promise simply keeps running */ }
}
