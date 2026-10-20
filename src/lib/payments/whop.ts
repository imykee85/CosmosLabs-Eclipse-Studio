import { unwrapWebhook } from "@whop/sdk/helpers";
import { InvalidWebhookError } from "./types";
import type { CheckoutInput, PaymentEvent, PaymentProvider, PaymentRefs, SavedCard, SavedCardCharge } from "./types";

// Whop adapter. Checked with Whop's assistant against its API definitions on 2026-10-20: inline plans on checkout, POST /payments for an
// off-session charge (its answer means CREATED, never "paid": credits come only from the payment.succeeded webhook), GET /payment_methods
// (with future_usage=off_session for cards that may be charged without the person present), checkout mode "setup", the account_id field, and
// cancel with cancel_at_period_end. Webhooks are verified with Whop's own SDK helper (unwrapWebhook, the ws_... secret passed as-is).
// Still NOT confirmed (the first real events are logged with their shape on /admin/health; code against what arrives):
//  - the fields each event carries: member, payment method and membership on payment.succeeded (read defensively in refsFrom), whether a
//    renewal carries our metadata (if not, the plan id and the saved membership id are used), the membership id on membership.deactivated,
//    and the payment id and any partial amount on refund.created,
//  - DELETE /payment_methods/<id> (WHOP_PAYMENT_METHOD_PATH) and the "setup_intent.succeeded" event of a card-only checkout.
// Everything fails closed: a delivery that does not verify or does not parse never grants credits.

const DEFAULT_API_BASE = "https://api.whop.com/api/v1";
const PAYMENT_SUCCEEDED = "payment.succeeded";
const SETUP_SUCCEEDED = "setup_intent.succeeded";
const MEMBERSHIP_DEACTIVATED = "membership.deactivated";
const REFUND_CREATED = "refund.created";

/** Whop's id for one of our plans, from WHOP_PLAN_<PLANID> (for example WHOP_PLAN_STARTER=plan_xxxx). */
function whopPlanId(planId: string): string {
  const id = process.env[`WHOP_PLAN_${planId.toUpperCase()}`];
  if (!id) throw new Error(`No Whop plan is set for "${planId}" (WHOP_PLAN_${planId.toUpperCase()})`);
  return id;
}

/** Our plan or pack id for one of Whop's plan ids (the reverse of whopPlanId), from the same WHOP_PLAN_* settings. */
export function ourPlanId(whopId: string | undefined): string | undefined {
  if (!whopId) return undefined;
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith("WHOP_PLAN_") && v === whopId) return k.slice("WHOP_PLAN_".length).toLowerCase();
  return undefined;
}

/** A one-time price with no ready-made plan (a custom top-up or an automatic one), attached to our product so it shows under Eclipse Studios. */
function inlinePlan(price: number, credits: number | undefined) {
  return {
    initial_price: price, currency: "usd", plan_type: "one_time", visibility: "hidden",
    ...(process.env.WHOP_PRODUCT_ID ? { product_id: process.env.WHOP_PRODUCT_ID } : {}),
    ...(credits ? { title: `Top-up ${credits.toLocaleString("en-US")} credits`, metadata: { credits, type: "topup" } } : {}),
  };
}

/** Whop calls the company field account_id. The value is the company id (biz_...) from WHOP_COMPANY_ID. */
const account = () => (process.env.WHOP_COMPANY_ID ? { account_id: process.env.WHOP_COMPANY_ID } : {});

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

  async createCheckout({ userId, planId, returnUrl, custom }: CheckoutInput) {
    const res = await fetch(`${apiBase()}/checkout_configurations`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        // A custom amount has no ready-made plan: the one-time price goes in the request itself.
        ...(custom ? { plan: inlinePlan(custom.price, custom.credits) } : { plan_id: whopPlanId(planId) }),
        ...account(),
        redirect_url: returnUrl,
        // Whop copies this onto the payment, which is how the webhook later knows whose purchase it was and which plan.
        metadata: { userId, planId, ...(custom ? { credits: custom.credits } : {}) },
      }),
    });
    if (!res.ok) throw new Error(`Whop checkout failed (${res.status}): ${await res.text()}`);
    const body = (await res.json()) as { purchase_url?: string };
    if (!body.purchase_url) throw new Error("Whop did not return a checkout address");
    return { url: body.purchase_url };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent | null> {
    try {
      unwrapWebhook(rawBody, { headers: Object.fromEntries(headers), key: process.env.WHOP_WEBHOOK_SECRET ?? "" });
    } catch {
      throw new InvalidWebhookError("Signature does not verify"); // a missing key also fails closed
    }

    const event = JSON.parse(rawBody) as { type?: string; data?: { id?: string; metadata?: { userId?: unknown; planId?: unknown } } & Record<string, unknown> };
    if (event.type === SETUP_SUCCEEDED) {
      // A card was saved without a purchase. Only the references are kept; the metadata we set when opening the page names the person.
      const d = event.data ?? {};
      const who = d.metadata?.userId;
      const refs = refsFrom(d);
      if (typeof d.id !== "string" || typeof who !== "string" || !refs) return null;
      return { provider: "whop", externalId: d.id, userId: who, planId: "", cardOnly: true, refs };
    }
    if (event.type === MEMBERSHIP_DEACTIVATED) {
      // A subscription ended (cancelled and run out, or payment failed for good). Its id is the membership's own id.
      const d = event.data ?? {};
      const membershipId = text(d.id);
      if (!membershipId) return null;
      return { provider: "whop", externalId: `deactivated:${membershipId}`, userId: text((d.metadata as Record<string, unknown> | undefined)?.userId) ?? "", planId: "", kind: "deactivated", refs: { membershipId } };
    }
    if (event.type === REFUND_CREATED) {
      const d = event.data ?? {};
      const refundId = text(d.id);
      const paymentId = idOf(d.payment) ?? text(d.payment_id);
      if (!refundId || !paymentId) { console.error("whop refund event without its ids"); return null; }
      return { provider: "whop", externalId: `refund:${refundId}`, userId: "", planId: "", kind: "refund", refundOf: paymentId };
    }
    if (event.type !== PAYMENT_SUCCEEDED) return null;

    const d = event.data ?? {};
    const id = text(d.id);
    if (!id) { console.error("whop payment event without an id"); return null; }
    const meta = (d.metadata && typeof d.metadata === "object" ? d.metadata : {}) as Record<string, unknown>;
    const refs = refsFrom(d);
    // Our checkout puts userId and planId on the payment. A renewal may arrive without them: then the plan is read from Whop's own plan id
    // (mapped back through the WHOP_PLAN_* settings) and the person from the subscription's membership id, saved on their first payment.
    const userId = text(meta.userId) ?? text(meta.app_user_id) ?? "";
    const planId = text(meta.planId) ?? ourPlanId(idOf(d.plan) ?? text(d.plan_id));
    if (!planId || (!userId && !refs?.membershipId)) {
      console.error("whop payment event without a known plan or owner", id);
      return null;
    }
    const credits = Number(meta.credits);
    return { provider: "whop", externalId: id, userId, planId, ...(Number.isInteger(credits) && credits > 0 ? { credits } : {}), auto: meta.auto === "1", refs };
  },

  async chargeSavedCard({ userId, productId, credits, price, memberId, paymentMethodId, idempotencyKey }: SavedCardCharge) {
    const res = await fetch(`${apiBase()}${process.env.WHOP_CHARGE_PATH ?? "/payments"}`, {
      method: "POST",
      headers: { ...authHeaders(), "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        ...account(),
        member_id: memberId,
        payment_method_id: paymentMethodId,
        off_session: true,
        plan: inlinePlan(price, credits),
        metadata: { userId, planId: productId, ...(credits ? { credits } : {}), auto: "1" },
      }),
    });
    if (!res.ok) throw new Error(`Whop charge failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { id?: string };
    if (!body.id) throw new Error("Whop did not return a payment id");
    // The answer is the payment as CREATED, not a promise it went through: the credits are granted only by the payment.succeeded webhook.
    return { externalId: body.id, status: "pending" as const };
  },

  async listPaymentMethods(memberId: string, opts: { offSessionOnly?: boolean } = {}): Promise<SavedCard[]> {
    const path = process.env.WHOP_PAYMENT_METHODS_PATH ?? "/payment_methods";
    const filter = opts.offSessionOnly ? "&future_usage=off_session" : "";
    const res = await fetch(`${apiBase()}${path}?member_id=${encodeURIComponent(memberId)}${filter}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Whop card list failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { data?: unknown[] } | unknown[];
    const rows = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : [];
    const out: SavedCard[] = [];
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      const card = (row.card && typeof row.card === "object" ? row.card : row) as Record<string, unknown>;
      const id = text(row.id);
      const last4 = text(card.last4) ?? text(card.last_4);
      if (!id || !last4) continue;
      const month = Number(card.exp_month ?? card.expiry_month), year = Number(card.exp_year ?? card.expiry_year);
      out.push({ id, brand: text(card.brand) ?? text(card.network) ?? "card", last4, ...(month >= 1 && month <= 12 ? { expMonth: month } : {}), ...(year > 2000 ? { expYear: year } : {}) });
    }
    return out;
  },

  async removePaymentMethod(_memberId: string, paymentMethodId: string) {
    const path = (process.env.WHOP_PAYMENT_METHOD_PATH ?? "/payment_methods/{id}").replace("{id}", encodeURIComponent(paymentMethodId));
    const res = await fetch(`${apiBase()}${path}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error(`Whop card removal failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  },

  async createCardSetup({ userId, returnUrl }: { userId: string; returnUrl: string }) {
    const res = await fetch(`${apiBase()}/checkout_configurations`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        mode: "setup",
        ...account(),
        redirect_url: returnUrl,
        metadata: { userId, kind: "card" },
      }),
    });
    if (!res.ok) throw new Error(`Whop card setup failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { purchase_url?: string };
    if (!body.purchase_url) throw new Error("Whop did not return a card page address");
    return { url: body.purchase_url };
  },

  async cancelMembership(membershipId: string) {
    const path = (process.env.WHOP_CANCEL_PATH ?? "/memberships/{id}/cancel").replace("{id}", encodeURIComponent(membershipId));
    const res = await fetch(`${apiBase()}${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ cancel_at_period_end: false }) });
    if (!res.ok) throw new Error(`Whop cancel failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  },
};

export const whopConfigured = Boolean(process.env.WHOP_API_KEY && process.env.WHOP_WEBHOOK_SECRET);
