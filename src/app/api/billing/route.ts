import { NextResponse } from "next/server";
import { getAutoTopup } from "@/lib/billing";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { paymentProvider } from "@/lib/payments";
import { AUTO_MONTHLY_CAPS, AUTO_THRESHOLDS, creditPacks } from "@/lib/plans";
import { workspaceSession } from "@/lib/workspace";

// What the Billing tab needs: the top-up packs, the person's auto top-up choice and whether payments are set up.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId, isTeam, isAdmin } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const provider = paymentProvider();
  return NextResponse.json({
    packs: creditPacks,
    thresholds: AUTO_THRESHOLDS,
    caps: AUTO_MONTHLY_CAPS,
    team: { isTeam, isAdmin },
    paymentsReady: Boolean(provider),
    autoReady: Boolean(provider?.chargeSavedCard),
    auto: await getAutoTopup(userId),
  });
}
