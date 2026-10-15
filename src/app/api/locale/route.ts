import { NextResponse } from "next/server";
import { currencyForCountry, detectLang } from "@/lib/i18n/geo";
import { rateFor } from "@/lib/i18n/rates";

export const dynamic = "force-dynamic";

// Where the visitor is, the language to show and the local currency with today's rate. Public (landing visitors are signed out).
// The country comes from the host's IP lookup header; it is never stored and is returned only to the same browser.
export async function GET(req: Request) {
  const country = (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "").toUpperCase().slice(0, 2);
  const lang = detectLang(country, req.headers.get("accept-language"));
  const currency = currencyForCountry(country);
  const rate = await rateFor(currency);
  return NextResponse.json({ country: country || null, lang, currency, rate }, { headers: { "Cache-Control": "private, no-store" } });
}
