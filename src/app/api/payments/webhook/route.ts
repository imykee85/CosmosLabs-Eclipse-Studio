import { NextResponse } from "next/server";
import { grantCredits } from "@/lib/credits";
import { InvalidWebhookError, paymentProvider } from "@/lib/payments";
import { plans } from "@/lib/plans";

// The payment provider calls this when a payment goes through. Credits are granted here, by us, never by the browser.
// Public in the middleware (the provider has no sign-in), so the signature check below is the only gate.
export async function POST(req: Request) {
  const provider = paymentProvider();
  if (!provider) return NextResponse.json({ error: "Payments are not set up yet." }, { status: 503 });

  const rawBody = await req.text();
  let event;
  try {
    event = await provider.parseWebhook(rawBody, req.headers);
  } catch (err) {
    if (err instanceof InvalidWebhookError) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    console.error("payment webhook could not be read", err);
    return NextResponse.json({ error: "Unreadable event" }, { status: 400 });
  }
  if (!event) return NextResponse.json({ ok: true, ignored: true });

  const plan = plans.find((p) => p.id === event.planId);
  if (!plan) {
    // A configuration problem, not a bad delivery: answer with an error so the provider retries once it is fixed.
    console.error(`payment ${event.externalId} is for an unknown plan "${event.planId}"`);
    return NextResponse.json({ error: "Unknown plan" }, { status: 422 });
  }

  try {
    const added = await grantCredits(event.userId, plan.credits, { reason: "PURCHASE", provider: event.provider, externalId: event.externalId });
    return NextResponse.json({ ok: true, duplicate: !added });
  } catch (err) {
    console.error("granting purchased credits failed", err);
    return NextResponse.json({ error: "Could not record the purchase" }, { status: 500 });
  }
}
