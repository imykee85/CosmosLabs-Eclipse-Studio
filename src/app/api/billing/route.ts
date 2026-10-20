import { NextResponse } from "next/server";
import { getAutoTopup } from "@/lib/billing";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { paymentProvider } from "@/lib/payments";
import { AUTO_MONTHLY_CAPS, AUTO_THRESHOLDS, CUSTOM_MAX_CREDITS, CUSTOM_MIN_CREDITS, creditPacks } from "@/lib/plans";
import { hasSubscription, lockedTopup, subscriptionRuleOn, topupRemaining } from "@/lib/subscription";
import { workspaceSession } from "@/lib/workspace";

// What the Billing tab needs: the top-up packs, the person's auto top-up choice and whether payments are set up.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId, isTeam, isAdmin } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const provider = paymentProvider();
  const [subscribed, locked, topup] = await Promise.all([hasSubscription(userId), lockedTopup(userId), topupRemaining(userId)]);
  return NextResponse.json({
    packs: creditPacks,
    custom: { min: CUSTOM_MIN_CREDITS, max: CUSTOM_MAX_CREDITS },
    thresholds: AUTO_THRESHOLDS,
    caps: AUTO_MONTHLY_CAPS,
    team: { isTeam, isAdmin },
    subscribed: !subscriptionRuleOn() || subscribed,
    lockedTopup: locked,
    topupCredits: topup,
    paymentsReady: Boolean(provider),
    autoReady: Boolean(provider?.chargeSavedCard),
    auto: await getAutoTopup(userId),
  });
}
