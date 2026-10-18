# Dependency advisories (checked 2026-10-13)

`npm audit --omit=dev` after patching to the newest versions inside the current majors (`next` 14.2.35, `@clerk/nextjs` 5.7.6): **1 critical (`next`), 6 high (`@clerk/*`, `js-cookie`, `postcss`)**. Every remaining fix is a MAJOR upgrade (`next` 16.4.0, `@clerk/nextjs` 7.9.14). Nothing left to fix inside the current majors.

## Why the critical `next` entry is mostly not reachable here

`npm audit` lists about 25 advisories under one `next` entry. Checked against this app:

| Advisory group | Applies? | Why |
| --- | --- | --- |
| Image Optimizer (DoS, disk cache growth, AVIF remote code execution, remotePatterns) | No | `images: { unoptimized: true }` in `next.config.mjs`; the optimizer is not used |
| Server Actions (DoS, SSRF, payload size, internal endpoint disclosure) | No | no `"use server"` anywhere in `src` |
| Rewrites (request smuggling, SSRF) | No | no rewrites in `next.config.mjs` |
| Pages Router i18n middleware bypass | No | App Router only, no i18n |
| Custom servers, WebSocket upgrade SSRF, Windows-hosted RCE | No | hosted on Vercel, no custom server |
| React Server Components denial of service and cache poisoning | **Possibly** | App Router is used; Vercel's platform limits some of this, but only the Next 16 upgrade removes the exposure |
| Middleware / proxy redirect cache poisoning | **Possibly** | Clerk middleware is in use; depends on CDN caching of redirects |
| CSP nonce and `beforeInteractive` script XSS | No | no CSP nonces, no `beforeInteractive` scripts |

## Clerk and the rest

- `@clerk/clerk-react`, `@clerk/nextjs`: "authorization bypass when combining organization, billing or reverification checks". Eclipse uses none of those checks (no organizations, no Clerk billing). Not reachable today; becomes relevant if Teams are built on Clerk Organizations.
- `js-cookie` (via Clerk): cookie-attribute injection needs attacker-controlled input to `assign()`; none here.
- `postcss` (via Next, build time): XSS and source-map reads in CSS stringify; only affects processing untrusted CSS at build time. Not reachable.

## What the major upgrade involves (not done: needs the owner's sign-in test)

`next` 16 and React 19; async `params`, `cookies()`, `headers()`; `middleware.ts` becomes `proxy.ts`; `next lint` is removed (use the ESLint CLI); `@clerk/nextjs` 7 changes (`auth()` is async, hooks and components changed). 39 files import Clerk (6 client, 33 server). It cannot be fully verified without a real Clerk sign-in, so it should be done on a branch and tried by the owner before merging.

## Update 2026-10-17
- New packages from the finishing pass were moved to their fixed versions: `sharp` 0.35.5 (libvips, libheif and librsvg advisories fixed; used only to make tile thumbnails and to shrink pictures for the chats) and `mammoth` 1.13.0 (Word briefs, read in the browser). `undici` 7.30.1 is now a direct dependency (the link reader's guarded connection).
- Still listed: `sprintf-js` (DoS with unbounded precision specifiers) through `mammoth` > `argparse`. No fixed version exists. Not reachable: `argparse` is only used by mammoth's command-line tool, which the app never runs; the browser bundle reads .docx files only.
- The `next` 16 / `@clerk/nextjs` 7 upgrade described above is still the only fix for the rest, and it still needs the owner's real sign-in test before it can merge (every merge goes straight to production).

## Update 2026-10-18: Clerk 6 (waiting for the owner's real sign-in test)
`@clerk/nextjs` is 6.39.7 on the preview branch (it supports `next` 14.2.25 or newer and React 18, so no Next or React upgrade was needed for this step). Clerk 6 makes `auth()` and `clerkClient()` async: every call site now awaits them (`workspaceSession()`, `requireUser()` and `audioUser()` are async too), and the middleware uses `await auth.protect()`. Type check, lint, 142 unit tests and the build pass. NOT tested with a real sign-in: it must not merge to `main` until the owner has signed in, signed out, switched workspace and opened a studio page on the preview. The `next` 15/16 step is not started.

## Update 2026-10-18: Next 16 and React 19 (waiting for the owner's real sign-in test)
`next` 16.4.2, `react` and `react-dom` 19.2.3, `eslint` 9 and `eslint-config-next` 16.4.2. `npm audit --omit=dev` went from 1 critical and 6 high to **0 critical, 0 high, 3 moderate** (`mammoth` > `argparse` > `sprintf-js`, not reachable: the command-line tool is never run, see the 2026-10-17 note). What changed in the code: route and page `params` / `searchParams` are Promises (the official codemod converted 38 files); `src/middleware.ts` is now `src/proxy.ts` (same default export and `config`); `experimental.serverComponentsExternalPackages` and the two `outputFileTracing*` keys moved to the top level of `next.config.mjs` (`serverExternalPackages`); `next lint` is gone, `npm run lint` runs ESLint 9 with `eslint.config.mjs` (vendored folders ignored, the new React Compiler checks are WARNINGS: about 147, mostly `set-state-in-effect` and `refs`, to be fixed file by file when touched); `useRef` needs an initial value (one fix); the `[-:T]` in `audio/jobs.ts` became `\D` because Tailwind read it as a class; ffmpeg path calls carry `turbopackIgnore` so the build does not trace the whole project. Verified: build, type check, lint (0 errors), 142 unit tests, 23 browser smoke tests in preview mode. NOT verified: a real Clerk sign-in with Google, a real team, real generations, Atlas video watching (ffmpeg packaging under Turbopack), any route on Vercel itself.
