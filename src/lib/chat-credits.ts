import { autoTopup } from "@/lib/billing";
import { spendUpTo } from "@/lib/credits";
import { freeCredits } from "@/lib/reservations";
import { lockedTopup } from "@/lib/subscription";
import { refusal, type Refusal } from "@/lib/subscribe-alert";

import { fmtCredits } from "@/lib/credit-units";
// Core and Atlas (and custom agents) are paid in Eclipse credits, priced from what each reply really used: the model's token prices (Anthropic
// list prices, read 2026-10-17) x a margin, turned into credits at a dollar value per credit, rounded up, at least CHAT_MIN_CREDITS. Watching a
// video is included: its frames are input tokens. Only when CREDITS_ENABLED=1. All numbers are Config values and PROVISIONAL.

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }; // USD per million tokens
const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};
// A model we have no row for (a server-side fallback answering instead) is priced like the dearest Opus, so we never undercharge.
const UNKNOWN: Price = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

const num = (name: string, fallback: number) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : fallback; };
export const chatCreditsOn = () => process.env.CREDITS_ENABLED === "1";
export const creditUsd = () => num("CHAT_CREDIT_USD", 0.01);
export const chatMargin = () => num("CHAT_MARGIN", 2.5);
export const minCredits = () => Math.floor(num("CHAT_MIN_CREDITS", 1));
/** What a person needs free before a message starts (a typical reply; the real cost is charged after). */
export const startCredits = () => Math.floor(num("CHAT_START_CREDITS", 5));

export type TokenUsage = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

/** Adds up what one reply used across all its model calls (a reply with tools makes several). */
export class ChatMeter {
  usd = 0;
  add(model: string, u: TokenUsage | null | undefined) {
    if (!u) return;
    const p = PRICES[model] ?? UNKNOWN;
    this.usd += ((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6;
  }
  credits() { return this.usd > 0 ? Math.max(minCredits(), Math.ceil((this.usd * chatMargin()) / creditUsd())) : 0; }
}

export const OUT_OF_CREDITS = "You're out of credits. Upgrade your plan or buy more credits in Settings, Billing.";

/** Null when the person may send a message, else the sentence to show. */
export async function chatCreditCheck(userId: string): Promise<string | null> {
  if (!chatCreditsOn()) return null;
  if ((await freeCredits(userId)) >= startCredits()) return null;
  if (await autoTopup(userId, { needed: startCredits() })) return null; // topped up automatically, as the person asked
  const locked = await lockedTopup(userId);
  return locked > 0 ? `You're out of credits. Your ${fmtCredits(locked)} top-up credits are saved but locked until you subscribe to a plan.` : OUT_OF_CREDITS;
}

/** The same check as a ready answer for the route: the subscription alert for an unsubscribed account, the usual sentence otherwise. Null when the message may go ahead. */
export async function chatRefusal(userId: string): Promise<Refusal | null> {
  const why = await chatCreditCheck(userId);
  return why ? refusal(userId, why, why !== OUT_OF_CREDITS) : null;
}

/** Charges a finished reply (what it used, up to what is left). Returns the credits taken. */
export async function chargeChat(userId: string, meter: ChatMeter, note: string): Promise<number> {
  if (!chatCreditsOn()) return 0;
  const c = meter.credits();
  if (!c) return 0;
  return spendUpTo(userId, c, note).catch((e) => { console.error("chat charge failed", userId, e); return 0; });
}
