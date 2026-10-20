import { freeRendersCount, freeUsedUp } from "@/lib/free-renders";
import { hasSubscription, subscriptionRuleOn } from "@/lib/subscription";

// The SUBSCRIPTION ALERT (pricing master brief, section 2): a free account has 2 free image generations and nothing else. When anything else cannot go ahead for
// lack of credits and the account is not subscribed, the person is told to subscribe instead of being shown a credit count; the browser opens the plan picker
// when it sees the code (src/components/SubscribeAlert.tsx). Top-up credits that are saved but locked keep their own wording (`keepText`) and also carry the code.
export const SUBSCRIBE_CODE = "SUBSCRIBE";

export type Refusal = { error: string; code?: string };

/** What to answer when a job is refused for lack of credits. `normal` is the usual sentence with the numbers. */
export async function refusal(userId: string, normal: string, keepText = false): Promise<Refusal> {
  if (!subscriptionRuleOn() || (await hasSubscription(userId))) return { error: normal };
  if (keepText) return { error: normal, code: SUBSCRIBE_CODE };
  const used = await freeUsedUp(userId);
  return { error: used ? `You've used your ${freeRendersCount()} free images. Subscribe to keep creating.` : "Subscribe to keep creating.", code: SUBSCRIBE_CODE };
}
