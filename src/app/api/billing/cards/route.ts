import { NextResponse } from "next/server";
import { listCards } from "@/lib/billing";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { paymentProvider } from "@/lib/payments";
import { claimUsage } from "@/lib/usage";
import { NOT_TEAM_ADMIN, workspaceSession } from "@/lib/workspace";

// The person's saved cards (GET) and the provider's page for adding one (POST). Only team admins touch a team's cards.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await listCards(userId);
  return r.ok ? NextResponse.json({ cards: r.cards }) : NextResponse.json({ error: r.error }, { status: r.status });
}

export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId, isAdmin } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: NOT_TEAM_ADMIN }, { status: 403 });
  const provider = paymentProvider();
  if (!provider?.createCardSetup) return NextResponse.json({ error: "Payments are not set up yet." }, { status: 503 });
  if (!(await claimUsage(userId, "card-setup", 20, 3600_000))) return NextResponse.json({ error: "Too many tries. Try again in a little while." }, { status: 429 });
  try {
    const { url } = await provider.createCardSetup({ userId, returnUrl: `${new URL(req.url).origin}/settings?tab=billing&card=1` });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("card setup failed", err);
    return NextResponse.json({ error: "Could not open the card page. Please try again." }, { status: 502 });
  }
}
