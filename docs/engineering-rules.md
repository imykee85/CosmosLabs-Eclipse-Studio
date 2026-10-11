# Eclipse: engineering rules distilled from the ECC repo (affaan-m/ECC)

## What this is
The owner reviewed the ECC ("Everything Claude Code") repo and I picked only the parts that fit Eclipse (Next.js 14 App Router, TypeScript, Prisma + Neon Postgres, Clerk, Vercel, Cloudflare R2, Higgsfield and direct image providers, a credits ledger, Whop payments). Everything below is rewritten for Eclipse. Do NOT install the ECC repo, its hooks, its install script, its commands or its 600 skills: they add noise and unaudited code. Nothing in this file needs a new dependency.

## How to use this file
1. Save it as `docs/engineering-rules.md`. Add ONE line to CLAUDE.md pointing to it. Do not paste it into CLAUDE.md.
2. Do the one-time audit in section 1 now, report findings as a table (route, problem, severity, fixed or not). Fix CRITICAL and HIGH items in one batched push (the deployment-storage rule in CLAUDE.md still applies).
3. After that, treat sections 2 to 7 as the standing checklist for every change.

## 1. One-time security audit (do this first)
Review these Eclipse areas against the checklist below. Report only real findings with the file and line.
- `POST /api/payments/webhook`: signature check happens before anything else; replayed events cannot grant credits twice (idempotent per payment id, already built); no secret or full body in logs.
- `/api/admin/credits` and `/admin/credits`: admin check is server-side on every call (ADMIN_EMAILS plus verified Clerk email), never client-side only.
- `/api/cron/finalize-renders`: bearer secret is compared safely, 503 when unset (already built); confirm no other cron or internal route is public.
- Every `/api/*` route: authentication runs first, then an ownership check on the record (generation, upload, project, chat, memory). A valid id belonging to another user must return 404, not the data. Test this with two accounts.
- Signed R2 links: short expiry (10 min, already), share links 7 days (already); confirm the bucket and any r2.dev address stay public-off.
- SSRF: anywhere the server fetches a URL it did not write (provider result links copied to R2, BytePlus 24-hour links, reference pictures): https only, host allowlist per provider, size and time caps, no redirects to other hosts (storage already has caps, verify the allowlist).
- Uploads: validate size, real type from the bytes (already), and never trust the filename or extension; keep the rights checkbox enforced server-side.
- Input validation: every route parses the body with a schema (zod or equivalent) and rejects unknown fields; prompts have a max length per model (already). No raw SQL string concatenation; if `$queryRaw` exists, it uses tagged template parameters.
- Rate limiting: per-user limits on `/api/generate`, `/api/connect/chat`, `/api/uploads`, sign-in related routes, and the share endpoint. The per-instance cap of 20 renders is not a rate limit; add a per-user, per-minute limit.
- Secrets: no keys in source or logs; `grep -rn "sk-\|AIza\|api_key" src` is clean; provider error text is logged server-side but never returned to the browser if it could echo a key or headers.
- Headers: add a Content-Security-Policy (start strict: default-src 'self', object-src 'none', base-uri 'self', frame-ancestors 'none'; allow only the origins Eclipse really needs, e.g. R2 signed-link host, Clerk, fonts; avoid 'unsafe-eval'; if 'unsafe-inline' is unavoidable for Next.js scripts use nonces and record it as debt), plus Strict-Transport-Security, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy that disables camera, microphone and geolocation unless a feature needs them. Test that Clerk, R2 images, the carousel videos and the Motion graphics host (media.prompt-motion.com) still load.
- Dependencies: run `npm audit --audit-level=high` and report; do not auto-upgrade majors.
- Cookies and tokens: nothing sensitive in localStorage (Eclipse's localStorage use is UI settings only; keep it that way).

## 2. Error handling (one pattern for all routes)
- One small `AppError` class with `code`, `statusCode` and optional `details`, plus subclasses: NotFound, Validation (422), Unauthorized (401), Forbidden (403), RateLimited (429), InsufficientCredits (402), ProviderError.
- One `handleApiError(error)` used by every route: known AppError returns `{error:{code,message,details?}}` with its status; schema errors return 422 with field names; anything unexpected is logged in full on the server and returns a generic message.
- User messages and developer messages are different. Show the person plain text ("The model refused this prompt", "Not enough credits"); log the provider's raw message server-side only.
- Never swallow an error: every catch either handles it, rethrows it, or logs it.
- Provider calls return a result type (`{ok:true,value}` or `{ok:false,error}`) so a failed render is a normal outcome, not an exception that skips cleanup.
- Document the error codes the client can receive, once, in `docs/api-errors.md`.

## 3. Retries and provider calls
- Retry only transient failures: network errors, 429, 5xx. Back off exponentially, at most 3 tries. Never retry 400, 401, 403, content-filter refusals, or billing and quota errors (these cost money or never succeed).
- A retry must never double-charge or double-render: keep the Idempotency-Key (Higgsfield) and the sync-render job guard (direct providers); store the provider request id before polling and never resubmit on a timeout until the outcome is known.
- Record cost on every Generation (`providerUsage`, measured `costUsd` when known). Keep a per-user daily cap and the global kill switch in front of every provider call, including video.
- Orbit (Claude API): the system prompt is frozen, so mark it for prompt caching (`cache_control: {type:"ephemeral"}`) once it is over about 1,024 tokens. Route simple turns to the cheaper model and keep the expensive one for hard turns, and log which model each turn used. Check current model names and prices on Anthropic's pricing page before hardcoding any number; the model ids stay in `connect-models.ts`.

## 4. Database and Prisma (Neon, serverless)
- Keep exactly one PrismaClient (globalThis singleton). Use the pooled `DATABASE_URL` for the app and `DIRECT_URL` only for schema changes (already set up). Many serverless instances opening their own pools is the usual cause of "too many connections".
- `updateMany` and `deleteMany` return a COUNT, not rows. Do not write code that expects records back.
- `@updatedAt` is NOT set by bulk writes (`updateMany`); set it explicitly there.
- Keep external calls (Higgsfield, R2, Clerk, e-mail) OUTSIDE `$transaction`. Interactive transactions time out (about 5 seconds by default); inside one use the `tx` client only, never the outer one. Check that `finalizeGeneration` and `spendCredits` follow this: claim the row atomically, do the slow work outside, then write the result and the ledger entry in one short transaction.
- Add an `@@index` on every foreign key and every column used in `where` or `orderBy` (for example `Generation(userId, createdAt)`, `Generation(projectId, deletedAt)`, `CreditLedger(userId, createdAt)`). Check the existing schema for gaps.
- Never return a raw Prisma record from an API route. Map to a response object so internal fields (storageKey, providerUsage, requestId, statusUrl) are not exposed.
- List endpoints are paginated with a cursor and a hard maximum page size.
- `prisma migrate dev` can reset a database: never run it against Neon production.

## 5. Migrations (before real users or real money)
Eclipse applies the schema with `prisma db push` during the Vercel build. That is acceptable for now. Before taking payments or storing customer data at scale, switch to real migrations:
- Every change is a migration file, committed. Production runs `prisma migrate deploy`.
- Forward-only in production: a rollback is a new migration.
- New columns are nullable or have a default. Never add a NOT NULL column without a default.
- Renames use expand and contract: add the new column, backfill in a separate step, move the code, drop the old column in a later release.
- Create indexes with `CREATE INDEX CONCURRENTLY` on large tables (needs special handling in Prisma migrations).
- Schema changes and data backfills are separate migrations; backfills run in batches.
- Test each migration on a copy of the Neon database (use a Neon branch) first.
Propose the switch as a task with a short plan; do not do it unasked.

## 6. Verification before every push (extends the checklist already in CLAUDE.md)
Run in order and stop at the first failure: build, `tsc --noEmit`, lint, tests, security grep, diff review. Then output a short report:
```
VERIFICATION REPORT
Build: PASS/FAIL | Types: PASS/FAIL | Lint: PASS/FAIL | Tests: x/y passed
Security grep (keys, console.log of data, TODO secrets): PASS/FAIL
Diff: n files changed, anything unintended? 
Ready to push: YES/NO
```
Review the diff for unintended changes, missing error handling, and edge cases (empty list, double click, offline, expired signed link, provider timeout). Remove debugging `console.log` that prints user data, prompts, keys or provider responses.

## 7. End-to-end tests (Playwright, which is already available)
Add a small suite, not hundreds of tests. Cover only the journeys where a bug costs money or trust:
1. Sign-up and sign-in (demo mode is fine in CI).
2. Create a project, generate one image with a mocked provider, see it in Gallery and Library.
3. Credits: balance shown, a render spends exactly once, insufficient credits is refused with a clear message.
4. Upload a picture and use it as a reference.
5. Bin: delete, restore, delete forever.
6. Payments webhook: a valid signed event grants credits once; the same event twice grants once; a bad signature grants nothing (unit-level test with a fake provider).
Rules: use `data-testid` for selectors, never `waitForTimeout` (wait for a response or an element), each test independent, trace on first retry, run new tests 5 times to find flaky ones, quarantine flaky tests with `test.fixme` and a note instead of deleting them.

## 8. Keeping Claude Code fast and cheap
- CLAUDE.md has grown very long (each line is a whole paragraph). Everything in it is loaded into every session. Split it: keep CLAUDE.md to rules and a short state summary (under about 300 lines), and move the long feature descriptions into `docs/` files (docs/studio.md, docs/orbit.md, docs/providers.md, docs/payments.md) that CLAUDE.md links to by name. Propose the split and the new layout first; do it in one docs-only commit with `[skip ci]`.
- Compact the session at natural boundaries (after finishing a feature and verifying it, before starting a different one), not in the middle of a task. Write a short "where we are" note into the relevant docs file before compacting.
- Keep MCP servers and plugins to what Eclipse really uses; each tool schema costs context.

## 9. Video work (for the Video Studio plan; only what is relevant)
- Generation uses the Higgsfield video models through the provider interface; keep the same rules (registry, no silent fallback, save to R2, cap per user).
- Export (joining clips) needs a server that can run ffmpeg. Options to evaluate and report on, not to build yet: ffmpeg on a background worker, or a React-based renderer such as Remotion. Before using Remotion in a paid product, read its current license terms and report them to the owner.
- Real-footage editing principle worth keeping: use AI to compress, structure and augment footage, and keep each layer (capture, cut, overlays, voice, final polish) as a separate step instead of one tool doing everything.

## What was deliberately NOT taken from ECC
Its install script and plugin, hooks and cost-tracker hook (they run local scripts), the 95 slash commands, the language-specific reviewers and rules (Go, Rust, Java, Python and others), Supabase row-level-security patterns (Eclipse uses Clerk and Prisma), Agent Browser (Playwright is enough), and the 600-skill library. The owner may revisit a specific skill later; each would need a read-through first.
