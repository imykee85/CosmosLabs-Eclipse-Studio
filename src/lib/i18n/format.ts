// "$19" -> "≈ COP 78,000": a rough local price next to the real one. Billing stays in US dollars; this is only a guide.
// Rounded to 3 significant figures for large amounts so it reads as an estimate, not a quote.
export function approxPrice(usd: number, currency: string, rate: number, lang: string): string | null {
  if (currency === "USD" || !Number.isFinite(rate) || rate <= 0) return null;
  let v = usd * rate;
  if (v >= 1000) { const mag = Math.pow(10, Math.floor(Math.log10(v)) - 2); v = Math.round(v / mag) * mag; }
  else if (v >= 100) v = Math.round(v);
  else v = Math.round(v * 100) / 100;
  let text: string;
  try {
    text = new Intl.NumberFormat(lang, { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: v >= 100 ? 0 : 2, minimumFractionDigits: 0 }).format(v).replace(/ /g, " ");
  } catch {
    text = `${currency} ${Math.round(v).toLocaleString("en-US")}`;
  }
  return `≈ ${text}`;
}
