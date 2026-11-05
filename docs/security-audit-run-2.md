# Security audit run 2 (2026-11-05) - Cloudflare security-audit skill, QUICK profile, source-only

PARTIAL COVERAGE. One hunter wave (4 hunters), no final critic wave, no independent verifier agents (I re-checked the confirmed items in source myself). No code was executed (no OS-enforced sandbox), so nothing needing a running app was validated. The strict canonical coverage ledger was not generated. Deployed controls (Vercel firewall, Clerk, R2, Whop settings) were not visible.

## Confirmed in source (fixed in this change)
1. SSRF filter bypass in the link reader (`src/lib/fetch-page.ts`): `http://[::ffff:127.0.0.1]/` normalises to `[::ffff:7f00:1]`, which the private-address check read as public (reaches loopback/internal HTTP on ports 80/443, text returned). Used by the Treatment chat. FIXED: embedded IPv4 is decoded in any notation, NAT64/6to4/site-local blocked, non-dotted input refused. Test `tests/unit/ssrf-v6.test.ts`.
2. Account deletion and team sweep left finished videos in storage (`video/<id>/` prefix never deleted). FIXED in `src/lib/account-delete.ts`.
3. MCP batch of 20 calls counted as one rate-limit hit and the chat credit check holds nothing, so one request could run 20 paid assistant turns on a tiny balance. MITIGATED: batch capped at 3 (`src/app/api/mcp/route.ts`). NOT fixed: chat credits are charged after the reply with no hold (parallel plain requests have the same race).

## Needs validation / not fixed
- Stored prompt injection: memories and render prompts are put unescaped in Core's `<context>`; Atlas `remember` needs no confirmation; Core `generate_image`/`forget` need none. Depends on live model behaviour. Hardening: delimit and escape, label as untrusted, button for remember/forget.
- Whop credit grant trusts checkout metadata (`planId`, `credits`) rather than the amount paid. Depends on whether buyers can set metadata or buy hidden plans directly, and on coupons.
- `/oauth/token` limit keyed on public client_id can be filled by anyone (denial for that client).
- OAuth redirect allowlist (loopback any port, vscode/cursor schemes) plus anonymous client names allows consent phishing by a local app; PKCE limits impact.
- Refund clawback is capped at the remaining balance (spent credits are kept).
- `x-forwarded-for` trusted for IP limits (Vercel believed to overwrite).
- Media worker (not deployed): `urlopen` with no scheme allowlist, unrestricted push URL, no prune of jobs. Fix before hosting it.
- Shared-canvas viewer exposes all node fields; share links cannot be revoked before 7 days.
- Hardening: AES-GCM auth tag length not pinned.

## Not covered
Sandbox runner/core-session internals, kinetic spec checker, provider adapters, most agent/variations/memory routes line by line.
