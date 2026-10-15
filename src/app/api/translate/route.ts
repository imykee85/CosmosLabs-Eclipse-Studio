import { NextResponse } from "next/server";
import { MAX_BATCH, translateMany } from "@/lib/i18n/translate-server";
import { isLang } from "@/lib/i18n/languages";

export const maxDuration = 60;

// Public (the landing page is translated for signed-out visitors), so it defends itself: a per-address rate limit on this server instance,
// small batches, a language whitelist, a daily cap on new strings (translate-server.ts), and stored translations answer without any model call.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 40) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
  return false;
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  let body: { lang?: unknown; texts?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  if (!isLang(body.lang) || body.lang === "en") return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
  if (!Array.isArray(body.texts) || body.texts.length === 0 || body.texts.length > MAX_BATCH || body.texts.some((t) => typeof t !== "string")) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  try {
    const r = await translateMany(body.lang, body.texts as string[]);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ translations: r.translations });
  } catch (e) {
    console.error("[i18n] /api/translate failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ translations: (body.texts as string[]).map(() => null) });
  }
}
