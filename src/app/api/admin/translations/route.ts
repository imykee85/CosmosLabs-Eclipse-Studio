import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { isLang } from "@/lib/i18n/languages";
import { manifestSize, translationCounts, warmLanguage } from "@/lib/i18n/translate-server";

export const maxDuration = 60;

// Owner only. GET: how many interface strings each language has. POST {lang}: translate the next batch of missing strings in that language.
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json({ total: manifestSize, counts: await translationCounts() });
}

export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!isLang(body?.lang) || body.lang === "en") return NextResponse.json({ error: "Choose a language." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 503 });
  try {
    return NextResponse.json(await warmLanguage(body.lang, 180));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Translation failed." }, { status: 500 });
  }
}
