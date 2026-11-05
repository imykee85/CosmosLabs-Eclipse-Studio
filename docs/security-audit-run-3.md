# Security audit run 3 (2026-11-05) - Cloudflare security-audit skill, source-only, four reviewers

PARTIAL COVERAGE (quick-style: one reviewer wave, no critic wave, no separate verifier agents; I re-read each finding I acted on). Reviewers were read-only and executed nothing. Areas: (A) sandbox platform and Core build tools, (B) agent, plans, memory, editing, variations, canvas, upscale and video routes, (C) provider adapters, uploads, public files, (D) billing, credits, access, OAuth/MCP, admin. No high-severity cross-user issue was found. Deployed settings (Vercel, Clerk, Whop, R2) were not visible.

## Fixed in this change
1. UPLOAD SCAN BYPASS (medium, confirmed): the signed upload link lives an hour and a scanned file kept the same key, so it could be overwritten after the content scan. Now a checked picture is stored from the scanned bytes under a NEW server-made key (original deleted); a video is copied to a new key only while its ETag still matches the checked version (`copyObjectIfMatch`), else refused. Tests: `tests/integration/upload-rekey.test.ts`.
2. DRAFT FINAL PLAN BYPASS (medium, confirmed): the 1080p final of a Seedance 2.5 draft skipped the video plan tier and the daily video credit cap, and two parallel taps could start two finals. Now both checks apply and the start is claimed atomically (`video-draft.ts`).
3. REFUND CLAWBACK (medium): refunds were capped at the remaining balance, so spent credits were kept, and a refunded plan stayed "paid" for its window. Now the whole refunded share is taken back (the balance may go negative, which only blocks spending) and a refunded plan payment ends the plan at once. Test updated in `billing.test.ts`.
4. FREE-TRIAL FARMING (low-medium): Gmail dot and +tag variants each got the welcome renders. Now one offer per normalised inbox (`FreeEmailClaim`, hashed, new table: check `db-push: applying`; removed with the account). Test in `free-renders.test.ts`.
5. SHOTMAP RENDER LENGTH (medium): the 30 s cap used first start to last end, so ten overlapping 120 s shots rendered about 72,000 frames. Now shots must be in order and not overlap, and the SUM of their lengths is capped (`shotguide.ts`).
6. RETOUCH MASK AND EDIT ABUSE (medium/low): mask decoding now has a 16 megapixel limit (others 120), and crop/adjust, keep and the contact sheet have daily caps per workspace.
7. CHAT COST FLOOD (medium): chat is charged after the reply, so parallel messages could all pass the credit check. Added a per-minute limit on Atlas/agents, Core and Treatment (Prompts already had one).
8. Smaller: shared render and shared-canvas links are no longer cached publicly (`private`), OAuth client registration limit 300 to 20 an hour per address, tool frames lose `allow-modals` (alert phishing).

## Open, not fixed (all low or need a decision)
- Atlas remember/forget and Core confirmations: Atlas `forget` is one id per call (no bulk wipe) and a turn has at most 5 tool rounds; a confirm button for paid Core sandbox jobs (`edit_video`, `make_kinetic_film`, build sessions) is a product decision (about 10 to 60 credits per job, one open job per person, 30 a day).
- Team vs person mix-up: five routes (`canvas/assistant`, `prompts/polish`, `shot/rebuild`, `variations/narrative`, `memory/extract`) check the plan on the workspace but charge and load pictures with the person id (a team member is charged personally). Not a leak.
- Provider-supplied URLs are fetched without a host/IP check and bodies are read before the size check (`storage.ts`, `providers/qwen.ts`, `xai.ts`): only reachable through a compromised provider.
- Kinetic spec deny-list is bypassable by design; the real boundary is the sandbox (render stage has no network, nothing secret on the box). Core tool processes could survive into the upload stage (self-only). Sandbox `settle` finishes a job free if the charge throws.
- Shared canvas viewer sends every node's `data` fields; `/api/core/tools/input` has no plan gate or size limit; `projectId` is not ownership-checked when starting a render (rows against another workspace's project id, nothing readable).
- OAuth consent name phishing (anyone can register a client called "Claude"); mailto in portfolio email unchecked; `x-forwarded-for` trust (Vercel overwrites it).
- Needs validation with live services: Whop checkout metadata and chargeback events, SameSite on the Clerk session cookie (several JSON POST routes rely on it), Topaz cost when no estimate, DNS behaviour of the sandbox `allowlist` mode, sharp/ffmpeg memory on hostile files.

## Owner actions that came out of this run
- R2 lifecycle rule: delete objects under `u/*/up-*` and `u/*/vid-*` and `u/*/tools/in/*` that have no row after 24 hours (abandoned direct uploads cost storage). Steps in `docs/ops.md`.
