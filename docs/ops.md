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
| `RENDERS_PER_MINUTE`, `AGENT_DAILY_MESSAGES`, `CONNECT_DAILY_MESSAGES`, `AGENT_VIDEO_DAILY`, `TREATMENT_DAILY_MESSAGES` | Config | Limits | Defaults 20, 200, 100, 20 (video watches per day), 100 (Treatment planner messages per day) |
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

## Large uploads: R2 CORS rule (needed once)

Pictures over 4 MB (up to 50 MB) and videos (up to 500 MB) are sent from the browser straight to the R2 bucket, so the bucket must allow this site to do that.
Cloudflare dashboard, R2, the `eclipse-media` bucket, Settings, CORS Policy, Add, paste this JSON (add your own domain to `AllowedOrigins` when you have one;
every Vercel preview address is a different origin, so add the ones you use):

```json
[
  {
    "AllowedOrigins": ["https://cosmos-labs-eclipse-studio-git-claude-new-sessi-86596b-ai-labs8.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Without the rule, pictures still upload (the browser redraws them under 4 MB and uses the old path) but videos cannot be uploaded and the message says storage could not be reached.
Keep public access and any r2.dev address OFF.


## Voice Studio (audio)
Secrets (Vercel, Production and Preview), one per provider; each provider's models work as soon as its key is set and redeployed: `ELEVENLABS_API_KEY`, `FISH_API_KEY`, `MINIMAX_API_KEY`, `DASHSCOPE_API_KEY` (Qwen; a Singapore/international key), `BYTEPLUS_VOICE_API_KEY` (Seed Audio; the Seed Speech console key, NOT `ARK_API_KEY`). Config values: base addresses `ELEVENLABS_BASE_URL` (https://api.elevenlabs.io), `FISH_BASE_URL` (https://api.fish.audio), `MINIMAX_BASE_URL` (https://api.minimax.io), `DASHSCOPE_BASE_URL` (https://dashscope-intl.aliyuncs.com; if the Singapore key fails there, try https://dashscope.aliyuncs.com), `BYTEPLUS_VOICE_BASE_URL` (https://voice.ap-southeast-1.bytepluses.com/api/v3); `QWEN_TTS_VOICES` (extra Qwen voice names, comma separated, e.g. `Cherry,Ethan`; only Cherry is confirmed), `SEED_AUDIO_SPEAKERS` (Seed speaker ids from its console as `id:Name,id:Name`; Seed Audio also works with no speaker), `AUDIO_FISH_FREE_ENABLED=0` (hides the free Fish model; it also disappears after 2026-11-30); `AUDIO_KILL_SWITCH=1` (refuses new voices), `AUDIO_JOBS_PER_MINUTE` (10), `AUDIO_JOBS_PER_DAY` (100), `AUDIO_MAX_RUNNING` (3), `AUDIO_<PROVIDER>_MAX_CONCURRENCY` (default 2; PROVIDER = ELEVENLABS, FISH, MINIMAX, QWEN, SEED) and `AUDIO_<PROVIDER>_RPM` (default 0 = none), `AUDIO_MARGIN` (1.25) and `AUDIO_CREDIT_USD` (0.008) for the credit price. Every model shows in the menu; one whose key is missing says so when you press Generate. The table `audio_jobs` is created by the build (`db-push: applying`). Smoke test per provider after its key is set: open Voice Studio, pick that provider's model and a voice, write one short line, Generate once, play and download it; then open `/admin/health` and send me the Voice lines (and the error text if one fails).

### Voice cloning and design (Voice Studio, "New" in the voice strip)
No new keys: it uses the provider keys above. Clone: ElevenLabs (instant clone), Fish Audio (saved voice), MiniMax. Design: ElevenLabs and MiniMax (Fish design is not built: how a designed voice becomes a saved one is unexplained in its reference). A person keeps at most 20 voices; a clone needs the consent box (stored with the time, wording version and a hash of the sample; the recording itself is not kept) and a recording under 4 MB; clones are limited to 5 an hour and 20 a day, designs to 10 an hour and 40 a day. Config values: `AUDIO_CLONE_CREDITS` (default 40) and `AUDIO_DESIGN_CREDITS` (default 60), flat prices charged only after the provider succeeded and only when `CREDITS_ENABLED=1` (provider costs: MiniMax $1.50 per clone at first use and $3 per design; Fish design $0.01; ElevenLabs not stated, so these are provisional). MiniMax deletes a clone not used for 7 days: the voice list warns when 3 days or fewer are left. The table `user_voices` is created by the build (`db-push: applying`). Smoke test: New, Clone (a clean 10 to 30 s MP3 or M4A of your own voice, tick the box), pick it, make one short take; then Design, listen to the previews, keep one; then delete both from the voice sheet and check they are gone at the provider.

