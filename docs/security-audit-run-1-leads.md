# Needs validation

Leads with a real source trace but an unresolved deployment or runtime fact. No severity. Local steps run only in an isolated sandbox with dummy data; deployment steps are owner-observed (never send audit traffic to the live site).

## Agent chat endpoint has no per-user cap on paid Anthropic calls
`agent-chat-no-spend-limit`

POST /api/agent/chat accepts any Clerk-authenticated user and calls Claude Sonnet 5.5 on every request (max_tokens 1500, up to 20 messages of 4000 chars). The route has no per-user rate limit, daily cap or concurrency limit, unlike /api/connect/chat (24 h count, 429) and /api/prompts/chat (12/min, in-memory per instance). All three share one ANTHROPIC_API_KEY, so a request loop could burn the owner's budget or hit provider rate limits and degrade the other routes.

**Root cause:** The agent chat route has no per-user quota, throttle or concurrency control before the paid LLM call, unlike its sibling chat routes.

**Trace:**
- entrypoint: `src/app/api/agent/chat/route.ts:22` POST /api/agent/chat: Any signed-in Clerk user reaches the handler; middleware only requires sign-in.
- propagation: `src/app/api/agent/chat/route.ts:26` gating: Only clerkEnabled, userId and ANTHROPIC_API_KEY presence are checked; no counter or limit.
- propagation: `src/app/api/agent/chat/route.ts:31` input shaping: Last 20 client messages, each clipped to 4000 chars: bounds one request, not the number of requests.
- sink: `src/app/api/agent/chat/route.ts:57` client.messages.create: One paid Anthropic call per request (maxRetries 2), repeatable without a per-user bound.

**Evidence:**
- `src/app/api/connect/chat/route.ts:28` Sibling counts messages over 24 h and returns 429 over the limit.
- `src/app/api/prompts/chat/route.ts:29` Sibling returns 429 from tooFast(userId) (in-memory, per instance).
- `src/middleware.ts:9` Only auth().protect(); no throttling.

**Blockers:**
- Whether a Vercel Firewall rate-limit rule already throttles this route.
- Whether Clerk sign-up is open to arbitrary users and what bot protection applies.
- Whether the Anthropic workspace behind ANTHROPIC_API_KEY has a monthly spend limit or per-feature keys.

**Check (local):** With ANTHROPIC_BASE_URL pointing at a local fake and auth() mocked, send many sequential and parallel POSTs and confirm each reaches messages.create with no 429 (low counts, wall-clock limit, no egress).

**Check (owner-observed):** Owner checks Vercel Firewall rate-limit rules, Clerk sign-up restrictions and bot protection, and the Anthropic console spend limit and key scoping.

## Connect assistant daily message cap is a non-atomic check and can be exceeded by parallel requests
`connect-chat-daily-cap-check-then-store-race`

POST /api/connect/chat counts the user's stored human messages from the last 24 h and returns 429 at CONNECT_DAILY_MESSAGES (default 100). The user's own message row is only written inside runTurn, after the check, with no transaction, lock or in-flight guard, so parallel requests started below the limit all pass. Each can run up to 8 model steps (Opus default, max_tokens 16000) and its tool calls can start renders. Overshoot is a one-time window of about N-1 extra turns per burst, bounded by maxDuration 60 and the 8-step loop; it is not an unbounded bypass.

**Root cause:** The quota read (route.ts:27) and the quota-consuming write (connect-agent.ts:113) are separate unlocked steps, so concurrent requests read the same stale count.

**Trace:**
- entrypoint: `src/app/api/connect/chat/route.ts:12` POST /api/connect/chat: Authenticated user sends many concurrent messages.
- propagation: `src/app/api/connect/chat/route.ts:27` daily quota read: connectMessage.count runs before any concurrent request has stored its user message; line 28 compares to dailyLimit().
- propagation: `src/lib/connect-agent.ts:113` store(user) inside runTurn: The user row the cap counts is first written here, after chat lookup/create and rows read.
- sink: `src/lib/connect-agent.ts:123` sdk.beta.messages.stream: Each admitted request runs up to 8 paid Anthropic calls (loop at 118); tool calls at 143-147 can start paid renders.

**Evidence:**
- `src/lib/connect-agent.ts:113` store('user') does connectMessage.create with no quota re-check.
- `src/app/api/connect/chat/route.ts:28` The limit comparison is the only quota gate on the path.

**Blockers:**
- How many concurrent invocations Vercel admits for one user and Anthropic/Higgsfield rate limits cannot be seen from source.
- Render spend is additionally gated by credits only when CREDITS_ENABLED=1.

**Check (local):** Against a throwaway Postgres and a delayed stub Anthropic server with Clerk mocked, seed limit-1 user rows, fire N parallel POSTs, count stored user rows and stub hits; expect more than the limit admitted. Fix check: per-user advisory lock or insert the row in the same transaction as the count.

**Check (owner-observed):** On a test account in Preview with CONNECT_DAILY_MESSAGES set low, send a small parallel burst and compare stored count and Anthropic usage with the cap. Do not test Production.

## Render credit check is not reserved, and a failed charge still delivers the render, so parallel renders overrun the balance
`credits-checked-at-start-charged-at-completion-no-reservation`

When CREDITS_ENABLED=1, POST /api/generate only compares the current ledger balance with the model price. Nothing is reserved and the paid provider is called before any debit. The debit happens when a render finishes; if spendCredits throws InsufficientCreditsError the catch only logs it and the row is still marked completed with the image stored. A signed-in user with a small balance can send parallel requests that each pass the check and each call the provider, so the operator pays for renders the user never paid for. Source shows no per-user in-flight cap or rate limit; the only cap is the per-instance MAX_CONCURRENT=20 queue.

**Root cause:** The affordability check (getBalance in startRender) is separate from the debit (spendCredits at completion) with no reservation or hold, and the debit failure is swallowed so an unpaid render is still delivered. The advisory lock in spendCredits protects only the ledger write.

**Trace:**
- entrypoint: `src/app/api/generate/route.ts:12` POST /api/generate: Authenticated user submits a render request; no per-user rate limit or in-flight cap.
- propagation: `src/lib/start-render.ts:79` startRender credit check: chargeFor(model) returns a price only when CREDITS_ENABLED=1; getBalance is compared with the price and nothing is reserved.
- propagation: `src/lib/start-render.ts:92` startRender provider call: startGeneration submits the paid job before any debit (Google/OpenAI run inline at line 89).
- propagation: `src/lib/generation-jobs.ts:98` finalizeGeneration charge: spendCredits is wrapped in try/catch that only logs; InsufficientCreditsError (credits.ts:46) is swallowed.
- sink: `src/lib/generation-jobs.ts:100` finalizeGeneration completion: The row is set to completed and the image delivered whether or not the debit succeeded; completeFromBytes (108-112) does the same.

**Evidence:**
- `src/lib/credits.ts:17` getBalance is a plain aggregate with no lock or hold.
- `src/lib/credits.ts:40` spendCredits throws without writing when balance is short; the lock serialises debits only.
- `src/lib/higgsfield.ts:35` Only concurrency control is a per-instance in-memory queue (MAX_CONCURRENT=20).
- `src/lib/models.ts:164` chargeFor returns null unless CREDITS_ENABLED === '1'.

**Blockers:**
- Whether CREDITS_ENABLED=1 is set in the deployed environment (documented as off until launch); with it off there is no credit overrun, only unmetered provider spend with no rate limit.
- Account-level rate and spend limits at Higgsfield, Google, OpenAI and BytePlus.
- Whether a platform rate limit (Vercel firewall/WAF) sits in front of /api/generate.
- Whether concurrent requests really interleave so all pass the check (expected from source, not executed).

**Check (local):** In a non-networked fixture (throwaway Postgres, mocked provider, CREDITS_ENABLED=1) give a dummy user a 2-credit ledger and a model priced at 2; call startRender 10 times concurrently, then finalize each pending row. Positive result: 10 completed Generation rows and exactly 1 CHARGE ledger row.

**Check (owner-observed):** Owner checks whether CREDITS_ENABLED=1 in Production and Preview and whether Vercel firewall/WAF rate limiting covers /api/generate; if charging is on, compare completed Generation rows per user with CHARGE ledger rows.

## Agent chats, Prompts chats, portfolio draft and cached credit balance in localStorage are not account-scoped and survive sign-out
`eclipse-browser-storage-not-account-scoped-or-cleared-on-signout`

Sign-out only calls Clerk signOut and clears no storage. Several keys hold per-user content under origin-wide names with no user id: eclipse-agent-chat-<agent>, eclipse-prompts-<engine> (text and picture ids), eclipse-portfolio, eclipse-canvas-templates and eclipse-credits. A second person signing in on the same browser profile can read the previous account's agent and prompt chats. Narrowed from the original lead: canvas docs/indexes are keyed by server project id so they do not cross accounts, projects and generations are re-fetched from the API, and eclipse-credits is overwritten by /api/credits on mount.

**Root cause:** Storage keys are not bound to the Clerk user id, and the sign-out handlers do not clear eclipse-* keys or the in-memory caches (agent-chat cache Map, use-credits cache).

**Trace:**
- entrypoint: `src/components/account.tsx:44` ClerkSignOut onClick: Sign out calls only signOut({redirectUrl:'/'}); no localStorage clearing anywhere.
- propagation: `src/lib/agent-chat.ts:31` KEY/read/write: Chat stored under eclipse-agent-chat-<agent> with no user id and held in a module-level cache Map.
- sink: `src/components/prompts/PromptsView.tsx:26` load/save: Prompts chat is rendered from eclipse-prompts-<engine> for whoever signs in next on the profile.

**Evidence:**
- `src/lib/use-credits.ts:16` eclipse-credits cache is shown first then replaced by /api/credits; brief, low value.
- `src/lib/canvas-store.ts:12` Canvas keys include the project id (per-account server id), so they do not cross accounts.
- `src/lib/projects.ts:31` With Clerk enabled projects come from the server API.

**Blockers:**
- No execution was possible, so a source trace alone is not an observed result.
- Requires later access to the same browser profile without the first user clearing site data (shared-device scenario).
- Whether signOut with redirectUrl does a full reload (resetting in-memory caches) was not confirmed; localStorage persists either way.

**Check (local):** With Clerk keys or a mocked session: sign in as A, send one agent chat and one Prompts message, log out, sign in as B in the same profile, open Prompts and the agent card and check whether A's messages appear; inspect localStorage for eclipse-agent-chat-*, eclipse-prompts-*, eclipse-portfolio and eclipse-credits. Expected severity low.

**Check (owner-observed):** n/a

## Next image optimizer accepts any https host and is reachable without sign-in (quota abuse)
`next-image-optimizer-open-wildcard-remotepatterns-unauthenticated`

images.remotePatterns allows https hostname '**' and the middleware matcher excludes /_next, so an anonymous visitor can request /_next/image?url=<any https image>&w=&q= and make the deployment fetch, transform and cache third-party images. The expected impact is image-optimization and bandwidth quota consumption and use as a fetch/transform proxy. No component uses next/image (plain <img> everywhere), so the wildcard has no legitimate use. Not SSRF into private networks on Vercel because the optimizer runs on Vercel's infrastructure.

**Root cause:** next.config.mjs sets images.remotePatterns to https '**' and the middleware matcher exempts /_next, so the built-in optimizer endpoint is an open allowlist-free fetch proxy although the app never uses next/image.

**Trace:**
- entrypoint: `src/middleware.ts:16` config.matcher: Matcher starts with (?!_next|...) so /_next/image never runs clerkMiddleware; anonymous requests are served.
- propagation: `node_modules/next/dist/server/image-optimizer.js:453` ImageOptimizerCache.validateParams: Only checks url is http(s) and hasRemoteMatch passes; no authentication.
- sink: `next.config.mjs:5` nextConfig.images: remotePatterns [{protocol:'https',hostname:'**'}] makes hasRemoteMatch accept every https host.

**Evidence:**
- `next.config.mjs:5` Wildcard hostname with protocol https; no pathname or port restriction.
- `src/middleware.ts:16` Matcher excludes paths starting with _next.
- `vercel.json:1` No image-related config or rule restricts /_next/image.

**Blockers:**
- Whether Vercel image optimization is enabled and billed or capped for the ai-labs8 plan.
- Exact 14.2.x optimizer limits (response size, redirects) were not confirmed by execution.

**Check (local):** In an approved sandbox run next start with Clerk env unset and then dummy Clerk keys; GET /_next/image?url=https%3A%2F%2Fexample.invalid%2Fa.png&w=64&q=75 with no session; confirm it is not a 401/redirect and fails at fetch; confirm an http:// url returns 'url parameter is not allowed'.

**Check (owner-observed):** On a Preview, make several unauthenticated /_next/image requests for a public https image and watch Vercel Usage image-optimization counters. Fix: remove the images block, set images.unoptimized:true, or restrict remotePatterns to R2/known hosts.

