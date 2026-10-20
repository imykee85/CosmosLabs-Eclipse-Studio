import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { getBalance } from "@/lib/credits";
import { creditState, liveGrants } from "@/lib/expiry";
import { hasSubscription, lockedTopup, subscriptionRuleOn, topupRemaining, unusable } from "@/lib/subscription";
import { db } from "@/lib/db";
import { freeMaxCredits, freeRendersLeft } from "@/lib/free-renders";
import { workspaceSession } from "@/lib/workspace";

// The signed-in user's credit balance and recent activity.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode" }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [total, rows, admin, freeImages, locked, subscribed, topup] = await Promise.all([
      getBalance(userId),
      db.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 25 }),
      getAdmin(),
      freeRendersLeft(userId).catch(() => 0),
      lockedTopup(userId),
      hasSubscription(userId),
      topupRemaining(userId),
    ]);
    const state = await creditState(userId);
    const gone = (await unusable(userId)).expired;
    const balance = total - locked - gone; // what can be spent now; locked top-up credits and credits past their date are not counted
    const grants = liveGrants(state);
    return NextResponse.json({
      balance,
      lockedTopup: locked,
      topupCredits: topup,
      expiring: state.next ? { at: new Date(state.next.at).toISOString(), amount: state.next.amount } : null,
      grants,
      subscribed: !subscriptionRuleOn() || subscribed,
      charging: process.env.CREDITS_ENABLED === "1",
      isAdmin: Boolean(admin),
      freeImages,
      freeMax: freeMaxCredits(),
      history: rows.map((r: { id: string; delta: number; reason: string; note: string | null; createdAt: Date }) => ({ id: r.id, delta: r.delta, reason: r.reason, note: r.note, createdAt: r.createdAt })),
    });
  } catch (err) {
    console.error("loading credits failed", err);
    return NextResponse.json({ error: "Could not load your credits." }, { status: 500 });
  }
}
