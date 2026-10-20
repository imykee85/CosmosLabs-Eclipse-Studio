# Whop price updates (2026-10-20)

## OLD (what Whop has now)

### Subscription plans (monthly)
- Starter: $19 per month
- Growth: $49 per month
- Scale: $199 per month

### Top-up packs (hidden, one-time)
- 50 credits: $10 (Vercel Config `WHOP_PLAN_TOPUP_500`)
- 200 credits: $34 (Vercel Config `WHOP_PLAN_TOPUP_2000`)
- 600 credits: $84 (Vercel Config `WHOP_PLAN_TOPUP_6000`)

## NEW (change Whop to this)

### Subscription plans (monthly): prices do NOT change
- Starter: $19 per month. Credits in the app: 200 per month
- Growth: $49 per month. Credits in the app: 600 per month
- Scale: $199 per month. Credits in the app: 2,500 per month
- Credit amounts are set in the app, not in Whop. Only update the plan description if you mention credits there.

### Top-up packs (hidden, one-time)
- 50 credits: $6 (edit the existing plan; id stays in `WHOP_PLAN_TOPUP_500`)
- 200 credits: $22 (edit the existing plan; id stays in `WHOP_PLAN_TOPUP_2000`)
- 600 credits: $60 (edit the existing plan; id stays in `WHOP_PLAN_TOPUP_6000`)
- 1,000 credits: $100 (NEW hidden one-time plan; put its plan id in a new Vercel Config value `WHOP_PLAN_TOPUP_10000`, Production and Preview, then redeploy once)

## Rules
- A pack's price in Whop must match the app exactly.
- "Your amount" (custom top-up) needs nothing in Whop: it sends its own one-time price, from $9 up to $100.
- Config values are not secrets. Set them for Production and Preview.
