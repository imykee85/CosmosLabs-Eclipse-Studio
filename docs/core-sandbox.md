# Sandbox platform (Vercel Sandbox first)

Built 2026-10-17 from the owner's brief "Eclipse: Core sandbox platform (Vercel Sandbox first)". A sandbox is a throwaway Linux computer (a Vercel microVM) that Eclipse code and Core's agent use to run programs. Atlas, Canvas and the Agents UI are untouched.

**Core is NOT used for website builds** (owner 2026-10-17). The earlier Taste Skill build machine (`src/lib/sandbox/runs.ts`, `tools.ts`, `fake-local.ts`, `/api/core/sandbox-runs`, the `load_skill` / `read_skill_file` / `run_step` assistant tools) was REMOVED; its tables `sandbox_runs` and `skill_settings` stay in the schema so nothing is dropped, and nothing writes them. The vendored skill folder `core/skills/builtin/taste-skill/` and its loader `src/lib/core-skills/` are kept, unused (recoverable from commit history before this change).

## What uses it (job kinds)
| Kind | What | Network | Deadline | Price (PROVISIONAL Config) |
|---|---|---|---|---|
| `media.mux` | Puts a Mirelo "sound for video" take into its video (ffmpeg; replace, or mix with the clip's own sound, falling back to replace when the clip is silent) | the storage host only | 10 min | `SANDBOX_CREDITS_MUX` 5 |
| `core.tool.run` | Runs one of a person's saved sandbox mini tools on their files | storage while fetching; OFF (or internet for an approved version) while the tool runs; storage again for the upload after leftovers are killed | 5 min (tool 4 min) | `SANDBOX_CREDITS_TOOL_RUN` 5 |
| `core.exec` | Core build session: the agent's own machine while it builds or fixes a tool | none; npm and PyPI registries only when the agent switches packages on | 30 min | `SANDBOX_CREDITS_BUILD_5MIN` 10 per started 5 minutes (the 30-minute maximum is held) |
| `smoke` | Owner: boots the base with no network and checks node, ffmpeg (a 2-second test video) and, if installed, a headless browser screenshot | none | 5 min | free |
| `build.base` | Owner: boots `vercel/sandbox/universal:latest`, probes it, installs what is missing, verifies, saves a snapshot | internet minus private ranges | 25 min | free |

## Code
- `src/lib/sandbox/provider.ts` the interface (`SandboxProvider`, `NetworkMode`, `SandboxError` codes, output tails, hard timeouts). The brief named `src/server/sandbox/`; the repo keeps server code in `src/lib/`, so it lives there.
- `vercel.ts` the Vercel adapter (`@vercel/sandbox` pinned 3.8.0, OIDC sign-in, `persistent: false`, snapshot source, network mapping, error mapping). `fake.ts` the in-memory provider for tests. `index.ts` picks the provider (`SANDBOX_PROVIDER`) and keeps owner settings in `sandbox_settings` (base snapshot id, browser path, base report, smoke result).
- `runner.ts` the state machine: `enqueue` (kind allowed, kill switch, provider on, zod input, paid plan, 95% block, daily limit, one open job per person, credit hold, all inside one per-person lock), `advance` (ONE short step, row lock `lockedAt`, deadline, cancel flag), `drive` (steps for a time budget, used in `waitUntil` right after queuing), `advanceIfStale` (what the page's polling calls), `cancel`, `endSession`, `sweep`. After a sandbox exists every ending passes through `stop`; the price is charged once in `settle`, only on success.
- `kinds/` one file per kind (`mux.ts`, `core.ts`, `base.ts`), `usage.ts` (month totals vs allowance, 80% alert once a month, 95% block), `view.ts` (what pages see), `core-session.ts` (Core's agent tools), `flags.ts`.
- Tables: `sandbox_jobs`, `sandbox_usage_months`, `sandbox_settings`, `core_tools`; `sandbox_audit` gained `job_id` and `note` (check `db-push: applying`).
- Routes: `POST /api/sandbox/jobs` (kinds `media.mux`, `core.tool.run`; ids only from the browser), `GET /api/sandbox/jobs/<id>`, `POST /api/sandbox/jobs/<id>/cancel`; owner `GET /api/admin/sandbox/usage`, `POST /api/admin/sandbox/build-base`, `POST /api/admin/sandbox/smoke`, `GET/POST /api/admin/sandbox/jobs` (kill, sweep); cron `GET /api/cron/sandbox-sweeper` (daily, CRON_SECRET; the finishing cron also sweeps); mini tools `GET /api/core/tools`, `GET/PATCH/DELETE /api/core/tools/<id>` (approve or revoke internet per version), `GET /api/core/tools/<id>/frame` (a browser tool's page), `POST /api/core/tools/input` (signed upload for run files).
- Pages: `/admin/sandbox` (set-up, buttons, usage, latest jobs with Kill); `/tools` My tools lists "Built with Core"; `/tools/mine/<id>` runs one tool. Voice Studio sound takes for a video show "Download video with sound" while `SANDBOX_MUX=on`.

## Security
- A sandbox never gets an environment variable from us; it gets only signed storage links for the exact files, valid 30 minutes, passed as arguments (never env), and the audit log records such commands as `bash [n arguments hidden]`. A test scans every call to the fake for secret names and secret values.
- Default network is deny-all; each kind opens only what it needs; never `allow-all` for a person's job; header-injection rules are never used.
- One sandbox per job, never shared, `persistent: false`, always stopped.
- Output from a sandbox is data: the agent gets it wrapped in `<sandbox_output>`, pages render it as text (a test checks that `<b>` in a log is not rendered).
- Browser tools are served with a CSP whose `sandbox allow-scripts allow-downloads allow-forms allow-modals` rule gives them an opaque origin even when the address is opened directly (no cookies, no storage, no Eclipse pages), `connect-src 'none'` unless the owner approved internet for that version, and `frame-ancestors 'self'`. `next.config.mjs` leaves that one path out of the site-wide headers (which forbid framing). `allow-downloads` was added to the brief's `allow-scripts` so converters can save results.
- The Core build session is the person's own computer, so a shell command line is allowed there only.

## Verified by reading the SDK's own code (3.8.0), not live
- Any call on a sandbox whose session stopped makes the SDK RESUME it (it treats HTTP 410 as "start a new session"). The adapter therefore loads every sandbox with `resume: false` and refuses unless its session is `running`, so a timed-out job can never silently restart a VM.
- `stop()` returns the session's `activeCpuDurationMs` and `networkTransfer {ingress, egress}` (the types say they are reported only once the VM has stopped).
- `runCommand({ detached: true })` returns a command whose `cmdId` can be looked up later with `getCommand`; `exitCode` is null until it ends; `sudo: true` runs as root; `timeoutMs` kills with SIGKILL.
- The R2 host to allowlist is `<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (our storage signs path-style links there).

## Tested here (no real sandbox)
- `tests/integration/sandbox.test.ts` (throwaway Postgres, fake sandbox, fake R2), 15 tests: mux success (chosen variant, signed links, upload, charge once, stop, links hidden in the audit, storage key never shown), mux failure (no charge, stop, detail for admins only), foreign take and binned video refused, guards (unpaid 402, one open job 409, kill switch, 95% block, credit hold), global cap queue, quota refusal waits then starts, vanished sandbox, deadline expiry (kill + stop), cancel and concurrent advance (one create, one start), no secret in any call, usage totals and the 80% alert, tool run (network order: storage, OFF, list, kill leftovers, storage), tool refusals (foreign file, unapproved internet, form checks, a new version loses approval, another person's tool), the Core build session (labelled output, path escape refused, packages allowlist, save_tool for sandbox and browser tools, charged per 5 minutes), build-base then smoke (settings recorded, previous snapshot retired), failed smoke keeps its report.
- `tests/unit/sandbox.test.ts`: the Vercel adapter against a stand-in SDK (network mapping, snapshot source, `persistent: false`, no env, no resume on a stopped sandbox, detached start, output tails, stop usage, error codes), the REAL `mux.sh` run with bash, curl and ffmpeg against a local file server (replace, mix, silent clip falls back to replace, picture copied as h264, sound AAC, never prints a link), frame CSP, form description cleaning, session paths.
- Browser (mocked routes): Download video with sound (request, busy state, download, failure text), My tools list, browser tool frame (sandbox attribute; the tool cannot read `document.cookie`), sandbox tool form, upload, run and results, internet approval, at desktop and phone width (no sideways scroll). `/admin/sandbox` was not opened in a browser (needs a real admin sign-in).

## NOT VERIFIED (needs a Preview deployment and the owner)
- That OIDC sign-in works in our Vercel project (the SDK reads it automatically; if the smoke test fails with an auth error, check Project Settings, Security, OIDC Federation, then only as a last resort add `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN` as Secrets).
- What the universal image already has (ffmpeg, a browser), whether `sudo apt-get` works, which browser install route works: `build.base` records all of it in its report on /admin/sandbox.
- The exact refusal when the Hobby allowance is used up (mapped: 402, or 403/429 mentioning limits, usage or quota), the answer to creating a duplicate name (handled as 409 or "already exists" then attach), whether `update({ networkPolicy })` affects a process that is already running (the runner changes the network only between commands), the real CPU and transfer numbers, Hobby function duration (routes ask for 60 to 300 s) and that the second daily cron is accepted.
- A real mux of a Mirelo WAV onto a real clip, played on iPhone Safari.
- The provisional prices.

## Owner steps
1. Set `SANDBOX_PROVIDER=vercel` (Config value), redeploy.
2. Open `/admin/sandbox`, press "Build the base" (several minutes; keep the page open so it moves on), read its report.
3. Press "Run the smoke test"; when it passes, the old snapshot is deleted.
4. Set `SANDBOX_MUX=on` (Config value) to show "Download video with sound".
