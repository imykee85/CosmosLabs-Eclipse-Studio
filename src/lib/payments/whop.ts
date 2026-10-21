import { fmtCredits } from "../credit-units";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { InvalidWebhookError } from "./types";
import { productById } from "@/lib/plans";
import type { CheckoutInput, PaymentEvent, PaymentProvider, PaymentRefs, SavedCard, SavedCardCharge } from "./types";

// Whop adapter. Checked with Whop's assistant against its API definitions on 2026-10-20: inline plans on checkout, POST /payments for an
// off-session charge (its answer means CREATED, never "paid": credits come only from the payment.succeeded webhook), GET /payment_methods
// (with future_usage=off_session for cards that may be charged without the person present), checkout mode "setup", the account_id field, and
// cancel with cancel_at_period_end. Webhooks are verified with Whop's own SDK helper (unwrapWebhook, the ws_... secret passed as-is).
// Events (Whop's review of its docs, 2026-10-20): payment.succeeded, payment.failed, payment.requires_action (recovery_url for 3D Secure),
// membership.activated and membership.updated (data.status; canceled, expired and completed mean ended; membership.deactivated does NOT exist),
// refund.created and refund.updated (data.amount in dollars, data.status, data.payment with its plan and metadata), setup_intent.succeeded
// (data.member.id, data.payment_method.id). Retries reuse the webhook-id header (deduplicated in the route).
// Still NOT confirmed (the first real events are logged with their shape on /admin/health; code against what arrives): whether a renewal
// carries our metadata (if not, the plan id and the saved membership id are used), the plan field on payment.succeeded, the name of the
// payment's total on a refund (several are tried, else our own price), and that POST /payments returns the same id as the later events.
// Everything fails closed: a delivery that does not verify or does not parse never grants credits.

const DEFAULT_API_BASE = "https://api.whop.com/api/v1";
const PAYMENT_SUCCEEDED = "payment.succeeded";
const SETUP_SUCCEEDED = "setup_intent.succeeded";
const PAYMENT_FAILED = "payment.failed";
const PAYMENT_REQUIRES_ACTION = "payment.requires_action";
const MEMBERSHIP_UPDATED = "membership.updated";
const MEMBERSHIP_ACTIVATED = "membership.activated";
const MEMBERSHIP_DEACTIVATED = "membership.deactivated"; // not a Whop event (its review, 2026-10-20); still read if one ever arrives
const REFUND_CREATED = "refund.created";
const REFUND_UPDATED = "refund.updated";
const ENDED = new Set(["canceled", "cancelled", "expired", "completed"]);
const LIVE = new Set(["active", "trialing"]);

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
    ...(credits ? { title: `Top-up ${fmtCredits(credits)} credits`, metadata: { credits, type: "topup" } } : {}),
  };
}

/** Whop calls the company field account_id. The value is the company id (biz_...) from WHOP_COMPANY_ID. */
const account = () => (process.env.WHOP_COMPANY_ID ? { account_id: process.env.WHOP_COMPANY_ID } : {});

const apiBase = () => process.env.WHOP_API_BASE ?? DEFAULT_API_BASE;
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHOP_API_KEY}` });
const text = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => { const n = typeof v === "string" ? Number(v) : v; return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined; };
/** An ISO date or Unix seconds. */
const dateOf = (v: unknown): Date | undefined => { const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : typeof v === "string" && v ? new Date(v) : undefined; return d && !Number.isNaN(d.getTime()) ? d : undefined; };
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

    const event = JSON.parse(rawBody) as { type?: string; timestamp?: unknown; account_id?: unknown; company_id?: unknown; data?: { id?: string; metadata?: { userId?: unknown; planId?: unknown } } & Record<string, unknown> };
    // Newer webhook versions name the company account_id in the envelope, older ones company_id. A delivery for another company is not ours.
    const company = text(event.account_id) ?? text(event.company_id);
    if (company && process.env.WHOP_COMPANY_ID && company !== process.env.WHOP_COMPANY_ID) { console.error("whop event for another company", company); return null; }
    const d = event.data ?? {};
    const meta = (d.metadata && typeof d.metadata === "object" ? d.metadata : {}) as Record<string, unknown>;

    if (event.type === SETUP_SUCCEEDED) {
      // A card was saved without a purchase (data.member.id, data.payment_method.id). The person is named by our metadata when Whop copies it,
      // else found later from the member id (applyPayment).
      const refs = refsFrom(d);
      if (typeof d.id !== "string" || !refs) return null;
      return { provider: "whop", externalId: d.id, userId: text(meta.userId) ?? "", planId: "", cardOnly: true, refs };
    }
    if (event.type === MEMBERSHIP_UPDATED || event.type === MEMBERSHIP_ACTIVATED || event.type === MEMBERSHIP_DEACTIVATED) {
      // data.id is the membership. A cancellation set for the end of the period keeps the status active (cancel_at_period_end: true): access
      // stays until the status itself becomes canceled, expired or completed. (membership.deactivated is not a Whop event; read if it ever comes.)
      const membershipId = text(d.id);
      if (!membershipId) return null;
      const status = event.type === MEMBERSHIP_DEACTIVATED ? "canceled" : event.type === MEMBERSHIP_ACTIVATED ? (text(d.status) ?? "active") : text(d.status);
      const at = dateOf(d.updated_at) ?? dateOf(event.timestamp) ?? new Date();
      if (status && ENDED.has(status)) return { provider: "whop", externalId: `membership:${membershipId}:${status}`, userId: "", planId: "", kind: "deactivated", at, refs: { membershipId } };
      if (status && LIVE.has(status)) return { provider: "whop", externalId: `membership:${membershipId}:${status}`, userId: "", planId: "", kind: "activated", at, refs: { membershipId } };
      return null; // past_due and the like: nothing changes until it is resolved one way or the other
    }
    if (event.type === REFUND_CREATED || event.type === REFUND_UPDATED) {
      const refundId = text(d.id);
      const pay = (d.payment && typeof d.payment === "object" ? d.payment : {}) as Record<string, unknown>;
      const paymentId = idOf(d.payment) ?? text(d.payment_id);
      if (!refundId || !paymentId) { console.error("whop refund event without its ids"); return null; }
      // Only a refund that went through takes credits back; a pending one is acted on when refund.updated says it succeeded.
      if (text(d.status) !== "succeeded") return null;
      const amount = num(d.amount);
      // What the whole payment was, to take back the same share of its credits: the payment's own total, else the price of what it bought.
      const payMeta = (pay.metadata && typeof pay.metadata === "object" ? pay.metadata : {}) as Record<string, unknown>;
      const product = productById(text(payMeta.planId) ?? ourPlanId(idOf(pay.plan) ?? text(pay.plan_id)), Number(payMeta.credits));
      const total = num(pay.total) ?? num(pay.final_amount) ?? num(pay.usd_total) ?? num(pay.subtotal) ?? num(pay.amount) ?? product?.price;
      return { provider: "whop", externalId: `refund:${paymentId}:${refundId}`, userId: "", planId: "", kind: "refund", refundOf: paymentId, ...(amount !== undefined ? { refundAmount: amount } : {}), ...(total ? { paymentTotal: total } : {}) };
    }
    if (event.type === PAYMENT_FAILED || event.type === PAYMENT_REQUIRES_ACTION) {
      // Matters only for an automatic top-up (a checkout shows its own error to the person). Matched by the pending payment id, or our metadata.
      const id = text(d.id);
      if (!id) return null;
      if (event.type === PAYMENT_FAILED) return { provider: "whop", externalId: id, userId: text(meta.userId) ?? "", planId: "", kind: "failed", auto: meta.auto === "1" };
      const url = text(d.recovery_url);
      return { provider: "whop", externalId: id, userId: text(meta.userId) ?? "", planId: "", kind: "action", auto: meta.auto === "1", ...(url && url.startsWith("https://") ? { actionUrl: url } : {}) };
    }
    if (event.type !== PAYMENT_SUCCEEDED) return null;

    const id = text(d.id);
    if (!id) { console.error("whop payment event without an id"); return null; }
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

  async cancelMembership(membershipId: string, opts?: { atPeriodEnd?: boolean }) {
    const path = (process.env.WHOP_CANCEL_PATH ?? "/memberships/{id}/cancel").replace("{id}", encodeURIComponent(membershipId));
    const res = await fetch(`${apiBase()}${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ cancel_at_period_end: Boolean(opts?.atPeriodEnd) }) });
    if (!res.ok) throw new Error(`Whop cancel failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  },
};

export const whopConfigured = Boolean(process.env.WHOP_API_KEY && process.env.WHOP_WEBHOOK_SECRET);
