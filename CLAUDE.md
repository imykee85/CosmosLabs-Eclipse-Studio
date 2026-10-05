# Eclipse (Cosmos Labs AI) — project notes

AI image/video content-generation web app. Next.js 14 App Router, TypeScript, Tailwind 3 plus hand-written CSS, Clerk v5, Prisma + Postgres, Higgsfield for generation.
Branch: develop only on `claude/new-session-1h84ct` (draft PR #1 into `main`). Vercel project `cosmos-labs-eclipse-studio`, team `ai-labs8`.

## Workflow
- After every push: wait for the Vercel build (PR #1 status via `mcp__github__pull_request_read` `get_status`), then give the user the new deployment link, with an honest note of what was and wasn't verified.
- Verify before pushing: `npx tsc --noEmit`, `npx next lint`, `next build`, then Playwright check. Run the local server with Clerk env unset: `env -u NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY -u CLERK_SECRET_KEY npx next start -p 3100`; stop it with `fuser -k 3100/tcp` (never `pkill -f`). Playwright-core lives in `/tmp/claude-0/pw`; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with `--no-proxy-server`.
- Measure in a real browser rather than assuming. The user art-directs from screenshots of other products: adapt layout/feel to Eclipse's own theme and wording; never copy another brand's name, copy, pricing or images.

## Design rules (user-specified)
- Accent red `#c00707` (hover `#d90b0b`), white text on red; marketing site and login are pure/charcoal black; font is Inter everywhere (headings 700, body 400, nav and buttons 500).
- App-wide light/dark appearance: `localStorage['eclipse-theme']`, `html[data-app-theme="light"]`, `--a-*` vars in `src/components/app-theme.css`. Marketing site stays dark. Login light mode is linked to onboarding.
- Landing carousel must not stretch at any zoom: `%` widths, `aspect-ratio: 9/16`, no JS or viewport-unit sizing.
- Login and onboarding pages are vertically centered and never scroll (100dvh, compact height media queries).
- Phone UI: separate app-style chrome in `WorkspaceShell` (top bar, bottom tabs Home/Create/Assets/Settings, drawer), switched by media query `(max-width:800px), (pointer: coarse) and (max-width:1000px)`.

## What's built
- Landing page, login/sign-up, onboarding (multi-select last step; finish plays `public/onboarding/welcome.mp4`, a test clip, then goes to dashboard).
- Dashboard: create-project modal, project cards, search, Bin (soft delete/restore/delete forever), theme toggle.
- Account popup (`UserMenu`): the avatar opens only this popup (dashboard/tutorial header, phone top bar, sidebar account row): Library, Avatars, Portfolio, Certificates, Settings. Library (`/library`) is the cross-project store of reusable saved items (empty state for now); Portfolio (`/portfolio`) is a draft builder (details, project picks, photos, live preview; draft saved in the browser; Publish and Copy link are disabled until server publishing exists); Certificates (`/certificates`) is an empty-state page ("Soon"); Avatars is a "Soon" placeholder. The sidebar's Gallery stays per-project renders.
- Workspace `(app)` group: sidebar + project pill, Studio (`/project`), Create, Gallery, Ingredients, Settings (Profile/Billing/Team/API-MCP tabs; billing/team/API are shells), Assets placeholder.
- Tutorial page `/tutorial?from=<path>`: back button is named after the origin page (Dashboard, Studio, Create, ...); falls back to Dashboard. Lessons and videos configured in `src/lib/tutorial.ts` (videos go in `public/tutorial/`; no videos yet, so buttons read "Coming soon").
- Generation API (`/api/generate`, Higgsfield in `src/lib/higgsfield.ts`, unverified against the live API) and onboarding/projects API routes.
- Demo mode: with no Clerk keys, middleware passes through; login `demo@eclipse.test` / `demo1234`, sign-up accepts any email + 8+ char password. Projects and profile live in browser `localStorage`.

## Known issue / key decision
- Projects disappear between logins on Vercel: demo-mode projects are per-browser, per-origin, and each deployment link is a different origin. Real fix is server persistence, which is already coded and switches on when Clerk keys and `DATABASE_URL` are set (then run `npx prisma db push` once). Not yet configured; the user was asked which address they open.

## Next
- Connect Clerk keys and Postgres on Vercel so projects persist per account until deleted (new accounts start empty).
- Real onboarding video, tutorial videos, real pricing plans.
- Soon-labelled features: Assets, video steps, Ingredients saving, Agents, Billing/Upgrade, Team, API/MCP keys, language translation.
- Mobile reference screenshots for dashboard, landing, sign-in and onboarding if the user wants phone-specific designs.
- Verify Higgsfield API request shape (`aspect_ratio`) against the live API.
