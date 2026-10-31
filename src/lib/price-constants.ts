// How credits relate to money (owner decision 2026-10-20). Safe for the browser and the server.
// One credit is worth $0.10 and pays for $0.10 of the model maker's own cost: images and video are charged AT COST, rounded UP to the next cent (0.1 credit),
// the ledger's smallest step (owner decision 2026-10-31; before that images were 2.5x and video 1.8x). The plan's price carries the studio fee, not the model price.

/** The dollars of provider cost one credit pays for. */
export const CREDIT_PROVIDER_USD = 0.10;

/** Credits for a provider cost in dollars: the cost rounded UP to the next cent, as tenths of a credit (never below 0.1). The 6-decimal round keeps float noise
 *  (0.07 x 100 = 7.000000000000001) from becoming an extra tenth. */
export const creditsForUsd = (usd: number): number => Math.max(1, Math.ceil(Math.round(((usd / CREDIT_PROVIDER_USD) * 10) * 1e6) / 1e6)) / 10;

/** Video is charged at the provider's cost too (VIDEO_MARGIN 1, VIDEO_CREDIT_USD 0.10 are Config values kept for an emergency change; the browser only knows the defaults,
 *  the server's charge always follows the environment). Rounded up to the next tenth of a credit ONCE for the whole clip. */
const positive = (name: string, fallback: number) => { const n = typeof process !== "undefined" ? Number(process.env[name]) : NaN; return n > 0 ? n : fallback; };
export const videoMargin = () => positive("VIDEO_MARGIN", 1);
export const videoCreditUsd = () => positive("VIDEO_CREDIT_USD", 0.1);
/** Credits for a clip whose provider cost is `usd` in total, in tenths of a credit. */
export const videoCreditsForUsd = (usd: number): number => Math.max(1, Math.ceil(Math.round(((usd * videoMargin() / videoCreditUsd()) * 10) * 1e6) / 1e6)) / 10;
/** Seedance has always been sold at the provider's own rate; now every video is, so this is the same rule. */
export const videoCreditsAtProviderRate = (usd: number): number => Math.max(1, Math.ceil(Math.round(((usd / videoCreditUsd()) * 10) * 1e6) / 1e6)) / 10;
