import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { paymentProvider } from "@/lib/payments";
import { plans } from "@/lib/plans";

// Starts a purchase of a plan and returns the provider's checkout address for the browser to open.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = paymentProvider();
  if (!provider) return NextResponse.json({ error: "Payments are not set up yet." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const plan = plans.find((p) => p.id === body?.planId);
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

  try {
    const { url } = await provider.createCheckout({ userId, planId: plan.id, returnUrl: `${new URL(req.url).origin}/settings` });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Could not start the checkout. Please try again." }, { status: 502 });
  }
}
