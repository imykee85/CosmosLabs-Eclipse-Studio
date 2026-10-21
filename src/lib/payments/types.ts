// The only thing the rest of the app knows about taking payments. A provider (Whop today) implements this; swapping providers
// means writing one new file that satisfies it and changing the one line in ./index.ts.
// Plan ids are OUR ids (see src/lib/plans.ts); an adapter translates them to and from its provider's own ids.

/** `custom` is a top-up of any amount: the price is charged as given, with no ready-made plan behind it. */
export type CheckoutInput = { userId: string; planId: string; returnUrl: string; custom?: { credits: number; price: number } };

/** What the provider told us about who paid and how, when it did. Lets a later top-up be charged to the same saved card, and a subscription be cancelled. */
export type PaymentRefs = { memberId?: string; paymentMethodId?: string; membershipId?: string };

/** A payment that went through. Credits are granted from this, by us, in our own ledger. */
export type PaymentEvent = {
  provider: string; externalId: string; userId: string; planId: string; credits?: number; auto?: boolean; refs?: PaymentRefs;
  /** A card was saved without buying anything: only the references are kept, no credits. */ cardOnly?: boolean;
  /**
   * "payment" (default): credits are granted. "deactivated": the subscription with refs.membershipId ended (at `at`). "activated": it is live again.
   * "refund": the payment `refundOf` was refunded (`refundAmount` of `paymentTotal`, in dollars, when the provider says). "failed": a payment was
   * refused. "action": a payment waits for the person to confirm it with their bank (`actionUrl`).
   */
  kind?: "payment" | "deactivated" | "activated" | "refund" | "failed" | "action";
  /** The payment a refund is for. */ refundOf?: string;
  refundAmount?: number; paymentTotal?: number;
  /** When the provider says the subscription ended. */ at?: Date;
  /** The provider's page where the person confirms a payment their bank holds back (3D Secure). */ actionUrl?: string;
};

export type SavedCardCharge = { userId: string; productId: string; credits?: number; price: number; memberId: string; paymentMethodId: string; idempotencyKey: string };

/** A saved card as the provider shows it. Only what is safe to display: never the full number. */
export type SavedCard = { id: string; brand: string; last4: string; expMonth?: number; expYear?: number };

export class InvalidWebhookError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  /** Starts a purchase of one of our plans and returns the provider's hosted checkout address. */
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  /**
   * Checks a webhook delivery and reads it. Throws InvalidWebhookError when the signature does not verify.
   * Returns null for a valid delivery that is not a successful payment we act on.
   */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent | null>;
  /**
   * Charges a top-up to the card the person saved earlier, without them present. "paid" means the money is taken (credits can be granted now);
   * "pending" means the provider will confirm by webhook (Whop always answers "pending"). Throws when the charge is refused or fails.
   */
  chargeSavedCard?(input: SavedCardCharge): Promise<{ externalId: string; status: "paid" | "pending" }>;
  /** The cards saved for this member; offSessionOnly lists only those saved for charging without the person present. */
  listPaymentMethods?(memberId: string, opts?: { offSessionOnly?: boolean }): Promise<SavedCard[]>;
  /** Deletes one saved card at the provider. Throws when it refuses. */
  removePaymentMethod?(memberId: string, paymentMethodId: string): Promise<void>;
  /** Opens the provider's hosted page where the person adds a card without paying; returns its address. */
  createCardSetup?(input: { userId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Ends a subscription at once. Throws when the provider refuses. */
  cancelMembership?(membershipId: string, opts?: { atPeriodEnd?: boolean }): Promise<void>;
}
