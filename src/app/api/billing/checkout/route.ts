import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { paymentProvider } from "@/lib/payments";
import { claimUsage } from "@/lib/usage";
import { productById } from "@/lib/plans";
import { NOT_TEAM_ADMIN, workspaceSession } from "@/lib/workspace";

// Starts a purchase of a plan or a top-up pack and returns the provider's checkout address for the browser to open.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId, isAdmin } = workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: NOT_TEAM_ADMIN }, { status: 403 });

  const provider = paymentProvider();
  if (!provider) return NextResponse.json({ error: "Payments are not set up yet." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const plan = productById(body?.packId ?? body?.planId);
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  if (!(await claimUsage(userId, "checkout", 20, 3600_000))) return NextResponse.json({ error: "Too many checkouts started. Try again in a little while." }, { status: 429 });

  try {
    const { url } = await provider.createCheckout({ userId, planId: plan.id, returnUrl: `${new URL(req.url).origin}/settings?tab=billing&paid=1` });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Could not start the checkout. Please try again." }, { status: 502 });
  }
}
