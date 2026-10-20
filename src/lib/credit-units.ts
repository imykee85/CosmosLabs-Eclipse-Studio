// The ledger counts in TENTHS of a credit: one credit is worth $0.10 to the customer and is stored as 10 ledger units. Everything the database and the
// server add up (balances, holds, charges, plan grants) is in ledger units; only what a person reads is in credits, through fmtCredits.
export const LEDGER_UNITS_PER_CREDIT = 10;

/** Whole credits (or tenths of one) to ledger units. */
export const toLedger = (credits: number): number => Math.round(credits * LEDGER_UNITS_PER_CREDIT);

/** Ledger units to credits as a number (187.4 for 1874). */
export const toCredits = (units: number): number => units / LEDGER_UNITS_PER_CREDIT;

/** What a person sees: a whole number when it is whole, else one decimal ("1", "187.4", "2,500"). */
export function fmtCredits(units: number): string {
  const c = toCredits(units);
  const whole = Number.isInteger(Math.round(c * 10) / 10) && Math.round(c * 10) % 10 === 0;
  return whole ? Math.round(c).toLocaleString("en-US") : (Math.round(c * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "1 credit" / "187.4 credits". */
export const creditsText = (units: number): string => `${fmtCredits(units)} credit${Math.abs(units) === LEDGER_UNITS_PER_CREDIT ? "" : "s"}`;
