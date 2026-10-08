import type { PaymentProvider } from "./types";
import { whop, whopConfigured } from "./whop";

export type { CheckoutInput, PaymentEvent, PaymentProvider } from "./types";
export { InvalidWebhookError } from "./types";

/** The active payment provider, or null while none is set up (previews without payment variables). To switch providers, change only this. */
export function paymentProvider(): PaymentProvider | null {
  return whopConfigured ? whop : null;
}
