# Whop price updates (2026-10-20), explained in detail

Read this first: the app now counts credits differently. A credit is a bigger unit than before. That is why some numbers below look strange next to the old ones. Nothing here is a typo.

## Why the credit numbers changed

OLD system (what Whop was told before):
- One credit was worth about $0.008 to the customer. It was a small unit.
- Starter gave 1,000 credits for $19 (about $0.019 per credit).
- Top-up packs gave 500 credits for $10, 2,000 credits for $34 and 6,000 credits for $84.

NEW system (what the app does now):
- One credit is worth $0.10 to the customer. Every credit buys more than before: an ordinary image costs 1 to 6 credits, a short video 5 to 60.
- The new credit counts are therefore about five times smaller. Starter gives 200 credits, not 1,000.
- All of this is set inside the app. Whop never holds credits. Whop only takes the payment, and the app decides how many credits that payment is worth.

So "1,000 credits for $100" is deliberate. It is $0.10 per credit in the NEW unit, the same rate as the 600-credit pack. It must not be compared with the OLD "Starter 1,000 credits for $19", because those were different, smaller credits.

## OLD Whop setup (what exists in Whop today)

Subscription plans (monthly):
- Starter: $19 per month
- Growth: $49 per month
- Scale: $199 per month

Top-up packs (hidden, one-time):
- Pack 1: $10
- Pack 2: $34
- Pack 3: $84

## NEW Whop setup (change Whop to this)

### Subscription plans: the PRICES DO NOT CHANGE
- Starter: $19 per month. The customer now gets 200 credits each month.
- Growth: $49 per month. The customer now gets 600 credits each month.
- Scale: $199 per month. The customer now gets 2,500 credits each month.
- The plan IDs stay exactly as they are. Only change the plan description text if it mentions credits.

### Top-up packs (hidden, one-time plans): CHANGE THESE PRICES
1. 50 credits: change the price from $10 to $6. Keep the same plan.
2. 200 credits: change the price from $34 to $22. Keep the same plan.
3. 600 credits: change the price from $84 to $60. Keep the same plan.
4. 1,000 credits: this is a NEW plan. Create a new hidden, one-time plan at $100.

### Price per credit, in the NEW unit, for comparison
- Starter: 200 credits for $19 is $0.095 per credit
- Growth: 600 credits for $49 is about $0.082 per credit
- Scale: 2,500 credits for $199 is about $0.080 per credit
- 50-credit pack: $6 is $0.12 per credit
- 200-credit pack: $22 is $0.11 per credit
- 600-credit pack: $60 is $0.10 per credit
- 1,000-credit pack: $100 is $0.10 per credit

The packs are deliberately dearer per credit than the plans, so a subscription is always the better deal and top-ups are for emergencies. Top-ups can only be bought and spent while the customer has an active subscription.

## What the app needs to recognise the new plan (the part Whop asked about)

The app does not read the credit amount from Whop. It works like this:
- Each Whop plan ID is saved in the app's settings under a name, for example the 600-credit pack's ID is saved as `WHOP_PLAN_TOPUP_6000`.
- When a payment arrives, the app looks up which setting holds that plan ID. That tells it which pack was bought, and the app grants the credits it has stored for that pack.
- So for the new pack: create the plan in Whop, then the owner saves its plan ID in a new setting called `WHOP_PLAN_TOPUP_10000` (Vercel, Config value, Production and Preview, then one redeploy).
- Whop does NOT need to set any credit amount or metadata on the plan. If you want, you can add `credits: 1000` and `type: topup` in the plan's metadata, but the app will ignore it for the fixed packs.
- Until that setting is saved, a payment for the new plan would not be credited. So create the plan and save the ID before anyone can buy it.

The three existing top-up plans keep their IDs and their settings. Editing their prices needs no change in the app.

## Custom amounts need nothing in Whop

"Your amount" (a custom top-up) does not use a saved plan. The app sends its own one-time price each time, from $9 up to $100 (the same price line as the packs). There is nothing to create in Whop for it.

## Rules that stay the same
- A pack's price in Whop must equal the price in the app, because the app grants the credits for the price it expects.
- Config values are not secrets. Save them for Production and Preview.
- The webhook address and the eight events are unchanged.
