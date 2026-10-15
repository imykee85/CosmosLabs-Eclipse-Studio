import { isLang } from "./languages";

// Where someone is -> the language they most likely read and the money they most likely pay in.
// The country comes from the host's IP lookup (Vercel sets the x-vercel-ip-country header); nothing here stores it.
const L = (lang: string, countries: string) => countries.split(" ").map((c) => [c, lang] as const);
const COUNTRY_LANG: Record<string, string> = Object.fromEntries([
  ...L("es", "CO MX ES AR CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR GQ"),
  ...L("pt", "BR PT AO MZ CV GW ST TL"),
  ...L("fr", "FR MC SN CI CM CD MG ML BF NE TD GN BJ TG RW BI HT GA CG DJ LU"),
  ...L("de", "DE AT LI"),
  ...L("it", "IT SM VA"),
  ...L("nl", "NL SR"),
  ...L("pl", "PL"),
  ...L("tr", "TR"),
  ...L("ru", "RU BY KZ KG"),
  ...L("uk", "UA"),
  ...L("id", "ID"),
  ...L("vi", "VN"),
  ...L("th", "TH"),
  ...L("ja", "JP"),
  ...L("ko", "KR"),
  ...L("zh", "CN TW HK MO SG"),
  ...L("hi", "IN"),
]);

// Countries where several languages are common: the browser's own language setting decides when it is one we support.
const MIXED = new Set(["CH", "BE", "CA", "IN", "SG", "LU", "HK", "MO", "FI", "ZA"]);

const EUR = "DE FR IT ES PT NL BE AT IE FI GR SK SI LT LV EE LU MT CY HR MC SM VA AD ME XK";
const COUNTRY_CURRENCY: Record<string, string> = Object.fromEntries([
  ...EUR.split(" ").map((c) => [c, "EUR"] as const),
  ["CO", "COP"], ["MX", "MXN"], ["AR", "ARS"], ["CL", "CLP"], ["PE", "PEN"], ["BR", "BRL"], ["UY", "UYU"], ["PY", "PYG"], ["BO", "BOB"], ["CR", "CRC"], ["DO", "DOP"], ["GT", "GTQ"], ["HN", "HNL"], ["NI", "NIO"], ["VE", "VES"],
  ["GB", "GBP"], ["CH", "CHF"], ["SE", "SEK"], ["NO", "NOK"], ["DK", "DKK"], ["PL", "PLN"], ["CZ", "CZK"], ["HU", "HUF"], ["RO", "RON"], ["BG", "BGN"], ["TR", "TRY"], ["UA", "UAH"], ["RU", "RUB"], ["IS", "ISK"],
  ["CA", "CAD"], ["AU", "AUD"], ["NZ", "NZD"], ["JP", "JPY"], ["KR", "KRW"], ["CN", "CNY"], ["HK", "HKD"], ["TW", "TWD"], ["SG", "SGD"], ["MY", "MYR"], ["TH", "THB"], ["VN", "VND"], ["ID", "IDR"], ["PH", "PHP"], ["IN", "INR"], ["PK", "PKR"], ["BD", "BDT"], ["LK", "LKR"],
  ["AE", "AED"], ["SA", "SAR"], ["QA", "QAR"], ["KW", "KWD"], ["IL", "ILS"], ["EG", "EGP"], ["MA", "MAD"], ["NG", "NGN"], ["KE", "KES"], ["GH", "GHS"], ["ZA", "ZAR"], ["KZ", "KZT"],
]);

/** The language to show for a country, or null when the country is unknown or English-speaking. */
export function langForCountry(country: string | null | undefined): string | null {
  const c = (country ?? "").toUpperCase();
  return COUNTRY_LANG[c] ?? null;
}

/** The first supported language in an Accept-Language header ("es-CO,es;q=0.9,en;q=0.8"), or null. */
export function langFromAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => {
    const [tag, ...rest] = p.trim().split(";");
    const q = Number(rest.find((r) => r.trim().startsWith("q="))?.split("=")[1] ?? 1);
    return { base: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0 };
  }).sort((a, b) => b.q - a.q);
  for (const p of parts) if (isLang(p.base)) return p.base;
  return null;
}

/** Country first (the visitor may have come from an ad with a phone set to English), the browser's language for countries that mix several. */
export function detectLang(country: string | null | undefined, acceptLanguage: string | null | undefined): string {
  const c = (country ?? "").toUpperCase();
  const fromBrowser = langFromAcceptLanguage(acceptLanguage);
  if (!c) return fromBrowser ?? "en";
  if (MIXED.has(c) && fromBrowser) return fromBrowser;
  return langForCountry(c) ?? "en";
}

export function currencyForCountry(country: string | null | undefined): string {
  return COUNTRY_CURRENCY[(country ?? "").toUpperCase()] ?? "USD";
}
