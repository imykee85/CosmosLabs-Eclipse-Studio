import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { getBalance } from "@/lib/credits";
import { hasSubscription, lockedTopup, subscriptionRuleOn, topupRemaining } from "@/lib/subscription";
import { db } from "@/lib/db";
import { ensureWelcomeCredits } from "@/lib/welcome-credits";
import { workspaceSession } from "@/lib/workspace";

// The signed-in user's credit balance and recent activity.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode" }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // A new account's welcome credits are granted here the first time its balance is asked for (once; the ledger's unique key makes a repeat a no-op).
    const welcome = await ensureWelcomeCredits(userId).catch(() => 0);
    const [total, rows, admin, locked, subscribed, topup] = await Promise.all([
      getBalance(userId),
      db.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 25 }),
      getAdmin(),
      lockedTopup(userId),
      hasSubscription(userId),
      topupRemaining(userId),
    ]);
    const balance = total - locked; // what can be spent now; locked top-up credits are shown separately
    return NextResponse.json({
      balance,
      lockedTopup: locked,
      topupCredits: topup,
      subscribed: !subscriptionRuleOn() || subscribed,
      charging: process.env.CREDITS_ENABLED === "1",
      isAdmin: Boolean(admin),
      welcome, // the welcome credits this account was given (ledger units), 0 when none
      history: rows.map((r: { id: string; delta: number; reason: string; note: string | null; createdAt: Date }) => ({ id: r.id, delta: r.delta, reason: r.reason, note: r.note, createdAt: r.createdAt })),
    });
  } catch (err) {
    console.error("loading credits failed", err);
    return NextResponse.json({ error: "Could not load your credits." }, { status: 500 });
  }
}
