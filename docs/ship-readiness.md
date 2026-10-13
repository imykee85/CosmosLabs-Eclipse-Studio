# Eclipse (Cosmos Labs AI): ship-readiness report

Written 2026-10-13 from a fresh scan of the whole app (commit `93aeaf6` and later).

What was scanned: 33 pages, 36 API routes, 13 database tables, 32 Soon tags across 22 files, about 45 settings the app reads from the environment, the public folder and the dependency audit.

How to read the numbers: all percentages and time estimates are estimates, not measurements. **Built** means the code exists. **Live** means it has been confirmed against the real services (Higgsfield, Anthropic, Clerk, R2, and so on). Most video, Core and agent work is built but has never run live.

**Overall: about 58% built, about 30% verified live.**

- Milestone 1, closed beta (accounts, projects, photo generation, credits by hand): 95% built, 75% live.
- Milestone 2, public launch of photo (payments, pricing, security, domain, legal): 60% built, 25% live.
- Milestone 3, full vision (video, audio, agents, Core, export, API, teams): 40% built, 5% live.

A closed beta (invite-only, credits added by hand) can ship as soon as steps 1 to 6 below are done. A public launch also needs payments, security upgrades, tests and monitoring.

## Fastest path to ship

| Step | What | Who | Time |
|---|---|---|---|
| 1 | Add credit to the Anthropic account. Core, Atlas, Prompts and the upload scan all fail without it. | You | 5 min |
| 2 | Set the remaining Vercel settings: `NEXT_PUBLIC_CONTACT_EMAIL` (Config), `ADMIN_EMAILS` (Config), `CRON_SECRET` (Secret), Clerk production keys (Secrets). Confirm `GEMINI_API_KEY` also has a Preview value. | You | 30 min |
| 3 | Live-test one image and one video, and send me any error text. This is the biggest unknown: the video pipeline has never run against the real service. | You | about 1 h |
| 4 | Turn on credits (`CREDITS_ENABLED=1`, Config), then grant credits by hand at `/admin/credits`. | You | 15 min |
| 5 | Check on your iPhone: Library tiles, video autoplay, Atlas, the Motion panel, the drag order. | You | 30 min |
| 6 | Decide on the dependency advisories. `npm audit` reports 1 critical (`next`) and 6 high (Clerk packages, `js-cookie`, `postcss`) in production dependencies. The fixes are `next` 16 and `@clerk/nextjs` 7, both major upgrades. | You decide, I do the work | 5 min to decide |
| 7 | Public launch only: payments (row 17), security upgrades (row 14), tests and monitoring (row 18). | Both | 3 to 5 days |

## By area, quickest to finish first

| # | Area | Built | Live | What's left to reach 100% | Needs | Time |
|---|---|---|---|---|---|---|
| 1 | **Settings and accounts** | 100% | n/a | Anthropic credit; contact email; admin emails; cron secret; confirm Gemini Preview key; Clerk production instance | You | 30 to 60 min |
| 2 | **Dashboard, projects, Bin, project details** | 92% | 80% | Decide whether to hide or fill the empty home-feed sections (Explore collections, series, "Looks for every style"; "Generate a video" is Soon); iPhone check of the Bin | You decide | 1 h |
| 3 | **Navigation** (sidebar, phone tabs, Create chooser, drawer, avatar menu, notifications bell) | 90% | 60% | iPhone check; the bell panel is empty because nothing produces notifications; Library has no desktop link; Page Zoom below 75% is unhandled | You (iPhone) | 1 to 2 h |
| 4 | **Gallery, Library, Assets, Ingredients, uploads, upload scan** | 88% | 50% | iPhone check of the fixed square tiles, video autoplay and the outline fix; live upload plus scan test; Library Audio tab is Soon | Credit, iPhone | 1 to 3 h |
| 5 | **Legal** (Terms, Privacy) | 85% | 0% | Contact email; lawyer review; cookie banner decision; refund and billing terms once payments exist | Lawyer, you | 1 h mine, days for review |
| 6 | **Onboarding and Tutorial** | 70% | 30% | Replace the test `welcome.mp4`; the 4 tutorial lessons have no video; wire each in | Your videos | 15 min each |
| 7 | **Motion graphics page** (`/motion`) | 95% | 20% | Confirm the videos play on a phone; they stream from an outside host; the rights are yours to confirm | You | 1 h |
| 8 | **Landing page** | 90% | 70% | Example and result tiles are gradient placeholders; placeholder plan prices; confirm mock logos are off in production; meta description still says "images" only; no Open Graph tags, robots or sitemap; no analytics | Real images, real prices | 2 to 4 h |
| 9 | **Image Studio** | 85% | 70% | Live checks: fixed seed (Z-Image Turbo, Soul 2); first renders on Google, OpenAI, Seedream (any that fail get switched off); Eclipse DOP V1 is Soon | Your tests | 3 to 5 h |
| 10 | **Prompts page** | 75% | 0% | Seedance prompter instructions to switch that tab on; live test | Your text, credit | 1 to 2 h |
| 11 | **Credits and owner tool** | 92% | 60% | Flip charging on; grant credits; final prices (video prices are placeholders and high); check the ledger live | Price decisions | 2 to 3 h |
| 12 | **Core** (chat, skills, tools, memory, connectors) | 75% | 5% | Live chat, memory, Telegram and Slack send, picture viewing; every other connector is Soon; the chat does not read the Atlas switch | Credit | 3 to 5 h |
| 13 | **Atlas and Agents page** | 50% | 0% | Live chat test; Atlas cannot see pictures yet; creating your own agents is not built | Credit | 2 h test, 1 to 2 days build |
| 14 | **Security and hardening** | 60% | 10% | Upgrade `next` and Clerk; enforce the content security policy (report-only now); Clerk production domain; Vercel firewall; spend caps; R2 public access off; Preview and Production share a database; no input-schema library; re-run the audit | Upgrades | 1 to 2 days |
| 15 | **Video Studio** | 70% | 0% | Confirm the Higgsfield API address, field names and cancel behaviour; real clip playback including H.264 on iPhone; real prices; job admin page; remove the sidebar and dashboard Soon tags; Cinema Studio director controls | Your tests | 1 to 2 days |
| 16 | **Motion transfer** (Kling Motion Control, Genjutsu) | 70% | 0% | Scene control needs its API field; Genjutsu Style library and restyle need the docs page; "3D scene" | Two docs pages | 0.5 to 1 day |
| 17 | **Payments and billing** | 50% | 0% | Whop account and keys; verify base address, signature and event; wire the Upgrade buttons; Billing shows "Trial" only; final plans | Whop, prices | 1 day |
| 18 | **Quality and monitoring** | 10% | 0% | No automated tests, no CI, no error tracking, no analytics | None | 1 to 2 days |
| 19 | **Canvas** (parked) | 80% | 10% | Live generation check; Polish prompt; Video generator and Character sheet nodes | None | 1 to 2 days |
| 20 | **Image picture tools and Soul ID** | 10% | 0% | Upscale, Remove background, Relight, Change camera; Soul ID training | Higgsfield docs | 3 to 5 days |
| 21 | **Account extras** | 25% | 5% | Portfolio publishing; Certificates; Avatars page (not linked anywhere); Team; API keys and MCP endpoint | None | 1 to 2 weeks |
| 22 | **Treatment** (video step 1) | 15% | 0% | No AI behind it; Brief, Concept, Guide logic; save into the project | None | 3 to 5 days |
| 23 | **Video features not built** | 5% | 0% | Genjutsu object swap and restyle; Seedance 2.5 edit and extend; Kling O3 and Omni; multi-shot and elements; reference audio; uploading a clip from the device (needs a video scan) | None | 4 to 7 days |
| 24 | **Core publishing** (TikTok, Instagram, YouTube, X, Drive, Gmail) | 5% | 0% | An app registration and sign-in for each service | App approvals | 2 to 4 days each |
| 25 | **Audio** (Voiceover, Music, Sound effects) | 5% | 0% | Choose a provider; pages; pipeline; Library tab | Provider choice | 1 to 2 weeks |
| 26 | **Export** (joining clips) | 0% | 0% | Timeline screen; hosted renderer or ffmpeg worker | Renderer choice | 1 to 2 weeks |
| 27 | **Later** (Tavus live agent, translation, Avatars product) | 0% | 0% | After milestone 3 | None | n/a |

## Coverage check: nothing left out

- **Pages (33):**
  - Landing, sign-in, sign-up, SSO callback: rows 6 and 8.
  - Terms and Privacy: row 5.
  - Dashboard and onboarding: rows 2 and 6.
  - Tutorial: row 6.
  - Project chooser, Image Studio, Gallery, Library, Assets, Ingredients: rows 3, 4 and 9.
  - Prompts: row 10.
  - Video Studio: rows 15 and 16.
  - Treatment: row 22.
  - Canvas: row 19.
  - Agents: row 13.
  - Core, Connectors, History, Memory, Skills, Tools: row 12.
  - Motion graphics (`/motion`, `/motion/[id]`): row 7.
  - Settings, Portfolio, Certificates, Avatars: row 21.
  - Admin credits: row 11.
- **API routes (36):**
  - Generation, models, uploads, files and shares: rows 4 and 9.
  - Video and video config: rows 15 and 16.
  - Credits, admin credits, billing checkout, payments webhook: rows 11 and 17.
  - Agent chat: row 13.
  - Connect chat, chats, connectors, memory, user skills: row 12.
  - Prompts chat: row 10.
  - Projects and canvases: rows 2 and 19.
  - Onboarding: row 6.
  - Cron: row 4.
- **Database tables (13):** Generation, Onboarding, Project, CanvasState (legacy, read once and dropped), Canvas, CreditLedger, ConnectChat, ConnectMessage, Memory, UserSkill, ConnectorLink, Upload, UsageEvent.
- **Also checked:**
  - No automated tests and no CI.
  - No error tracking and no analytics.
  - No Open Graph tags, robots or sitemap.
  - The cron runs once a day (the free Vercel plan allows nothing more frequent).
  - The Vercel free team is near its Deployment Storage limit, so pushes are batched.

## Soon-tagged features, in one place

Image tools (Upscale, Remove background, Relight, Change camera); Scene control; Genjutsu Style; "3D scene"; the video models not yet connected; Treatment, Export and the audio rows in the sidebar; Library Audio tab; Settings Team and API/MCP; billing Upgrade buttons; Portfolio Publish and Copy link; Certificates; every Connector except Telegram and Slack; the Atlas card on the Agents page; Canvas Polish prompt and its Video generator and Character sheet tiles; the dashboard "Generate a video" tool and its empty sections; Memory import from Claude, ChatGPT, Gemini, Perplexity and Meta AI; Tutorial Watch buttons with no video.

## What only you can do

Anthropic credit; the Vercel settings; the live tests; Whop; the domain and Clerk production keys; the example images; the tutorial and onboarding videos; the lawyer review; the two Higgsfield docs pages (Kling Motion Control request page, Genjutsu Restyle page and how its looks are listed); the Seedance prompter instructions; rights to the hero clip and the motion-graphics videos.

## Where I can start without anything from you

- **Row 14:** the `next` and Clerk upgrades.
- **Row 18:** error tracking and smoke tests.
- **Row 8:** meta description, Open Graph tags, robots and sitemap.
- **Rows 2 and 3:** hide the empty dashboard sections and the empty bell panel.
