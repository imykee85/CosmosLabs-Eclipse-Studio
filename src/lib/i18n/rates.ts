// US dollars -> other currencies, for the small "about this much at home" badge next to prices.
// Source: open.er-api.com (free, no key, updated daily). Cached for 12 hours per server instance; if the lookup fails the last good table is used,
// and with none yet the fallback below (rough, rounded figures) so a badge is never wrong by orders of magnitude.
const FALLBACK: Record<string, number> = {
  EUR: 0.92, GBP: 0.79, COP: 4100, MXN: 18, ARS: 1000, CLP: 950, PEN: 3.75, BRL: 5.5, UYU: 41, PYG: 7800, BOB: 6.9, CRC: 510, DOP: 60, GTQ: 7.7, HNL: 25, NIO: 36.8, VES: 40,
  CHF: 0.88, SEK: 10.5, NOK: 10.7, DKK: 6.9, PLN: 4, CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, TRY: 34, UAH: 41, RUB: 92, ISK: 138, CAD: 1.37, AUD: 1.5, NZD: 1.65,
  JPY: 150, KRW: 1350, CNY: 7.2, HKD: 7.8, TWD: 32, SGD: 1.35, MYR: 4.5, THB: 35, VND: 25000, IDR: 16000, PHP: 57, INR: 84, PKR: 280, BDT: 120, LKR: 300,
  AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31, ILS: 3.7, EGP: 49, MAD: 10, NGN: 1600, KES: 129, GHS: 16, ZAR: 18, KZT: 500,
};

type Table = { at: number; rates: Record<string, number> };
let cache: Table | null = null;
const TTL = 12 * 3600 * 1000;

export async function getRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL) return cache.rates;
  try {
    const base = process.env.RATES_URL || "https://open.er-api.com/v6/latest/USD";
    const res = await fetch(base, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!res.ok) throw new Error(`rates ${res.status}`);
    const json = (await res.json()) as { result?: string; rates?: Record<string, unknown> };
    if (json.result && json.result !== "success") throw new Error("rates not successful");
    const rates: Record<string, number> = {};
    for (const [k, v] of Object.entries(json.rates ?? {})) if (typeof v === "number" && v > 0 && /^[A-Z]{3}$/.test(k)) rates[k] = v;
    if (Object.keys(rates).length < 20) throw new Error("rates table too small");
    cache = { at: Date.now(), rates };
    return rates;
  } catch (e) {
    console.warn("[i18n] exchange rates unavailable, using the last good or fallback table:", e instanceof Error ? e.message : e);
    if (cache) { cache.at = Date.now() - TTL + 5 * 60 * 1000; return cache.rates; } // retry in 5 minutes
    return FALLBACK;
  }
}

export async function rateFor(currency: string): Promise<number> {
  if (currency === "USD") return 1;
  const r = await getRates();
  return r[currency] ?? FALLBACK[currency] ?? 0;
}
