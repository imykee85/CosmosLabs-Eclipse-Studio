# Eclipse (Cosmos Labs AI): only what needs you

Updated 2026-10-13, late evening. Everything that does not depend on you is done. Quickest first. Times are estimates.

Done since the last list (removed): Anthropic key and credit, OpenAI credit, database table check, Core and Atlas live test, GPT models generating.

| # | What you do | Kind | Time | What it unlocks |
|---|---|---|---|---|
| 1 | Open `/admin/health` on the live site (signed in as the owner), tap **Copy report**, paste it to me | Check | 1 min | Shows missing settings and whether the Claude key has credit, in one go. If it says "not available", set `ADMIN_EMAILS` (Config) to your email first |
| 2 | In Atlas tap **New chat**, attach the two pictures, ask for the prompt, and tell me if the **Use this prompt / Generate** buttons appear | Test | 2 min | Confirms the Atlas buttons fix |
| 3 | Run the same GPT 2.5 Flare request again and send me the **new message text** | Test | 2 min | Shows which category OpenAI flagged |
| 4 | Switch on **Web Analytics** in the Vercel project | Setting | 2 min | Visitor numbers |
| 5 | Set in Vercel, if the health report lists them missing: `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAILS` (Config values), `CRON_SECRET` (Secret) | Settings | 20 min | Legal pages show a contact, correct links, owner pages, the daily finishing job |
| 6 | Decide: hide or fill the empty dashboard sections; add a desktop link to Library; Treatment start for the Video card | Decision | 15 min | Removes the unfinished look |
| 7 | iPhone check: Library square tiles and video autoplay, hero video, Motion panel, drag order, Atlas history | Test | 30 min | Shows what Safari breaks (I cannot test Safari here) |
| 8 | Make one **video**, then try **Motion**; send me any error text | Test | 1 h | The video pipeline has never run against Higgsfield: this is the biggest unknown |
| 9 | Grant yourself credits at `/admin/credits`, then set `CREDITS_ENABLED=1` (Config) | Setting | 15 min | Charging on |
| 10 | Send two Higgsfield docs pages: Kling 3.0 Motion Control request page and Genjutsu Restyle page (with how its looks are listed) | Docs | 10 min | Scene control and the Style library |
| 12 | Confirm you have the rights to the hero clip and the Motion graphics videos | Decision | 10 min | Safe to publish |
| 13 | Provider billing: Google billing on the key's project, activate each Seedream model in BytePlus; run one cheap render each | Accounts | 1 h | Nano Banana and Seedream models |
| 14 | Replace the test `welcome.mp4`; make the 4 tutorial videos | Your videos | 15 min each to wire | Onboarding and Tutorial |
| 15 | Real example images and real plan prices | Assets, decision | 2 to 4 h | Landing page without placeholders |
| 16 | Clerk production instance and your domain; give me `clerk.<domain>` | Accounts | half a day | Real sign-ups on your address |
| 17 | Approve the `next` 16 and `@clerk/nextjs` 7 upgrades (I do the work on a separate branch, you test sign-in on the preview) | Decision plus test | 1 to 2 days | Public-launch security |
| 18 | Whop account, keys and plans | Account | 1 day | Payments |
| 19 | Lawyer review of Terms and Privacy | Third party | days | Legal sign-off |
| 20 | Product decisions: audio provider, export renderer, Treatment scope, Portfolio publishing, Teams, API/MCP | Decisions | 1 h | I can build each after |
| 21 | App registrations with TikTok, Instagram, YouTube, X and Google (Drive, Gmail) | Third-party approvals | days each | Core publishing |

Also open, but not yours to fix: GitHub CI shows "No jobs were run". Check the repository's Settings, Actions and the account's billing page when you have a minute; it does not block shipping.

Fastest path to a closed beta: rows 1 to 9. Public launch adds rows 15 to 19.
