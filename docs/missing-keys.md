# Missing keys and settings (updated 2026-10-17)

Add each one in Vercel (Project Settings, Environment Variables) for **Production and Preview**; save secrets with Sensitive on. Redeploy once after the last key. Never paste a key in chat, and crop keys out of screenshots.

| Name | Type | Where to get it | Unlocks |
|---|---|---|---|
| `DASHSCOPE_API_KEY` | Secret | Alibaba Cloud Model Studio, API Key page, region **Singapore**; check the API host in the key dialog (the app's default is `dashscope-intl.aliyuncs.com`) | Qwen voices |
| `WHOP_API_KEY` | Secret | Whop dashboard, developer API keys | Payments |
| `WHOP_WEBHOOK_SECRET` | Secret | Whop dashboard, webhook signing secret | Crediting plan payments |
| `WHOP_PLAN_STARTER` | Config value | Whop plan id for Starter | Starter checkout |
| `WHOP_PLAN_GROWTH` | Config value | Whop plan id for Growth | Growth checkout |
| `WHOP_PLAN_SCALE` | Config value | Whop plan id for Scale | Scale checkout |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Config value | Your contact address | Contact line on Terms and Privacy |
| `NEXT_PUBLIC_SITE_URL` | Config value | Your site address (the final domain once you have it) | Links and the sharing image |
| `MIRELO_API_KEY` | Secret | Mirelo Studio, API Keys (starts with `sk-`, shown once); buy credits there too | Mirelo sound effects and "Add sound" on videos |

Optional Config values for Mirelo (defaults are in the code): `MIRELO_CREDIT_USD` (USD per Mirelo credit, default 0.001; set it from the price you see in Mirelo Studio), `MIRELO_PRICE_PER_SECOND` (replaces the registry price), `MIRELO_BASE_URL`, `AUDIO_MIRELO_MAX_CONCURRENCY`.
