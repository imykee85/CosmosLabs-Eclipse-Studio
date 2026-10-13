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
