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
| `SANDBOX_PROVIDER` | Config value | Type `vercel` (no key: Vercel signs the app in to its own Sandbox service) | The sandbox platform: Download video with sound, Core mini tools and build sessions |
| `SANDBOX_MUX` | Config value | Type `on`, only after the smoke test on /admin/sandbox has passed | The "Download video with sound" button |
| `MIRELO_API_KEY` | Secret | Mirelo Studio, API Keys (starts with `sk-`, shown once); buy credits there too | Mirelo sound effects and "Add sound" on videos |

Optional Config values for Mirelo (defaults are in the code): `MIRELO_CREDIT_USD` (USD per Mirelo credit, default 0.001; set it from the price you see in Mirelo Studio), `MIRELO_PRICE_PER_SECOND` (replaces the registry price), `MIRELO_BASE_URL`, `AUDIO_MIRELO_MAX_CONCURRENCY`.

Sandbox platform, optional Config values (defaults are in the code; all prices PROVISIONAL): `SANDBOX_KILL_SWITCH=1` (stop all new jobs), `SANDBOX_MAX_CONCURRENT` (8), `SANDBOX_JOBS_PER_DAY` (30 per person), `SANDBOX_REQUIRE_PAID` (`off` only for your own tests), `SANDBOX_CREDITS_MUX` (5), `SANDBOX_CREDITS_TOOL_RUN` (5), `SANDBOX_CREDITS_BUILD_5MIN` (10), `SANDBOX_REGION` (iad1), `SANDBOX_BASE_IMAGE`, and the allowance numbers `SANDBOX_ALLOW_CPU_HOURS` (5), `SANDBOX_ALLOW_GB_HOURS` (420), `SANDBOX_ALLOW_CREATIONS` (5000), `SANDBOX_ALLOW_TRANSFER_GB` (20). `SANDBOX_BASE_SNAPSHOT_ID` and `SANDBOX_CHROME_PATH` are NOT needed: /admin/sandbox stores them itself (set them only to override). Do NOT add `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID` or `VERCEL_TOKEN` unless the smoke test reports that Vercel's own sign-in (OIDC) failed.

Core and Atlas message pricing, optional Config values (PROVISIONAL; only with `CREDITS_ENABLED=1`): `CHAT_CREDIT_USD` (0.008, dollars per credit), `CHAT_MARGIN` (1.25), `CHAT_MIN_CREDITS` (1 per reply), `CHAT_START_CREDITS` (5 free credits needed to send a message).
