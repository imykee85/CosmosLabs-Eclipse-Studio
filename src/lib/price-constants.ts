// How credits relate to money (owner decision 2026-10-20). Safe for the browser and the server.
// One credit is worth $0.10 to the customer and pays for $0.04 of provider cost (a 2.5x markup). Images, video and everything else priced from a provider's list cost
// use creditsForUsd; the ledger counts in tenths of a credit (credit-units.ts).

/** The dollars of provider cost one credit pays for. */
export const CREDIT_PROVIDER_USD = 0.04;

/** Whole credits for a provider list cost: cost / $0.04 rounded UP once (never below 1). The 6-decimal round keeps 0.12 / 0.04 from becoming 3.0000000000000004. */
export const creditsForUsd = (usd: number): number => Math.max(1, Math.ceil(Math.round((usd / CREDIT_PROVIDER_USD) * 1e6) / 1e6));
