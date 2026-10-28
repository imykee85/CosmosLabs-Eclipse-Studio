import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { dictionaryFor, warmLanguage } from "@/lib/i18n/translate-server";
import { isLang } from "@/lib/i18n/languages";

export const maxDuration = 60;

// The whole interface in one language, as one small file: { "<hash of the English text>": "<translation>" }. Public (the landing page is translated for signed-out visitors) and cached at the edge,
// so a visitor's browser gets it in a few tens of milliseconds and every later screen is translated from memory, with no waiting and no requests.
// Nothing a person writes is ever in it: it holds only text written in the code. If the language is not complete yet (the build step normally completes every language), the rest is translated in the background
// of this request, one visitor at a time, and the next load has it.
let completing = false;

export async function GET(_req: Request, props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const lang = params.lang;
  if (!isLang(lang) || lang === "en") return NextResponse.json({ error: "Unsupported language." }, { status: 404 });
  try {
    const { d, count, total } = await dictionaryFor(lang);
    if (count < total && !completing && process.env.ANTHROPIC_API_KEY && process.env.TRANSLATE_KILL_SWITCH !== "1") {
      completing = true;
      waitUntil((async () => {
        try { for (let i = 0; i < 4; i++) { const r = await warmLanguage(lang, 240); if (!r.remaining || !r.added) break; } }
        catch (e) { console.warn("[i18n] background completion failed:", e instanceof Error ? e.message : e); }
        finally { completing = false; }
      })());
    }
    // A complete dictionary may be cached for a long time; an incomplete one only briefly, so what is translated meanwhile shows up soon.
    const cache = count >= total ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
    return NextResponse.json({ d, n: count, t: total }, { headers: { "Cache-Control": cache } });
  } catch (e) {
    console.error("[i18n] dictionary failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ d: {}, n: 0, t: 0 }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
