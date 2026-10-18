import { verifyStandardWebhook } from "./standard-webhooks";
import type { CheckoutInput, PaymentEvent, PaymentProvider, PaymentRefs, SavedCardCharge } from "./types";

// Whop adapter. NOT yet checked against a live Whop account, so before taking real money confirm these against Whop's developer docs:
//  - the API base address and bearer-token auth (WHOP_API_BASE overrides the default below),
//  - POST /checkout_configurations with plan_id, metadata and redirect_url, answering with purchase_url,
//  - that webhooks are signed the Standard Webhooks way and the successful-payment event is "payment.succeeded",
//  - which fields of that event carry the member, saved payment method and membership (read defensively in refsFrom below),
//  - POST /payments (WHOP_CHARGE_PATH overrides the path) charging a saved payment method for a one-time price, and
//    POST /memberships/<id>/cancel (WHOP_CANCEL_PATH) ending a subscription.
// Everything fails closed: a delivery that does not verify or does not parse never grants credits.

const DEFAULT_API_BASE = "https://api.whop.com/api/v1";
const PAYMENT_SUCCEEDED = "payment.succeeded";

/** Whop's id for one of our plans, from WHOP_PLAN_<PLANID> (for example WHOP_PLAN_STARTER=plan_xxxx). */
function whopPlanId(planId: string): string {
  const id = process.env[`WHOP_PLAN_${planId.toUpperCase()}`];
  if (!id) throw new Error(`No Whop plan is set for "${planId}" (WHOP_PLAN_${planId.toUpperCase()})`);
  return id;
}

const apiBase = () => process.env.WHOP_API_BASE ?? DEFAULT_API_BASE;
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHOP_API_KEY}` });
const text = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const idOf = (v: unknown): string | undefined => text(v) ?? (v && typeof v === "object" ? text((v as { id?: unknown }).id) : undefined);

/** The member, saved payment method and membership on a payment, wherever the provider puts them (each may be a bare id or an object with an id). */
export function refsFrom(data: Record<string, unknown>): PaymentRefs | undefined {
  const refs: PaymentRefs = {
    memberId: idOf(data.member) ?? text(data.member_id),
    paymentMethodId: idOf(data.payment_method) ?? text(data.payment_method_id),
    membershipId: idOf(data.membership) ?? text(data.membership_id),
  };
  return refs.memberId || refs.paymentMethodId || refs.membershipId ? refs : undefined;
}

export const whop: PaymentProvider = {
  name: "whop",

  async createCheckout({ userId, planId, returnUrl }: CheckoutInput) {
    const res = await fetch(`${apiBase()}/checkout_configurations`, {
      method: "POST",
      headers: authHeaders(),
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

    const event = JSON.parse(rawBody) as { type?: string; data?: { id?: string; metadata?: { userId?: unknown; planId?: unknown } } & Record<string, unknown> };
    if (event.type !== PAYMENT_SUCCEEDED) return null;

    const { id, metadata } = event.data ?? {};
    const refs = event.data ? refsFrom(event.data) : undefined;
    if (typeof id !== "string" || typeof metadata?.userId !== "string" || typeof metadata?.planId !== "string") {
      console.error("whop payment event without the expected id or metadata");
      return null;
    }
    return { provider: "whop", externalId: id, userId: metadata.userId, planId: metadata.planId, auto: (metadata as { auto?: unknown }).auto === "1", refs };
  },

  async chargeSavedCard({ userId, productId, price, memberId, paymentMethodId, idempotencyKey }: SavedCardCharge) {
    const res = await fetch(`${apiBase()}${process.env.WHOP_CHARGE_PATH ?? "/payments"}`, {
      method: "POST",
      headers: { ...authHeaders(), "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        ...(process.env.WHOP_COMPANY_ID ? { company_id: process.env.WHOP_COMPANY_ID } : {}),
        member_id: memberId,
        payment_method_id: paymentMethodId,
        plan: { initial_price: price, currency: "usd", plan_type: "one_time" },
        metadata: { userId, planId: productId, auto: "1" },
      }),
    });
    if (!res.ok) throw new Error(`Whop charge failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { id?: string; status?: string };
    if (!body.id) throw new Error("Whop did not return a payment id");
    return { externalId: body.id, status: body.status === "paid" ? ("paid" as const) : ("pending" as const) };
  },

  async cancelMembership(membershipId: string) {
    const path = (process.env.WHOP_CANCEL_PATH ?? "/memberships/{id}/cancel").replace("{id}", encodeURIComponent(membershipId));
    const res = await fetch(`${apiBase()}${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ cancellation_mode: "immediate" }) });
    if (!res.ok) throw new Error(`Whop cancel failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  },
};

export const whopConfigured = Boolean(process.env.WHOP_API_KEY && process.env.WHOP_WEBHOOK_SECRET);
