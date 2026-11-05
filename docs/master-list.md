# Master list: EVERYTHING that stands between Eclipse and 100% done

Owner 2026-11-04: this is the one list. If every row here is completed, the app is done. No other file may hold an open item: `docs/v2.md`, `docs/last-hour.md` and the old checklists only give DETAIL for rows here. Add a new open item HERE first; remove a row only when the owner says it is done (never delete rows to tidy up).

Before listing anything as open, check CLAUDE.md for a DONE note. For anything about the homepage or dashboard LOOK AT THE RENDERED PAGE (Playwright screenshot), never judge it from the code.

Status answers (PVU, FVU, "what's left", "is this the list to 100%") are built from this file: High first, then Not immediately necessary, one numbered table, columns # | Item | Priority | Why it matters.

Completeness basis (2026-11-04 sweep): every "NOT built / NOT tested / NOT verified / parked / V2" statement in CLAUDE.md, `docs/v2.md`, `docs/last-hour.md`, `docs/ship-readiness.md`, `docs/pages-needed-from-owner.md`, `docs/missing-keys.md`, `docs/connect-launch-checklist.md` and every Soon tag in the source. Anything unknown only shows up in live use, which is why section B exists.

## A. Owner actions: keys, accounts, settings, content
| # | Item | Priority | Why it matters | Who |
|---|---|---|---|---|
| 1 | Save a Slack or Discord channel webhook as the Secret `OPS_ALERT_WEBHOOK_URL` in Vercel | High | Failure alerts stay silent without it. | Owner |
| 2 | Set a separate Secret `CONNECT_SECRET_KEY` in Vercel | High | Today the Clerk key also encrypts connector logins and signs share links. Changing it later breaks both. | Owner |
| 3 | Open Production `/admin/health` after the next deploy: confirm the table list (newer tables `chat_states`, `pending_sends`, `canvas_*`, `oauth_*`, `agent_plans`), the settings (`CRON_SECRET`, Web Analytics switched on in Vercel) and the page-security line | High | The only way to see that the newest schema and settings really reached Production; I cannot read Vercel. | Owner |
| 4 | Watch the first real monthly Whop renewal in Payment events on the Production health page | High | The renewal field names have never been seen live, so credits might not be granted. | Owner, then me |
| 5 | Watch free-trial signups against real accounts | High | Free trials cost real provider money, and a farm would drain it. | Owner and me |
| 6 | Ghana registrations (business and Data Protection Commission) | High | A legal exposure. Ask your lawyer whether you need them. | Owner |
| 7 | Press "Translate every language" in `/admin/translations` | High | New wording stays English until you do. It is your last step. | Owner |
| 8 | Confirm you have permission to show the Motion graphics videos and prompts (third-party host `media.prompt-motion.com`, can disappear) | Not immediately necessary | The files are not ours; permission from the creators is your responsibility. | Owner |
| 9 | Academy tutorial videos for the 3 lessons (the 4 courses stay Soon) | Not immediately necessary | Watch does nothing today. | Owner |
| 10 | Content: onboarding video, landing card and results pictures, pictures for the empty dashboard cards | Not immediately necessary | Parked by you in `docs/last-hour.md`. | Owner |
| 11 | Turn on versioning for the R2 bucket | Not immediately necessary | Lets you recover overwritten or deleted files. | Owner |
| 12 | Host for the Eclipse media worker plus Secrets `MEDIA_WORKER_URL` and `MEDIA_WORKER_SECRET` | Not immediately necessary | Without it the video-edit feature (Eclone) cannot finish. | Owner |
| 13 | Higgsfield request pages and prices: Kling O3/Omni, Genjutsu restyle and object swap, Motion scene control, 3D scene, Seedance 1.5 Pro, Cinema Studio 3.0, FLUX 3 Video | Not immediately necessary | Those models and options can't be built without them; the Style library, Scene control and 3D scene stay Soon. | Owner, then me |
| 14 | Voice request pages: Qwen instruct, Qwen and Seed voice cloning, Seed transcription | Not immediately necessary | Those voice features can't be built without them. | Owner, then me |
| 15 | Key `DASHSCOPE_API_KEY` (Secret) and, for Qwen Image direct, `ROUTE_QWEN_IMAGE_3=direct` and `ROUTE_QWEN_IMAGE_3_EDIT=direct` (Config values) | Not immediately necessary | Qwen voice and the direct Qwen Image route stay off until set. | Owner |
| 16 | BytePlus Seedance: load the balance, activate the resource pack and run the live draft test | Not immediately necessary | The cheaper direct Seedance route is untested live; until then Seedance videos show "having trouble right now" or ask to confirm the higher price. | Owner |
| 17 | First Mirelo tests: one sound effect, one Add sound (key is set) | Not immediately necessary | The Mirelo route has never run against the real service. | Owner |
| 18 | A provider for a learned segmentation model | Not immediately necessary | Click select in the image editor stays a colour wand. | Owner, then me |
| 19 | Fully branded media: a media domain, removing "Secured by Clerk" (a paid setting), Whop's checkout page | Not immediately necessary | Users can still see provider names in places I can't change. | Owner |

## B. Live checks of built features (never run against real accounts or services)
| # | Item | Priority | Why it matters | Who |
|---|---|---|---|---|
| 20 | Atlas panel and Atlas setting the prompt box with the real model: Apply, Apply and generate, `set_prompt_box` picks sensible values, thinking lines, the "agent couldn't answer" error on a picture plus "Json prompt for this" | Not immediately necessary | Built and tested only with mocked routes. | Owner |
| 21 | Atlas knowledge packs against the real model (Seedance director, fashion, ads, cinema, director, story, motion, UGC, JSON): format followed, prompts within each model's limit, `suggest_prompt` fills the box | Not immediately necessary | Added to prompts but never run live; they cost input tokens on every on-topic message. | Owner |
| 22 | Atlas plans (Scale): approve, the hand-over between two Vercel functions, a real Seedance reference video, voiceover and music steps, Stop, closing the app | Not immediately necessary | The server-run plan has only run against fake starts. | Owner |
| 23 | Atlas reading pictures over 3 MB and watching video clips (ffmpeg inside Vercel), and chats saved across two real devices (`chat_states`) | Not immediately necessary | Never run on the live site. | Owner |
| 24 | Core: a real chat (image from chat, memory, view a picture), the send card with Telegram, Slack and the nine newer connectors (Discord, Twilio, SendGrid, WhatsApp, Notion, Linear, Todoist, GitHub, Jira), the video editor and kinetic films in a real sandbox | Not immediately necessary | Only tested against stand-ins. | Owner |
| 25 | Canvas: live runs of every node (Assistant, voice, sound, music, image editor, upscaler, list, video generator, Variations), comments and share link with a real session or team, the shared viewer with real pictures | Not immediately necessary | Only tested with mocked routes. | Owner |
| 26 | Image Studio tools with real models: Upscale, Remove background, Relight, Change camera, Variations, the editor's Retouch (OpenAI mask field shape), thumbnails on real R2, Soul ID training (endpoint and status words), fixed-seed reproduction | Not immediately necessary | Quality and field names unverified against the real services. | Owner |
| 27 | Video Studio: Seedance edit and extend, Kling multi-shot (`multi_prompt` shape), reference sounds, Motion and Genjutsu, an Eclone draft with a source clip, late-video pickup | Not immediately necessary | Field shapes and behaviour unverified against Higgsfield. | Owner |
| 28 | Audio Studio extras: voice clone and design (Fish save step), transcription, music, long MiniMax text | Not immediately necessary | Generation works; these paths have unverified field reads. | Owner |
| 29 | Live test with a Growth-plan account (premium prompt lock) | Not immediately necessary | The lock has only been tested in code. | Owner |
| 30 | Team invitation shown in the bell with a real invitation (Join, switch into the team) | Not immediately necessary | Never tried with a real Clerk invitation. | Owner |
| 31 | Portfolio publishing and Certificates with a real signed-in session (public pages, Print to PDF) | Not immediately necessary | Only browser-tested with mocked routes. | Owner |
| 32 | Fresh-account journey: new Clerk sign-up, welcome pop-up with 2 free images, first-run tour, free renders then the subscribe pop-up | Not immediately necessary | Tested with fakes, not with a brand-new real account. | Owner |
| 33 | After the translation step: real translations in a long language (German, Russian) on a phone: buttons, nav, cards | Not immediately necessary | Translations are longer than English and can break tight layouts. | Owner |

## C. Decisions and builds that wait for the owner's go
| # | Item | Priority | Why it matters | Who |
|---|---|---|---|---|
| 34 | Annual plan (new Whop plan) and a decision on Scale credits (1,700 would fix the price per credit) | Not immediately necessary | Scale currently costs more per credit than Starter. | Owner |
| 35 | Say what Automated workflows should trigger and do (Scale card, Soon, nothing built) | Not immediately necessary | The Scale card promises them. | Owner, then me |
| 36 | Pricing-card redesign (raised centre card) and the 50x smaller "units" display: say which plan to lift and whether you want units | Not immediately necessary | Designed in discussion, never built. | Owner |
| 37 | Decide on audio scanning, iPhone HEVC `.mov` playback, and old `.doc`, Excel, PowerPoint and RTF chat files | Not immediately necessary | Audio uploads can't be checked for content; the other two are edge cases. | Owner |
| 38 | Say "Atlas Agent" for the rest of that plan (Core's tools, approval-gated generation, multi-step plans, Gallery and Canvas reading) | Not immediately necessary | Parked until you say so. | Owner, then me |
| 39 | UI for Seedance draft mode and for the Seedance 2.0 edit model (back end is built), plus asset ids (portrait flow) | Not immediately necessary | The features exist but have no buttons. | Owner, then me |
| 40 | Eclone: wire the checker, the finish step, clips over 30 s and target-frame generation | Not immediately necessary | A full edit cannot finish until these and the worker host are done. | Owner, then me |
| 41 | Team-level Core, certificates and portfolio (today they stay personal); a certificate name editor and server-made PDF | Not immediately necessary | Teams share projects and credits but not these. | Owner decision |
| 42 | Decide on Kling 4 | Not immediately necessary | The Prompts tab says Kling 4 UGC, but Video Studio only has Kling 3.0, 2.6 and 2.5. | Owner |
| 43 | Planned major upgrades: Prisma 5 to 7, Anthropic SDK 1.x, Tailwind 4 | Not immediately necessary | Dependabot's automatic bumps were closed as too risky; each needs a tested upgrade. | Owner's go, then me |
| 44 | Neon and Vercel load: generation-list `select`, Core chat history window, ledger replay caching, static public pages | Not immediately necessary | Cuts database transfer and CPU; riskier changes I have not made. | Owner's go, then me |
| 45 | "Eclipse Vizo" renaming of the Seedance entries (check provider terms, trademark and the Privacy wording first) | Not immediately necessary | Parked until you raise it. | Owner |
| 46 | Offered but never chosen: fold Gallery and Assets into Library, a "My voices" view, keep picture metadata when redrawing, tell the assistants the person's language, right-to-left languages, Tavus live agent | Not immediately necessary | Each was offered and not picked; tell me yes or no. | Owner |

## D. After launch (V2, details in `docs/v2.md`)
| # | Item | Priority | Why it matters | Who |
|---|---|---|---|---|
| 47 | Core connectors: the OAuth flow and app registrations (TikTok, Instagram, YouTube, Google, Microsoft, Dropbox, HubSpot, Salesforce, Supabase, Vimeo, Frame.io) | Not immediately necessary | V2 by your decision; the Connectors chip carries a Soon tag. | Owner, then me |
| 48 | "Eclipse DOP V1" and the keys for the image makers still marked Soon (Flux, Mystic, Luma, Runway, Krea, Microsoft) | Not immediately necessary | V2 by your decision. | Owner, then me |
| 49 | Qwen and Seed voices in Audio Studio (hidden for launch): the `qwen-audio-3.x` pages and keys `DASHSCOPE_API_KEY`, `BYTEPLUS_VOICE_API_KEY` | Not immediately necessary | V2 by your decision. | Owner, then me |
| 50 | Video models Kling 3.0 Omni and FLUX 3 Video: request pages and price approval | Not immediately necessary | V2 by your decision. | Owner, then me |
| 51 | Canvas V2 brief (`docs/canvas-v2.md`): parts A to D were built; the rest waits for your "canvas v2" | Not immediately necessary | V2 by your decision. | Owner, then me |
| 52 | Eclipse as a Claude connector (parked): needs the Vercel logs for `/oauth/token`, `/oauth/register`, `/api/oauth/approve`, `/api/mcp` | Not immediately necessary | Built and merged; the last failure's cause is unknown. | Owner, then me |
| 53 | Design Studio (owner will add later). Parked material: the owner's `anatomy-main.zip` (3D organ viewer, 9 GLB models plus images, about 34 MB; kept by the owner, NOT in the repo). It has no licence or source for its models and pictures, so find out their terms before shipping; keep big assets in storage, not `public/`. Image-to-3D routes to look at when it starts: Higgsfield `generate_3d` (not verified on our API), Scenario `scenario-rodin` / `scenario-sparc3d`, direct makers (Hunyuan3D, Tripo, Meshy) | Not immediately necessary | Your decision: Design Studio comes later; nothing built. | Owner, then me |
| 54 | Timeline editor (Editor chip): check on the preview with a real clip on desktop and a phone (WebGPU/WebGL, export time, Safari); decide whether to serve the 30 MB program from storage or a static host instead of `public/` (it adds about 30 MB to every deployment); Atlas driving the editor through its command API | Not immediately necessary | Built and tested only in headless Chromium; the editor shows its own FilmCraft/ArtCraft name inside it. | Owner, then me |
