# Master list: everything still open (owner 2026-11-04: "every single list, even stuff parked for later")

Only OPEN items. Done items live in CLAUDE.md. Before listing anything as open, check CLAUDE.md for a DONE note, and for anything about the homepage or dashboard LOOK AT THE RENDERED PAGE (Playwright screenshot of the local server), never judge it from the code (2026-11-04: I wrongly called homepage cards and a wall slot empty from reading code; the rendered page had every one filled).

## High priority (risk if not done)
| # | Item | Who |
|---|---|---|
| 1 | Save a Slack or Discord channel webhook as the Secret `OPS_ALERT_WEBHOOK_URL` in Vercel (alerts stay silent without it) | Owner |
| 4 | Watch the first real monthly Whop renewal in Payment events on the Production health page (renewal field names never seen live) | Owner, then me |
| 6 | Watch free-trial signups against real accounts (each free trial costs real provider money) | Owner and me |
| 7 | Ghana registrations (business and Data Protection Commission): owner has none; ask the lawyer if needed | Owner |
| 8 | Academy tutorial videos: the 3 lessons in `src/lib/tutorial.ts` have no video so Watch does nothing; 4 courses are tagged Soon (offered: hide Watch on lessons without a video) | Owner |
| 9 | Press "Translate every language" in `/admin/translations` (owner's last step) | Owner |

## Not urgent
| # | Item | Who |
|---|---|---|
| 10 | Turn on versioning for the R2 bucket | Owner |
| 12 | Host for the Eclone media worker plus Secrets `MEDIA_WORKER_URL` and `MEDIA_WORKER_SECRET`; then wire the checker, finish step, clips over 30 s and target-frame generation | Owner, then me |
| 13 | Live test with a Growth-plan account (premium prompt lock) | Owner |
| 14 | Live checks of built-but-unverified features: Atlas panel, Atlas plans, Core send card (Telegram/Slack), Canvas runs, Soul ID, Seedance edit/extend, Kling multi-shot, reference sounds, newer connectors | Owner |
| 15 | Higgsfield request pages and prices: Kling O3/Omni, Genjutsu restyle and object swap, Motion scene control, 3D scene, Seedance 1.5 Pro, Cinema Studio 3.0, FLUX 3 Video | Owner, then me |
| 16 | Voice request pages: Qwen instruct, Qwen and Seed voice cloning, Seed transcription | Owner, then me |
| 17 | Keys: `DASHSCOPE_API_KEY`, `XAI_API_KEY`, `MIRELO_API_KEY` (plus Mirelo prices), `ROUTE_*=direct` values | Owner |
| 18 | BytePlus Seedance: activate resource pack, live draft test; then UI for draft and the 2.0 edit model, asset ids, `.mov` output | Owner, then me |
| 19 | Core connectors (V2): register apps with TikTok, Instagram, YouTube, Google, Microsoft, Dropbox, HubSpot, Salesforce, Supabase, Vimeo, Frame.io, then build the connect flow | Owner and me |
| 20 | Eclipse DOP V1 plus keys for Flux, Mystic, Luma, Runway, Krea, Microsoft (V2) | Owner |
| 21 | Atlas Agent upgrades (Core's tools and memory for Atlas, approval-based generation) | Me |
| 22 | Model renaming ("Eclipse Vizo"): trademark search and lawyer look at Privacy wording first | Owner, then me |
| 23 | Guard against assistants leaking how they work (canary phrases, logging, Terms clause) | Me |
| 24 | Eclipse as a Claude connector: need Vercel logs for `/oauth/token`, `/oauth/register`, `/api/oauth/approve`, `/api/mcp` to resume | Owner, then me |
| 25 | Annual plan (new Whop plan) and a decision on Scale credits (1,700 would fix price per credit) | Owner |
| 26 | "Automated workflows" on the Scale card (Soon, nothing built) and the four Soon Academy courses | Me |
| 27 | A learned segmentation model for Click select in the image editor (needs a provider) | Owner, then me |
| 28 | Sign-up tour for new users | Me |
| 29 | Fully branded media: media domain, removing "Secured by Clerk" (paid setting), Whop's checkout page | Owner |
| 30 | Team gaps: lower a team's member limit when its plan lapses, delete a team's data when the team is deleted, team-level Core/certificates/portfolio | Me |
| 31 | Kling 4: Prompts tab says Kling 4 UGC but Video Studio only has Kling 3.0, 2.6 and 2.5 | Owner, then me |
| 32 | Small gaps: audio uploads not scanned, iPhone HEVC `.mov` may not play, old `.doc`/Excel/PowerPoint chat files unreadable, 3 failing `byteplus-video` integration tests (assume the Seedance backup is off), unlinked `/export` and `/avatars` pages, Tavus live agent (later) | Me |

## Added 2026-11-04 from the attacker review (open, owner)
| # | Item | Who |
|---|---|---|
| 33 | Vercel Firewall: rate-limit by address and know where Attack Challenge Mode is (CPU-exhaustion flood protection; every page renders per request because of the nonce security policy) | Owner |
| 34 | Clerk: block email subaddresses (name+1@) and disposable email domains (free-trial farming) | Owner |
| 35 | Two-step on the Google or email account you use to sign in as admin (admin is "verified email equals ADMIN_EMAILS") | Owner |
| 36 | Set a separate Secret `CONNECT_SECRET_KEY` in Vercel (today the Clerk key also encrypts connector logins and signs share links; changing either later breaks saved connectors and share links) | Owner |
