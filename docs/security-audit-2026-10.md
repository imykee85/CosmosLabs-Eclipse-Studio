# Security audit, October 2026 (Next.js 14 Oct update and Node.js 21 Oct releases)

Audited 2026-10-22 from the repo only (no internet, no Vercel dashboard). Branch `security/oct-2026`.

## Versions found
- next 16.4.2 (fixed line is 16.4.1: already newer), react / react-dom 19.2.3, sharp 0.35.5 (needs 0.35.5 or newer: OK), undici 7.30.1 (via @vercel/sandbox and a direct import).
- App Router only (no `pages/`).
- Node: no `engines`, no `.nvmrc`, no Dockerfile. CI used Node 20 (end of life, no fix). Local sandbox runs 22.22.0 (older than the fixed 22.23.4).

## Findings
| Item | Result | Evidence |
|---|---|---|
| `use cache` RCE (GHSA-673q-mjm6-r5xr) | NOT AFFECTED | no `use cache`, `cacheComponents`, `unstable_cache`, `cacheLife`, `cacheTag` anywhere in `src` or `next.config.mjs`. Next is also already past the fix. |
| Image Optimization SVG RCE (CVE-2026-96889) | NOT AFFECTED | nothing imports `next/image`; `images: { unoptimized: true }` in `next.config.mjs:17`, so `/_next/image` is off. sharp 0.35.5 resolved anyway. |
| Server Actions DoS (GHSA-p3m5-59mp-jv5r) | NOT AFFECTED | zero files with `"use server"`. Next is already past the fix. |
| Brotli decoder (CVE-2026-111497) | UNKNOWN / possibly reachable | `src/lib/fetch-page.ts` fetches pages people paste (Treatment link button) with undici; undici decodes Brotli responses. Provider API calls via `fetch` can also receive Brotli, but those hosts are fixed and trusted. No own zlib/brotli code. Fix = patched Node runtime (Vercel is rolling it for 22.x/24.x; its WAF covers inbound only). |
| TLS hostname bypasses (CVE-2026-105483, -106069, -106072) | LOW | no custom `https.Agent`, `tls.connect` or `rejectUnauthorized`. Fetches go to fixed provider hosts; the one user-supplied URL path (`fetch-page.ts`) rejects IP-literal tricks (standard ports, resolves and re-checks every address, blocks private ranges). Patched Node still wanted. |
| `dns.resolve` NUL truncation (CVE-2026-105482) | NOT AFFECTED | only `dns.lookup` in `fetch-page.ts` (not `resolve`), on names that `new URL` already parsed. |
| Keep-alive response bug (CVE-2026-105481) | NOT AFFECTED by our code | no custom keep-alive agents (only the guarded undici Agent in `fetch-page.ts`). Runtime patch still applies. |
| `randomUUID` / `randomInt` snapshots (CVE-2026-106074) | NOT AFFECTED | 41 uses, none in a startup snapshot or Node SEA (no `--build-snapshot`, no SEA anywhere). |
| Permission Model / ZipFile (CVE-2026-106070/71/73) | NOT AFFECTED | no `--permission`, `--allow-fs-*` or zip libraries. |
| Other self-hosted Node processes | NOT AFFECTED | no Dockerfile or worker in the repo. The sandbox platform runs short Linux sandboxes on Vercel (their own images, not Node services of ours). `child_process` is used only for ffmpeg. |
| `npm audit --omit=dev` | 3 moderate, 0 high/critical | `sprintf-js` / `argparse` through `mammoth` (Word reading). Moderate DoS in a brief reader; fix needs a breaking `mammoth` downgrade: left alone. |
| robots / AI crawlers | WAS PARTIAL, now done | `robots.ts` existed (search engines allowed on public pages only). Added a block for 21 AI crawlers, and `X-Robots-Tag: noindex, nofollow` on app and API paths. User media is served only through short-lived signed storage links or HMAC-signed `/s/<token>` links (bucket private). |

## What I changed
- `package.json`: `engines.node` = `22.x` (was unset).
- `.github/workflows/ci.yml`: Node 20 to 22.
- `src/app/robots.ts`: AI crawlers disallowed everywhere.
- `next.config.mjs`: `X-Robots-Tag: noindex, nofollow` on app routes and `/api`.
- i18n manifest regenerated (the crawler names count as strings).
- No dependency version changes were needed: next, react and sharp were already patched.

## Test results
Type check, lint (0 errors), 211 unit tests, production build and the 27 browser smoke tests all pass locally. Not run: a preview-deployment smoke test (sign-in, image/video generation, Whop webhook, upload) because the sandbox cannot reach Vercel; no PR/preview was opened from here (GitHub tools were disconnected).

## Mike must check
- Vercel, Project, Settings, **Node.js Version** is 22.x or 24.x (not 20.x), then redeploy. (`engines` now asks for 22.x.)
- Vercel, Firewall: blocked requests since 21 Oct; managed rules on; bot / AI-bot protection on.
- Anything else that runs Eclipse code outside Vercel (none known) and its Node version.
- After deploy, confirm the dashboard shows Next.js 16.4.x.
- Live smoke test on the preview: sign-in, one image, one video, a credit entry, a Whop test event, an upload.

## Follow-ups
- `mammoth` advisory (moderate) when a non-breaking fix exists.
- Verdict: **Not affected by the Next.js issues; Node Brotli issue needs the patched runtime from Vercel (check the Node setting). Patched, ready for your approval to merge.**
