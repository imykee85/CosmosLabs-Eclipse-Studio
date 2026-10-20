# Eclipse Studios: billing setup, implementation feedback

This document replies to the Whop setup guide for Eclipse Studios (company `biz_rhkNGepOfGhZ5X`, product `prod_zts2nbHmnIhiM`). It covers what the app does today, where it differs from the guide, and what still needs confirming against a live Whop account.

## 1. What is implemented

### Plans in use
The app maps each Whop plan to its own plan id through server settings:

| Our id | Whop plan | Price | Credits |
|---|---|---|---|
| starter | plan_vFqySKucLzvbe | $19 / 30 days | 1,000 |
| growth | plan_Hd0BVcD20OW39 | $49 / 30 days | 5,000 |
| scale | plan_ZVq31waL9IOVd | $199 / 30 days | 25,000 |
| topup_500 | plan_MIoFWHFK6j6Nu | $10 one-time | 500 |
| topup_2000 | plan_xdlHY7qEINEHI | $34 one-time | 2,000 |
| topup_6000 | plan_PJJmqo66gyjoa | $84 one-time | 6,000 |

The credit amounts are kept in our own code (`src/lib/plans.ts`) and must match the plans' `metadata.credits` in Whop.

### Checkout (guide step 1)
- `POST /checkout_configurations` is called from our server only. The API key never reaches the browser.
- For a fixed plan we send `plan_id`, `company_id`, `redirect_url`, and `metadata: { userId, planId }`. Our key is `userId`, where the guide uses `app_user_id`. Incoming events accept either key.
- Fixed plans return to `https://eclipse.cosmoslabsai.com/settings?tab=billing&paid=1`.
- We use our own login (Clerk), not "Sign in with Whop".

### Webhook (guide steps 2 and 3)
- **URL:** `https://eclipse.cosmoslabsai.com/api/payments/webhook`. The guide suggested `/api/webhooks/whop`, but ours is the address to register.
- **Signature:** checked the Standard Webhooks way (headers `webhook-id`, `webhook-timestamp`, `webhook-signature`, HMAC-SHA256, 5-minute tolerance). The `ws_...` secret is used as the key exactly as given. A delivery that fails verification is rejected with 401, and nothing is granted.
- **Events handled:**
  - `payment.succeeded`: grants the credits for that plan or pack. It is idempotent on `payment.id`, so a repeated delivery adds nothing. The plan is read from `metadata.planId`. If that is missing, which can happen on a renewal, we read `data.plan.id` and map it back to our plan id.
  - **The person is found** from `metadata.userId`. If that is missing on a renewal, we use the membership id we saved from their first plan payment. If neither identifies anyone, we answer 422 so Whop retries, and nothing is granted.
  - `membership.deactivated`: marks the subscription as ended at once and switches auto top-up off. A later plan payment makes the subscription active again.
  - `refund.created`: takes back the credits the refunded payment granted, once per refund id. It never takes a balance below zero, so credits already spent are not clawed back.
- **Saved references:** on a payment we store the member id and payment method id. The membership id is stored only for subscription payments, never for a top-up's own membership.

### Top-ups (guide step 4)
- **Only for subscribers:** on the server, a top-up checkout is refused (403) unless the account has an active subscription. A subscription counts as active if a plan payment arrived in the last 33 days and no `membership.deactivated` came after it.
- **Locked when the plan lapses:** top-up credits are never removed. If the subscription ends, they are kept but cannot be spent until the person subscribes again.
- **Spending order:** plan credits are spent first and top-up credits last.

### Custom-amount top-up (guide step 5)
- **The checkout** carries an inline plan:
  `{ initial_price, currency: "usd", plan_type: "one_time", visibility: "hidden", product_id: "prod_zts2nbHmnIhiM", title: "Top-up N credits", metadata: { credits, type: "topup" } }`
  plus `metadata: { userId, planId: "topup_custom", credits }`.
- **The price is worked out on our server** and never taken from the browser. It follows a straight line through the three packs, so a custom amount never costs less per credit than a bigger pack. Below 500 credits it uses the 500-pack rate.
- **Range:** at least $9 (450 credits), at most 6,000 credits.
- **When the webhook arrives,** the credit count is checked against that range again before anything is granted.

### Auto top-up
- **What it does:** the person picks an amount (a pack or a custom number) and switches it on. Subscribers only.
- **When it charges:** when their usable credits drop below 250, we charge the saved payment method without them present. Limits: one attempt every 2 minutes, at most 3 a day, and at most the person's monthly limit.
- **The request:** `POST /payments` with `member_id`, `payment_method_id`, an inline one-time plan (same shape as above), the metadata, and an `Idempotency-Key` header.
- **If the card is declined,** auto top-up switches itself off and tells the person why.

### Saved cards
- **Listing:** `GET /payment_methods?member_id=`.
- **Removing:** `DELETE /payment_methods/{id}`. The last saved card cannot be removed.
- **Adding a card without a purchase:** a checkout configuration with `mode: "setup"`, confirmed by a `setup_intent.succeeded` webhook that saves the references and grants nothing.

### Account deletion
If an account is deleted, its subscription is cancelled with `POST /memberships/{id}/cancel` and `cancellation_mode: "immediate"`. Then all of the person's data and files are removed.

## 2. Decisions taken
- **Credits roll over.** They do not reset each cycle.
- **Custom pricing** follows the pack line rather than a flat rate per credit. The minimum is $9, not $5.
- **Tax** is added by Whop at checkout. Our prices are before tax.

## 3. Please confirm (not yet tested against a live Whop account)
1. **Signing:** is the `ws_...` secret used as-is as the HMAC key? This is the same as `unwrapWebhook` with that secret. Or should it be base64-decoded first?
2. **Renewals:** does a renewal's `payment.succeeded` carry the original checkout `metadata`? If not, are `data.plan.id` and `data.membership.id` present as described?
3. **Field names** for each event:
   - `payment.succeeded`: `data.member` / `member_id`, `data.payment_method` / `payment_method_id`, `data.membership` / `membership_id`.
   - `membership.deactivated`: `data.id` = the membership id.
   - `refund.created`: `data.id`, and `data.payment.id` or `data.payment_id`. Is a partial refund amount included, and under which field?
4. **Inline plans:** does `checkout_configurations` accept the inline plan shape above (with `product_id`, `visibility`, `title`, `metadata`)?
5. **Charging a saved card off-session:** is the right call `POST /payments` with `member_id`, `payment_method_id` and an inline one-time plan? What does a successful response return: `id`, and `status` `paid` or `processing`?
6. **Saved cards:** are `GET /payment_methods?member_id=`, `DELETE /payment_methods/{id}`, checkout `mode: "setup"` and the `setup_intent.succeeded` event correct?
7. **Cancelling:** is `POST /memberships/{id}/cancel` with `cancellation_mode: "immediate"` correct?
8. **API base:** we call `https://api.whop.com/api/v1` with `Authorization: Bearer <API key>`. Is that right?

## 4. Live test plan
1. Buy Starter with a test payment. Expect 1,000 credits, the subscription active, and top-ups unlocked.
2. Buy the 500-credit pack. Expect +500 credits.
3. Buy a custom amount, for example 1,000 credits for $18.
4. Refund the pack. Expect 500 credits taken back.
5. Cancel the subscription. On `membership.deactivated`, expect top-up credits to lock and auto top-up to switch off.
6. Wait for or trigger a renewal. Expect +1,000 credits even if the metadata is missing.
