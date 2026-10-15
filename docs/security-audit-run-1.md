# Security audit: Eclipse (quick, scoped, source-only)

**Profile:** quick. **Scope:** server code (src/middleware.ts, src/app/api, src/lib, next.config.mjs, vercel.json, package.json, scripts/db-push.mjs, prisma/schema.prisma, src/app/layout.tsx and the browser-storage code). **Source ref:** cf2afb9e (clean worktree). **Budget:** none set; 1 hunter wave of 7 reviewers, 1 final coverage critic, 5 independent verifiers (13 agents, 5 candidate verifications). **Execution:** source review only. No OS sandbox could be enforced here, so no app code was run, nothing was sent to deployed services, and nothing that needs running was confirmed. Prior runs: none.

**This is a partial pass, not a clean bill of health.** The critic found three areas the hunters did not reach; they are `deferred` (see Coverage).

## Posture
No confirmed vulnerability and no cross-user data break was found. Every API route reviewed derives the user from the Clerk session and filters by user id; uploads and render files are owner-scoped with server-built storage paths; the payment webhook verifies a signature, rejects replays and takes amounts from the server's plan table; the cron route fails closed; connector secrets are AES-256-GCM encrypted; the Orbit assistant's tools are user-scoped and send only to the user's own Telegram/Slack. The open items are **spend and abuse limits** (money and quota), one **config** issue and one **shared-browser** issue. All five are `needs_validation`: the code path is real, but whether each matters depends on deployment settings the source cannot show.

## Confirmed findings
None.

## Needs validation (no severity; ordered by importance)
| # | Lead | Boundary | Blocker to resolve |
|---|---|---|---|
| 1 | Credit check is not reserved and a failed charge still delivers the render (`credits-checked-at-start-charged-at-completion-no-reservation`) | signed-in user vs your provider bill | Is `CREDITS_ENABLED=1` in production? Rate limits at Higgsfield/Google/OpenAI/BytePlus |
| 2 | `/api/agent/chat` has no per-user limit on paid Anthropic calls (`agent-chat-no-spend-limit`) | signed-in user vs Anthropic budget | Vercel firewall rule? Clerk sign-up open? Anthropic spend cap? |
| 3 | Orbit daily message cap can be exceeded by parallel requests (`connect-chat-daily-cap-check-then-store-race`) | signed-in user vs Anthropic/render spend | Vercel concurrency; bounded to about N-1 extra turns per burst |
| 4 | Next image optimizer is an open, unauthenticated proxy for any https host (`next-image-optimizer-open-wildcard-remotepatterns-unauthenticated`) | anonymous visitor vs Vercel image quota | Is optimization enabled/billed on your plan? |
| 5 | Agent chats, Prompts chats, portfolio draft and templates stay in the browser after sign-out (`eclipse-browser-storage-not-account-scoped-or-cleared-on-signout`) | next user of a shared browser | Shared-device case only; canvases and projects do NOT leak |

Details, traces and safe checks: NEEDS-VALIDATION.md. Smallest fixes:
1. Reserve (debit) credits inside the same per-user lock before calling the provider and refund on failure; if a charge fails after an image exists, withhold the image. Add a per-user cap on pending renders.
2. Give `/api/agent/chat` the same daily count as Orbit (and put the per-minute limit in the database, not in memory).
3. Take the per-user lock, or insert the user's message, in the same transaction as the count.
4. Delete the `images` block in next.config.mjs (nothing uses next/image) or set `images: { unoptimized: true }`.
5. Clear `eclipse-*` keys on sign-out (or prefix keys with the Clerk user id).

## Hardening notes (not findings)
- Gate db-push on VERCEL_ENV or give Preview its own database branch so preview builds cannot mutate a shared schema.
- prisma db push has no migration history; plan prisma migrate before real users.
- secret-box falls back to CLERK_SECRET_KEY as key base: use a dedicated CONNECT_SECRET_KEY (rotating Clerk would orphan stored connector links).
- Use npm ci in the build and add dependency auditing; no CI exists.
- A 2.7 MB vtracer Python wheel is committed at the repo root and unused; remove it.
- Wrap the Connect daily-cap count and the user-message insert in one transaction, or reserve the quota with an atomic counter row, to make the cap hard.
- Move the prompts-chat rate limit (an in-memory Map per serverless instance, never pruned for idle users) to a shared store (DB or KV). It is bypassable across instances and the Map grows by one entry per user.
- Derive the connector secret key only from a dedicated CONNECT_SECRET_KEY. The CLERK_SECRET_KEY fallback couples credential encryption to an auth key, so rotating Clerk silently orphans every stored link. The key is an unsalted sha256, which is fine for a high-entropy key but is not a KDF.
- /api/connectors/[id] POST sends a real message to the supplied Telegram or Slack destination with no per-user throttle. It is bounded to the user's own credentials and fixed hosts, so there is no cross-tenant impact. A small per-user rate limit would stop use as a message relay.
- startRender and runTurn accept a client projectId without an ownership check. Harmless today because every read filters by userId, but validating it with project.findFirst({id, userId}) would stop dangling cross-tenant references.
- The memory count-then-create (300 limit) is racy. It is soft and self-impacting only.
- Reserve credits when the render starts. Insert a ledger hold or a CHARGE row inside the same per-user advisory-lock transaction as the balance check, and refund it on failure. If a charge fails after the provider has already produced an image, fail the render and do not return the image.
- Add a per-user cap on pending and saving renders, and a per-user rate limit on /api/generate. The 20-slot queue in higgsfield.ts is per serverless instance, unbounded, and shared by all users.
- Check that the host of the provider-returned statusUrl matches the Higgsfield base URL before sending the Authorization key in higgsfield.status and cancel.
- Check in startRender that a body-supplied projectId belongs to the caller. It is currently stored unchecked, and anything that later joins on it should not trust it.
- The stale-saving reclaim in finalizeGeneration can run spendCredits a second time after a crash between the charge and the update to completed. Make the charge idempotent per generation id, for example with an externalId on the ledger row.
- Reserve credits atomically before calling the provider; withhold the image or record a negative entry if a charge fails.
- Handle refund/dispute events and verify paid amount against the plan.
- Require application/json on admin and checkout POSTs rather than relying on SameSite cookies.
- Add a per-user rate limit on checkout creation.
- Make the charge idempotent per generation id (externalId) to stop a double charge after a crash between charge and completion.
- Throw instead of defaulting WHOP_WEBHOOK_SECRET to an empty string in whop.ts.
- POST /api/uploads stores a client-supplied projectId without checking it belongs to the user. It is harmless today because nothing authorizes on it, but validate it against the user's projects so a future query keyed on Upload.projectId cannot be abused.
- The upload count cap (300) is a non-atomic count-then-create. Parallel requests can exceed it; enforce it in a transaction or with a per-user lock if storage cost matters.
- saveImageFromUrl and openImage call fetch with default redirect following and check the protocol only after the fact. Consider redirect: 'manual' or a host allow-list for provider CDN hosts.
- The file routes (upload and render) do not set X-Content-Type-Options: nosniff. Content types are sniffed and fixed to PNG/JPEG/WebP, so there is no current exploit, but adding the header is cheap defence in depth.
- 7-day share links are not revoked when the render is binned. Delete-forever removes the object, so this is only a lifecycle note.
- Add a Content-Security-Policy (frame-ancestors 'none', object-src 'none', base-uri 'self'), X-Content-Type-Options nosniff, Referrer-Policy and Permissions-Policy; the authenticated app is currently frameable.
- If a strict script-src is adopted the inline theme script needs a nonce/hash.
- If a CSP is added allow media.prompt-motion.com in media-src and R2/provider hosts in img-src.
- Make production builds fail closed if NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing (demo mode lets every route through).
- POST /api/canvases counts only non-deleted canvases against MAX_CANVASES=100, and restore (PATCH) does not recheck the cap. A signed-in user can create, trash and recreate canvases (up to 600 KB each) without bound, and parallel POSTs can also pass the count check. This is per-user storage growth with no cross-user impact. Count trashed rows toward a larger hard cap, or cap restore.
- POST /api/projects has no per-user project cap or rate limit. A signed-in user can create unbounded Project rows. Self-scoped DB growth only.
- PUT /api/canvases/[id] also saves to a canvas in 'Recently deleted'. Not a security issue.
- Projects have no foreign key to Canvas, Generation or Upload, and project DELETE does not clean up canvases. Orphaned rows remain, a data-lifecycle point rather than an access break.
- The three projects routes duplicate userOr401 instead of using requireUser. Consolidating avoids drift.
- Add security headers in next.config.mjs (Content-Security-Policy with frame-ancestors 'none', nosniff, Referrer-Policy, Permissions-Policy); the signed-in app is currently frameable.
- Make production builds fail if the Clerk publishable key is missing (demo mode passes every route through).

## Positive patterns
Per-user scoping on every query reviewed; `updateMany`/`deleteMany` with `userId` in the where clause; atomic claim so a render is saved and charged once; magic-byte sniffing of uploads (no SVG/HTML); server-built storage keys; no `dangerouslySetInnerHTML` except a constant theme script; every `target=_blank` has `rel`; lockfile pins 534 packages to npmjs with integrity hashes; no committed secrets found by pattern scan.

## Coverage
Ledger: 10 units: 3 `covered`, 4 `candidate` (a lead was raised), 3 `deferred`.
- `covered`, no lead: build/dependencies/secrets; middleware and per-user CRUD routes; uploads, stored files and share links.
- `candidate` (lead raised, reviewed): payments/credits/cron/admin; render pipeline; Orbit assistant and prompt/agent routes; browser and config.
- `deferred` (final critic, quick profile, NOT reviewed): (a) the Google/OpenAI/BytePlus provider clients (`src/lib/providers/*`: base-URL env overrides, unbounded base64 decode of provider replies, timeouts); (b) the Higgsfield client (it sends the API key to whatever `status_url` the provider returns, with no host check; the `uploadFile` PUT; waitUntil fan-out); (c) server pages and layouts under `src/app` (admin credits page gate, searchParams handling such as the tutorial `from` redirect, onboarding fail-open). The Higgsfield key-forwarding item was also noted by two hunters as hardening: only a compromised provider could exploit it.
- Final critic result: three missing units (above), no reassignments. Not verified at all: deployed settings (Clerk dashboard, Vercel firewall and plan limits, R2 public access, Anthropic/provider spend caps, whether Preview and Production share one database).

## Status after the first fixes (2026-10-11)
Fixed in code: credits are now HELD when a paid render's row is created (`src/lib/reservations.ts`), so parallel renders cannot overrun the balance; the agent chat, Prompts chat and Orbit message limits are claimed under a lock in the database (`src/lib/usage.ts`, table `usage_events`; agent chat default 200 a day, `AGENT_DAILY_MESSAGES`, a Config value); the unused image optimizer is switched off (`images.unoptimized`); chats, drafts, templates and the cached balance are cleared at sign-out (`src/lib/clear-account-data.ts`); the Higgsfield key is only sent to Higgsfield's own address. Still open: the three areas the critic found (providers, rest of the Higgsfield client, server pages), security headers, the deployment settings listed under Coverage.
