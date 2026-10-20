# Eclipse Studios: follow-up after Whop's review

This follows up on `whop-billing-feedback.md` (company `biz_rhkNGepOfGhZ5X`, product `prod_zts2nbHmnIhiM`). Every correction from your review is now live in the app. The questions in section 3 are the ones we still need answered.

## 1. Corrections applied (live since 2026-10-20)

| Your review said | What the app does now |
|---|---|
| Use `unwrapWebhook` from `@whop/sdk/helpers` | Every webhook is verified with `unwrapWebhook` (`@whop/sdk` 2.1.0, pinned), with the `ws_...` secret passed as-is. A delivery that fails verification gets 401 and grants nothing. |
| The company field is `account_id` | Checkout configurations and `POST /payments` send `account_id: "biz_rhkNGepOfGhZ5X"`. `company_id` is no longer sent. |
| Inline plans are supported | Custom-amount top-ups send `plan: { initial_price, currency: "usd", plan_type: "one_time", visibility: "hidden", product_id, title, metadata: { credits, type: "topup" } }`. |
| Cancel with `cancel_at_period_end` | Account deletion calls `POST /memberships/{id}/cancel` with `{ cancel_at_period_end: false }`. `cancellation_mode` was removed. |
| `POST /payments` with `off_session: true`; the response means "created", not "paid" | Automatic top-ups send `off_session: true`. The response only records the payment as pending. **Credits are granted only when `payment.succeeded` arrives.** No second automatic charge is made while one is pending. After 30 minutes without confirmation, the app logs an alert and allows a new attempt. |
| Only charge cards saved with `future_usage=off_session` | Before charging, the app calls `GET /payment_methods?member_id=...&future_usage=off_session`. If the saved card is not in that list, nothing is charged, auto top-up switches off and the customer is told why. |
| `membership.deactivated` is more reliable than a time window | On `membership.deactivated` the subscription ends at once (top-up credits lock, auto top-up switches off). The 33-day window stays only as a fallback. A later plan payment reactivates the subscription. |
| 422 for an unknown customer is fine, but add an alert | It still answers 422 so Whop retries. Every unmatched or failed delivery is also flagged on our owner health page and logged as `PAYMENT ALERT`. |

**Webhook address:** `https://eclipse.cosmoslabsai.com/api/payments/webhook`
**Events subscribed:** `payment.succeeded`, `membership.deactivated`, `refund.created`

## 2. How the unconfirmed items are handled

The app records every verified webhook in a log, with its type, our outcome (applied, duplicate, ignored, unmatched, error) and the payload's **field names and value types only**. No values or personal data are kept. The first real events will show which fields Whop actually sends, and the code will be adjusted to match.

Until then, the app reads each field defensively, in this order:

- **Customer:** `metadata.userId` or `metadata.app_user_id`. If neither is present (expected on renewals), the customer is found from the membership id saved on their first plan payment.
- **Plan:** `metadata.planId`. If that is missing, `data.plan.id` or `data.plan_id` is mapped back to our plan.
- **Member, payment method, membership:** `data.member.id` or `data.member_id`, `data.payment_method.id` or `data.payment_method_id`, `data.membership.id` or `data.membership_id`.
- **Refund:** `data.id` is the refund id. The original payment comes from `data.payment.id` or `data.payment_id`.

## 3. Still open: please confirm

1. **Renewals:** does a renewal's `payment.succeeded` carry the metadata from the original checkout? If not, are `data.membership.id` and `data.plan.id` always present?
2. **Off-session charge result:**
   - Which event tells us an off-session payment **failed**? Is it `payment.failed`, and with which fields?
   - Is the `id` returned by `POST /payments` the same as `data.id` in the later `payment.succeeded`?
3. **Refunds:** we take back the credits only after `refund.created`.
   - Does that event include the refunded amount, and under which field?
   - Or should we always call `GET /refunds/{id}` for the amount?

   For now, any refund takes back the whole grant of that payment. That is wrong for partial refunds, which we would like to handle properly.
4. **Saved cards:**
   - Is `DELETE /payment_methods/{id}` the right call to remove a card?
   - Is `setup_intent.succeeded` the event name for a card saved through a checkout with `mode: "setup"`?
   - If so, where in that event are the member id and the payment method id?
5. **`membership.deactivated`:** is `data.id` the membership id? Does the event fire both when a cancelled membership reaches the end of its period and when renewal payments fail for good?
6. **Webhook secret:** we pass the full `ws_...` string to `unwrapWebhook`. Please confirm that is the intended use, rather than stripping the `ws_` prefix.

## 4. Live test we will run once the keys are set

1. **Buy Starter.** Expect 1,000 credits, the subscription active and top-ups unlocked.
2. **Buy the 500-credit pack.** Expect +500 credits.
3. **Buy a custom amount** of 1,000 credits for $18.
4. **Refund the pack.** Expect 500 credits taken back.
5. **Turn on auto top-up and spend below 250 credits.** Expect one off-session charge, then the credits when `payment.succeeded` arrives.
6. **Cancel the subscription.** On `membership.deactivated`, expect top-up credits to lock and auto top-up to switch off.

We will send you the field log from these events if anything does not match.
