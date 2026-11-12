# Security audit run 4 (2026-11-12): whole-app sweep after the Design Studio, ShotMap, admin dashboard and email work

COVERAGE: the Cloudflare security-audit skill was NOT available in this session (only `seo-audit` is installed) and the built-in `security-review` skill failed on this checkout (no `origin/HEAD`), so this run is manual: three read-only reviewer agents (A new branch code, B every route handler and admin page for authorization, C injection / SSRF / uploads / secrets / headers / crypto) plus my own checks. Nothing was run against live services. Deployed settings (Vercel, Clerk, Whop, R2 and the Firewall) were not visible.

## My own checks (all clean)
- `npm audit --omit=dev`: 0 vulnerabilities. All 9 moderate findings are in build tooling (postcss-selector-parser), not shipped.
- Secret scan of tracked files: nothing (the only matches are test strings and a detector's own patterns). Only `.env.example` is tracked.
- NEXT_PUBLIC variables: only the Clerk publishable key, contact email, site address and the logo flag.
- Raw SQL: every call is a parameterised tagged template; no `Unsafe` variants. `dangerouslySetInnerHTML`: only our four constant, nonced head scripts. `new Function`: only the Motion runtime inside its sandboxed frame.

## No high-severity finding and no cross-user data exposure (151 route handlers read)
Public routes each authenticate themselves (signature, secret, token) or return only what an owner published. Every route filters by the resolved owner id. The Motion frame (`sandbox allow-scripts`, no same-origin, `default-src 'none'`, `connect-src 'none'`) and the Core tool frame were checked and cannot reach cookies, storage or network. The new admin area (two locks, signed httpOnly cookie, constant-time compares, 5 tries per 15 minutes) and the Clerk webhook (signature first) were checked.

## Fixed in this run
1. 3D downloads (`fetchGlb`) followed redirects blindly and trusted `Content-Length`: now `src/lib/provider-download.ts` (https on 443 only, no private-network addresses, every redirect hop checked, body read as a stream that stops at the cap). The same helper now guards the Qwen and Grok picture downloads. The zip size cap trusted the archive's own claim: the unpacked size is checked.
2. Sign-up emails: capped at 20 an hour so a mass sign-up cannot flood the inbox.
3. Hand-over tokens for plans and missions never expired: they now carry a timestamp and are good for 15 minutes.
4. Mission approvals: only the person who started a mission can approve, decline or answer it (an approved send goes out through THEIR connected apps); teammates can still watch and stop it.
5. `/api/core/tools/input` (signed upload links for Core tools) had no plan check: now needs Core's plan.
6. Brand kits from a website or text made a model call without a credit check: now refused at zero credits like every other model call.
7. NEW second wall against cross-site writes (`src/lib/cross-site.ts`, in `src/proxy.ts`): a POST, PUT, PATCH or DELETE to `/api/*` whose browser `Origin` is not this site is refused (webhooks, cron, hand-overs, MCP and OAuth are exempt). Test `tests/unit/cross-site.test.ts`.

## Open, not fixed (low, or a decision for the owner)
- MEDIUM-LOW storage cost abuse: signed upload links are not size-bound (the size limits are checked at the finish step) and an abandoned upload stays in R2. The R2 lifecycle rule from run 3 (expire `u/*/up-*`, `u/*/vid-*`, `u/*/tools/in/*` and audio inputs after 24 hours) is the real fix and is STILL the owner's step (see `docs/ops.md`); a per-account byte quota is not built. `/api/uploads/direct/start` and `/api/audio/upload` stay un-gated on purpose (uploads feed the 2 free images).
- Audio uploads (`/api/audio/upload`, `/api/audio/input`) keep the same key after the check, so the signed link could overwrite the file within its hour (images and videos already get a fresh key). Serving is safe (nosniff, sandbox CSP); the risk is bytes reaching an audio provider unchecked. Re-key with `copyObjectIfMatch` as `finishVideo` does: not done.
- A mission on autopilot can use the web tools and spend in the same run: spend is capped by the person's budget and sends always wait for approval, but web text could steer a spend inside the budget (prompt rule only). Option: no autopilot spend once web content is in the transcript.
- Plans and missions: approve and reply have no plan check after a downgrade (spending is still held and bounded by credits).
- `PUT /api/chat-state` allows about 450 MB per account of saved chats; no plan gate.
- `sharp` and the ffmpeg stdin fallback read any format the file turns out to be (SVG included); not confirmed exploitable.
- WebRTC is not blocked by the Motion frame's CSP: a model-written motion could in theory send the user's own pictures out; narrow.
- Share links last 7 days and cannot be revoked except by binning the render. One key (`CONNECT_SECRET_KEY` or the Clerk key) both signs links and encrypts connector secrets (rotating the Clerk key would break both): set a dedicated `CONNECT_SECRET_KEY`. Premium prompts have no rate limit. The terms-acceptance record stores IP and browser (say so in the Privacy Policy). `GET /api/generations` asks Clerk who you are on every list poll (speed, not security).
