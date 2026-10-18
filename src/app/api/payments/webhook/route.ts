import { NextResponse } from "next/server";
import { applyPayment } from "@/lib/billing";
import { InvalidWebhookError, paymentProvider } from "@/lib/payments";

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

  try {
    const result = await applyPayment(event);
    if (!result.ok) {
      // A configuration problem, not a bad delivery: answer with an error so the provider retries once it is fixed.
      console.error(`payment ${event.externalId} is for an unknown plan "${event.planId}"`);
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    console.error("granting purchased credits failed", err);
    return NextResponse.json({ error: "Could not record the purchase" }, { status: 500 });
  }
}
