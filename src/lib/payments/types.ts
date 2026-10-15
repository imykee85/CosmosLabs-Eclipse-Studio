// The only thing the rest of the app knows about taking payments. A provider (Whop today) implements this; swapping providers
// means writing one new file that satisfies it and changing the one line in ./index.ts.
// Plan ids are OUR ids (see src/lib/plans.ts); an adapter translates them to and from its provider's own ids.

export type CheckoutInput = { userId: string; planId: string; returnUrl: string };

/** A payment that went through. Credits are granted from this, by us, in our own ledger. */
export type PaymentEvent = { provider: string; externalId: string; userId: string; planId: string };

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
}
