# Eclipse (Cosmos Labs AI): what is left, and only what needs you

Written 2026-10-13. Everything that did not depend on you is done and pushed: security patches that are safe, SEO and sharing image, error and 404 pages, analytics hook, 28 unit tests, 10 browser smoke tests and CI, a moderation bypass fix, create-your-own agents, an admin jobs page (`/admin/jobs`) and the settings reference (`docs/ops.md`).

Estimates, not measurements. Quickest first.

| # | What you do | Kind | Time | What it unlocks |
|---|---|---|---|---|
| 1 | Add credit to the Anthropic account | Account | 5 min | Core, Atlas, Prompts, upload scan (the `ANTHROPIC_API_KEY` Secret is already set) |
| 2 | In Vercel, switch on Web Analytics for the project | Setting | 2 min | Visitor numbers |
| 3 | Look in the Vercel build log of this push for `db-push: applying` | Check | 2 min | Confirms the new `user_agents` table exists |
| 4 | Vercel settings: `NEXT_PUBLIC_CONTACT_EMAIL` (Config), `NEXT_PUBLIC_SITE_URL` (Config, your final address), `ADMIN_EMAILS` (Config), `CRON_SECRET` (Secret); confirm `GEMINI_API_KEY` also has a Preview value | Settings | 20 min | Legal pages show a contact, sharing links, owner pages, the daily finishing job |
| 5 | Decide: hide the empty dashboard home-feed sections, or fill them; add a desktop link to Library; Treatment start for the Video card | Decision | 15 min | Removes the "unfinished" look |
| 6 | iPhone check: Library square tiles and video autoplay, no outline, hero video, Atlas, Motion panel, drag order, Agents create dialog | Test | 30 min | Tells me what Safari breaks (I cannot test Safari here) |
| 7 | Live test one image, then one video, then Motion, Core, Atlas, an upload; send me any error text | Test | 1 h | The video pipeline has never run against Higgsfield; fixes come from your error text |
| 8 | Grant yourself credits at `/admin/credits`, then set `CREDITS_ENABLED=1` (Config) | Setting | 15 min | Charging on |
| 9 | Send two Higgsfield docs pages: Kling 3.0 Motion Control request page (for Scene control) and Genjutsu Restyle page with how its looks are listed | Docs | 10 min | Scene control and the Style library |
| 10 | Send the Seedance 2.0 prompter instructions (and knowledge files) | Text | 10 min | Turns on that Prompts tab |
| 11 | Confirm you have the rights to the hero clip and the Motion graphics videos | Decision | 10 min | Safe to publish |
| 12 | Provider billing: OpenAI prepaid credit, Google billing on the key's project, activate each Seedream model in the BytePlus console; run one cheap render each | Accounts | 1 h | GPT, Nano Banana and Seedream models |
| 13 | Replace the test `welcome.mp4`; make the 4 tutorial videos | Your videos | 15 min each to wire | Onboarding and Tutorial |
| 14 | Real example images and real plan prices for the landing page | Assets, decision | 2 to 4 h | Landing page without placeholders |
| 15 | Clerk production instance and your domain; give me `clerk.<domain>` so the content security policy can be enforced | Accounts | half a day | Real sign-ups on your address |
| 16 | Approve the major upgrades `next` 16 and `@clerk/nextjs` 7 (they clear the remaining audit findings; I do the work on a separate branch, you test sign-in on the preview) | Decision plus test | 1 to 2 days | Public-launch security |
| 17 | Whop account, keys, plans; then I verify the adapter and wire the Upgrade buttons | Account | 1 day | Payments |
| 18 | Lawyer review of Terms and Privacy | Third party | days | Legal sign-off |
| 19 | Product decisions: audio provider, export renderer, Treatment AI scope, Portfolio publishing, Teams, API/MCP | Decisions | 1 h to decide | I can build each after |
| 20 | App registrations with TikTok, Instagram, YouTube, X, Google (Drive, Gmail) | Third-party approvals | days each | Core publishing |

Fastest path to a closed beta: rows 1 to 8. Public launch adds rows 14 to 18.

## Not in this list because I cannot do it yet

Image picture tools (Upscale, Remove background, Relight, Change camera) and Soul ID wait on your Higgsfield docs pages or the last stage; Genjutsu, Seedance edit and extend, Kling O3 and Omni wait on rows 9 and 7; audio, export and Treatment wait on row 19. I will start each the moment its row is answered.
