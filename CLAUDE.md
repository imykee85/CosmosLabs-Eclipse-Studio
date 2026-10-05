# Eclipse (Cosmos Labs AI) — project notes

AI image/video/audio content-generation web app. Next.js 14 App Router, TypeScript, Tailwind 3 plus hand-written CSS, Clerk v5, Prisma + Postgres, Higgsfield for generation.
Branch: develop only on `claude/new-session-1h84ct` (draft PR #1 into `main`). Vercel project `cosmos-labs-eclipse-studio`, team `ai-labs8`.

## Workflow
- After every push: wait for the Vercel build (PR #1 status via `mcp__github__pull_request_read` `get_status`), then give the user the stable branch preview address `https://cosmos-labs-eclipse-studio-git-claude-new-sessi-86596b-ai-labs8.vercel.app` (same origin on every push, so browser-stored demo projects survive) plus the per-deployment dashboard link, with an honest note of what was and wasn't verified. Per-deployment hash addresses are a new origin each time and start with empty demo storage. The sandbox cannot reach vercel.app, so the stable address is copied from the Vercel bot's PR comment, never fetched.
- Verify before pushing: `npx tsc --noEmit`, `npx next lint`, `next build`, then a Playwright check. Run the local server with Clerk env unset: `env -u NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY -u CLERK_SECRET_KEY npx next start -p 3100`; stop it with `fuser -k 3100/tcp` (never `pkill -f`). Playwright-core is in `/tmp/claude-0/pw`; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with `--no-proxy-server`.
- Measure in a real browser rather than assuming. The user art-directs from screenshots of other products: adapt layout and feel to Eclipse's own theme and wording; never copy another brand's name, copy, pricing or images.

## Design rules (user-specified)
- Accent red `#c00707` (hover `#d90b0b`), white text on red; marketing site and login are pure/charcoal black; font is Inter everywhere (headings 700, body 400, nav and buttons 500).
- App-wide light/dark: `localStorage['eclipse-theme']`, `html[data-app-theme="light"]`, `--a-*` vars in `src/components/app-theme.css`. Marketing site stays dark. Login light mode is linked to onboarding.
- Landing carousel must never stretch at any zoom: `%` widths, `aspect-ratio: 9/16`, no JS or viewport-unit sizing.
- Login and onboarding are vertically centered and never scroll (100dvh, height-based compact media queries); only a very small 320×568 sign-up still scrolls slightly.
- Text boxes have no outline of their own on focus; the field around them keeps its focus ring.
- Back controls on the avatar pages and on login are a bare `<` icon, no text.

## Current state
- **Public site:** landing (header shows logo + "Eclipse Studio"), login/sign-up (logo on the form card above the heading; faint background icons: agent ball, camera, palette), onboarding (multi-select last step; finish plays `public/onboarding/welcome.mp4`, a test clip, then the dashboard).
- **Dashboard:** create-project modal, project cards, search, Bin (soft delete/restore/delete forever), theme toggle, avatar popup.
- **Studio** (`(app)` route group; only reachable with an open, non-deleted project, enforced by `ProjectGate`, else redirect to `/dashboard`): sidebar PHOTO (Create, Gallery, Assets) / AUDIO (Voiceover, Music, Sound effects) / VIDEO (4 steps), with audio and video rows all "Soon"; Ingredients; Agents (`AgentIcon` ball icon); Library (`/library?kind=` All/Characters/Products/Scenes/Images/Videos, empty state). Treatment (`/treatment`, VIDEO step 1; CSS prefix `tr-`, not `st-`, which Settings uses): desktop starting-point screen then Brief/Concept/Guide cards over a chat box with attach/link/mic icons inside it; phone shows Brief/Concept/Guide tabs; no AI behind it yet (send, link, mic disabled; row still tagged Soon). No sparkle icons anywhere (lightbulb for concept/idea). Create page: prompt box plus a spaced Preview panel (matches aspect ratio, spinner, result, earlier thumbnails); real generation unverified.
- **Phone UI** (`WorkspaceShell`, media query `(max-width:800px), (pointer: coarse) and (max-width:1000px)`): top bar, drawer, bottom tabs Home / Create / Library / Settings. Double-tap shortcut menus above the bar: Home lists projects (single tap waits ~320ms before leaving for the dashboard), Library lists its kinds, Create lists the sidebar (PHOTO/AUDIO/VIDEO collapsible, folded unless they hold the open page). The Create tab follows whichever creation feature you are on (Create/Gallery/Assets/Ingredients/Agents), remembered in `localStorage["eclipse-create-slot"]`.
- **Avatar popup** (`UserMenu`; the avatar opens only this): Avatars ("Soon"), Portfolio (draft builder with live preview, saved in the browser; Publish and Copy link disabled until server publishing exists), Certificates (empty state, "Soon"), Settings (Profile/Billing/Team/API-MCP; billing/team/API are shells). These live in the `(account)` route group with `AccountShell` (dashboard-style header, no Studio chrome); their `<` back returns to the last Studio/dashboard page (`src/lib/last-page.ts`, sessionStorage), else the dashboard.
- **Tutorial** `/tutorial?from=<path>`: back button named after, and iconed like, the origin page (Dashboard, Studio, ...); lessons in `src/lib/tutorial.ts` (videos go in `public/tutorial/`, none yet so buttons read "Coming soon").
- **Backend:** `/api/generate` (Higgsfield, `src/lib/higgsfield.ts`, unverified against the live API), onboarding and projects API routes, Prisma models Generation/Onboarding/Project.
- **Demo mode** (no Clerk keys): middleware passes through; login `demo@eclipse.test` / `demo1234`; sign-up accepts any email + 8+ char password. Projects and profile live in browser `localStorage`.

## Key decisions
- Projects persist only per browser and per web address in demo mode. Interim fix is the stable branch preview address above; projects made on older per-deployment addresses are not carried over. Permanent fix is server persistence, already coded, switching on when Clerk keys and `DATABASE_URL` are set (then run `npx prisma db push` once). Not yet configured.
- Library is cross-project saved items; Gallery in the sidebar is per-project renders.

## Next
- Connect Clerk keys and Postgres on Vercel so projects persist per account (new accounts start empty).
- Real onboarding video, tutorial videos, real pricing plans.
- Build the "Soon" features: Assets, audio, video steps, Ingredients saving, Agents, Library saving, Avatars, Certificates, Billing/Upgrade, Team, API/MCP keys, language translation.
- Verify the Higgsfield request shape (`aspect_ratio`) against the live API.
- Open questions: Library has no desktop link now (only the phone tab); the Studio's bottom Settings tab leaves the Studio.
