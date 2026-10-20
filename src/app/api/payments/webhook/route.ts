import { NextResponse } from "next/server";
import { applyPayment } from "@/lib/billing";
import { InvalidWebhookError, paymentProvider } from "@/lib/payments";
import { logPaymentEvent } from "@/lib/payments/event-log";

// The payment provider calls this when a payment goes through. Credits are granted here, by us, never by the browser.
// Public in the middleware (the provider has no sign-in), so the signature check below is the only gate.
// Every delivery that passes the check is logged with its shape (no values) so the owner can see what the provider really sends (/admin/health).
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
    await logPaymentEvent(provider.name, rawBody, "error", null, "unreadable after the signature check");
    return NextResponse.json({ error: "Unreadable event" }, { status: 400 });
  }
  if (!event) {
    await logPaymentEvent(provider.name, rawBody, "ignored");
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const result = await applyPayment(event);
    if (!result.ok) {
      // Not a bad delivery: we could not tell whose payment it was or which plan. Answer with an error so the provider retries once it is fixed;
      // the log and the alert make sure it is not retried forever unseen.
      await logPaymentEvent(provider.name, rawBody, "unmatched", event.externalId, `${result.error} (plan "${event.planId}")`);
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    await logPaymentEvent(provider.name, rawBody, result.duplicate ? "duplicate" : "applied", event.externalId);
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    console.error("granting purchased credits failed", err);
    await logPaymentEvent(provider.name, rawBody, "error", event.externalId, err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not record the purchase" }, { status: 500 });
  }
}
