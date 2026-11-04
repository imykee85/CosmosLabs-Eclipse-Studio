# Master list: EVERYTHING still open, in one place (owner 2026-11-04: "every single list, even stuff parked for later"; it is called the master list because no other list may hold an item that is missing here)

Only OPEN items. Done items live in CLAUDE.md. Before listing anything as open, check CLAUDE.md for a DONE note, and for anything about the homepage or dashboard LOOK AT THE RENDERED PAGE (Playwright screenshot of the local server), never judge it from the code (2026-11-04: I wrongly called homepage cards and a wall slot empty from reading code; the rendered page had every one filled).

## High priority (risk if not done)
| # | Item | Who |
|---|---|---|
| 7 | Ghana registrations (business and Data Protection Commission): owner has none; ask the lawyer if needed | Owner |
| 1 | Save a Slack or Discord channel webhook as the Secret `OPS_ALERT_WEBHOOK_URL` in Vercel (alerts stay silent without it) | Owner |
| 4 | Watch the first real monthly Whop renewal in Payment events on the Production health page (renewal field names never seen live) | Owner, then me |
| 6 | Watch free-trial signups against real accounts (each free trial costs real provider money) | Owner and me |
| 9 | Press "Translate every language" in `/admin/translations` (owner's last step) | Owner |

## Not urgent
| # | Item | Who |
|---|---|---|
| 8 | Academy tutorial videos: the 3 lessons in `src/lib/tutorial.ts` have no video so Watch does nothing; 4 courses are tagged Soon (offered: hide Watch on lessons without a video) | Owner |
| 10 | Turn on versioning for the R2 bucket | Owner |
| 12 | Host for the Eclone media worker plus Secrets `MEDIA_WORKER_URL` and `MEDIA_WORKER_SECRET`; then wire the checker, finish step, clips over 30 s and target-frame generation | Owner, then me |
| 13 | Live test with a Growth-plan account (premium prompt lock) | Owner |
| 14 | Live checks of built-but-unverified features: Atlas panel, Atlas plans, Core send card (Telegram/Slack), Canvas runs, Soul ID, Seedance edit/extend, Kling multi-shot, reference sounds, newer connectors | Owner |
| 15 | Higgsfield request pages and prices: Kling O3/Omni, Genjutsu restyle and object swap, Motion scene control, 3D scene, Seedance 1.5 Pro, Cinema Studio 3.0, FLUX 3 Video | Owner, then me |
| 16 | Voice request pages: Qwen instruct, Qwen and Seed voice cloning, Seed transcription | Owner, then me |
| 17 | Key `DASHSCOPE_API_KEY` (Secret) and, if you want Qwen Image direct, `ROUTE_QWEN_IMAGE_3=direct` and `ROUTE_QWEN_IMAGE_3_EDIT=direct` (Config values) | Owner |
| 18 | BytePlus Seedance: activate resource pack, live draft test; then UI for draft and the 2.0 edit model, asset ids, `.mov` output | Owner, then me |
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
| 36 | Set a separate Secret `CONNECT_SECRET_KEY` in Vercel (today the Clerk key also encrypts connector logins and signs share links; changing either later breaks saved connectors and share links) | Owner |


## Replaced 2026-11-04 (owner: nothing of mine may be left undone; items below needed a decision or a provider, so they are the owner's)
| # | Item | Who |
|---|---|---|
| 19 | Automated workflows on the Scale card (Soon): say what should trigger them and what they should do, then I build it. The four Academy courses need your videos. | Owner |
| 20 | Audio uploads cannot be scanned for content (no scanner exists for audio): choose a provider or accept it. iPhone HEVC `.mov` may not play (a transcode inside the function would time out on big files); old `.doc`, Excel and PowerPoint chat files stay unreadable unless you want a reading library added. | Owner |
| 21 | Atlas Agent: the Library and memory tools (#304) and server-run plans (#308) are built; the rest of the Atlas Agent plan waits for your "Atlas Agent" go. | Owner |

Built and removed from this list on 2026-11-04: the sign-up tour (`FirstTour.tsx`), the leak guard (#304), team seat release when a plan ends and the deleted-team sweep (`team-sweep` cron), removal of the unlinked `/export` and `/avatars` pages, and the failing integration tests.

## Planned upgrades (closed Dependabot PRs, 2026-11-04)
| # | Item | Who |
|---|---|---|
| 38 | Major upgrades closed as too risky for an automatic bump: Prisma 5 to 7 (#225), Anthropic SDK 0.132 to 1.3 (#227), Tailwind 3 to 4 (#228). Each needs a planned upgrade with testing; do only when the owner says | Me, on the owner's go |


## After launch (V2, from `docs/v2.md`; details live there)
| # | Item | Who |
|---|---|---|
| 39 | Core connectors: the OAuth connect flow and app registrations (TikTok, Instagram, YouTube, Google, Microsoft, Dropbox, HubSpot, Salesforce, Supabase, Vimeo, Frame.io) | Owner, then me |
| 40 | "Eclipse DOP V1" and the keys for the image makers still marked Soon (Flux, Mystic, Luma, Runway, Krea, Microsoft) | Owner, then me |
| 41 | Audio Studio Qwen and Seed voices (hidden for launch): the new `qwen-audio-3.x` pages and keys `DASHSCOPE_API_KEY`, `BYTEPLUS_VOICE_API_KEY` | Owner, then me |
| 42 | Video models Kling 3.0 Omni and FLUX 3 Video: request pages and price approval | Owner, then me |
| 43 | Canvas V2 brief (`docs/canvas-v2.md`); parts A to D were built 2026-10-26, the rest waits for the owner's "canvas v2" | Owner, then me |
| 44 | Eclipse as a Claude connector (parked 2026-10-29): needs the Vercel logs for `/oauth/token`, `/oauth/register`, `/api/oauth/approve`, `/api/mcp` | Owner, then me |

## Parked (from `docs/last-hour.md`; details live there)
| # | Item | Who |
|---|---|---|
| 45 | Content: onboarding video, tutorial videos, landing card and results pictures, pictures for the empty dashboard cards | Owner |
| 46 | First Mirelo tests: one sound effect, one Add sound | Owner |
| 47 | BytePlus Seedance: load the balance, then activate and run the live draft test (same as item 18) | Owner |

## Built or half-built, on no earlier list (found 2026-11-04)
| # | Item | Who |
|---|---|---|
| 48 | UI for Seedance draft mode and for the Seedance 2.0 edit model (back end built) | Me, on the owner's go |
| 49 | Eclone: wire the checker, the finish step, clips over 30 s and target-frame generation (needs the media worker host, item 12) | Owner, then me |
| 50 | Team-level Core, certificates and portfolio (never built) | Owner decision |
| 51 | "Eclipse Vizo" renaming of the Seedance entries (parked until the owner raises it) | Owner |
