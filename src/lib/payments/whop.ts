import { verifyStandardWebhook } from "./standard-webhooks";
import type { CheckoutInput, PaymentEvent, PaymentProvider } from "./types";

// Whop adapter. NOT yet checked against a live Whop account, so before taking real money confirm these against Whop's developer docs:
//  - the API base address and bearer-token auth (WHOP_API_BASE overrides the default below),
//  - POST /checkout_configurations with plan_id, metadata and redirect_url, answering with purchase_url,
//  - that webhooks are signed the Standard Webhooks way and the successful-payment event is "payment.succeeded".
// Everything fails closed: a delivery that does not verify or does not parse never grants credits.

const DEFAULT_API_BASE = "https://api.whop.com/api/v1";
const PAYMENT_SUCCEEDED = "payment.succeeded";

/** Whop's id for one of our plans, from WHOP_PLAN_<PLANID> (for example WHOP_PLAN_STARTER=plan_xxxx). */
function whopPlanId(planId: string): string {
  const id = process.env[`WHOP_PLAN_${planId.toUpperCase()}`];
  if (!id) throw new Error(`No Whop plan is set for "${planId}" (WHOP_PLAN_${planId.toUpperCase()})`);
  return id;
}

export const whop: PaymentProvider = {
  name: "whop",

  async createCheckout({ userId, planId, returnUrl }: CheckoutInput) {
    const res = await fetch(`${process.env.WHOP_API_BASE ?? DEFAULT_API_BASE}/checkout_configurations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHOP_API_KEY}` },
      body: JSON.stringify({
        plan_id: whopPlanId(planId),
        ...(process.env.WHOP_COMPANY_ID ? { company_id: process.env.WHOP_COMPANY_ID } : {}),
        redirect_url: returnUrl,
        // Whop copies this onto the payment, which is how the webhook later knows whose purchase it was and which plan.
        metadata: { userId, planId },
      }),
    });
    if (!res.ok) throw new Error(`Whop checkout failed (${res.status}): ${await res.text()}`);
    const body = (await res.json()) as { purchase_url?: string };
    if (!body.purchase_url) throw new Error("Whop did not return a checkout address");
    return { url: body.purchase_url };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent | null> {
    verifyStandardWebhook(rawBody, headers, process.env.WHOP_WEBHOOK_SECRET ?? "");

    const event = JSON.parse(rawBody) as { type?: string; data?: { id?: string; metadata?: { userId?: unknown; planId?: unknown } } };
    if (event.type !== PAYMENT_SUCCEEDED) return null;

    const { id, metadata } = event.data ?? {};
    if (typeof id !== "string" || typeof metadata?.userId !== "string" || typeof metadata?.planId !== "string") {
      console.error("whop payment event without the expected id or metadata");
      return null;
    }
    return { provider: "whop", externalId: id, userId: metadata.userId, planId: metadata.planId };
  },
};

export const whopConfigured = Boolean(process.env.WHOP_API_KEY && process.env.WHOP_WEBHOOK_SECRET);
