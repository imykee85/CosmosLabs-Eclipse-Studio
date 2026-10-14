# Operations: settings, owner tools, launch checklist

Where each setting lives: **Secret** = Vercel Environment Variables, marked Sensitive. **Config** = plain Vercel environment variable. Keys are never pasted in chat.

## Settings the app reads

| Name | Kind | Needed for | Notes |
|---|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Secret | Everything stored | Neon pooled string and direct string; the build applies the schema (look for `db-push: applying`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Config | Sign-in | Production instance key for launch |
| `CLERK_SECRET_KEY` | Secret | Sign-in | |
| `HIGGSFIELD_API_KEY` | Secret | Image and video | Set a spending cap |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Secret | File storage | Bucket private, public access off |
| `ANTHROPIC_API_KEY` | Secret | Core, Atlas, Prompts, upload scan | Account needs credit |
| `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ARK_API_KEY` | Secret | Google, GPT, Seedream models | Models hide while the key is missing |
| `ARK_MODEL_SEEDREAM_*` | Config | Seedream | Ids from the BytePlus console |
| `CRON_SECRET` | Secret | Daily finish-renders job | 503 without it |
| `ADMIN_EMAILS` | Config | `/admin/credits`, `/admin/jobs` | Comma-separated, verified Clerk addresses |
| `CREDITS_ENABLED` | Config | Charging | Set to `1` after granting credits |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Config | Terms, Privacy | |
| `NEXT_PUBLIC_SITE_URL` | Config | Links, sitemap, sharing image | Defaults to the Vercel address |
| `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET` | Secret | Payments | |
| `WHOP_COMPANY_ID`, `WHOP_PLAN_STARTER`, `WHOP_PLAN_GROWTH`, `WHOP_PLAN_SCALE` | Config | Payments | |
| `VIDEO_KILL_SWITCH` | Config | Stops new video renders | |
| `VIDEO_RENDERS_PER_MINUTE`, `VIDEO_RENDERS_PER_DAY`, `VIDEO_MAX_RUNNING`, `VIDEO_DAILY_CREDITS`, `VIDEO_CONFIRM_CREDITS` | Config | Video limits | Defaults 6, 30, 3, 2000, 300 |
| `RENDERS_PER_MINUTE`, `AGENT_DAILY_MESSAGES`, `CONNECT_DAILY_MESSAGES`, `AGENT_VIDEO_DAILY` | Config | Limits | Defaults 20, 200, 100, 20 (video watches per day) |
| `UPLOAD_SCAN`, `UPLOAD_SCAN_ON_ERROR` | Config | Upload check | `off` disables; `allow` lets uploads pass when the checker is down |
| `CONNECT_SECRET_KEY` | Secret | Encrypts connector credentials | Falls back to the Clerk secret |

## Owner tools

- `/admin/credits`: add credits to an account by e-mail.
- `/admin/health`: one report (tables created, settings set or missing, Anthropic key and credit, failed renders) with a Copy report button; no keys or secrets in it. Open it after every deploy instead of reading Vercel logs.
- `/admin/jobs`: the 100 most recent renders and videos with status, error text, held credits and length. Use it first when someone reports a stuck or failed render.

## Launch checklist

1. Anthropic credit. 2. Settings above. 3. One live image and one live video. 4. Grant credits, then `CREDITS_ENABLED=1`. 5. iPhone check. 6. Web Analytics switched on in the Vercel project. 7. Clerk production instance and domain; add `clerk.<domain>` to the content security policy and enforce it. 8. Lawyer review of Terms and Privacy. 9. Remove the mock logo strip (see CLAUDE.md).

The Anthropic key was replaced on 2026-10-13 (Secret, Production and Preview); a push is needed for it to reach a new deployment.
Credit was added to the Anthropic and OpenAI accounts on 2026-10-13 (provider side, no setting change needed).

The owner pages are linked from Settings, Billing (shown only to the owner), under the balance.
