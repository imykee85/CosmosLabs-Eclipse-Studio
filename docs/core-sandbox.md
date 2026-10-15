# Core: built-in folder skills and the build machine (sandbox)

Built from the owner's CC brief "Taste Skill as a built-in skill" (2026-10-15). Core only: Atlas, Canvas and Agents are untouched.

## What exists
- **Vendored skill** `core/skills/builtin/taste-skill/` = github.com/Leonxlnx/taste-skill `skills/taste-skill` at commit `f624f37a8c650b9cc550253104925efe4c8de246`, MIT, unedited (plus LICENSE and IMPORT.md). Never track main; update by hand (new commit, re-run tests, edit IMPORT.md). Wrapper outside the folder: `core/skills/wrappers/chrome` (adds `--no-sandbox`).
- **Loader** `src/lib/core-skills/builtin.ts`: index from SKILL.md frontmatter, `loadBuiltinSkill` (wrapped in `<skill name=... source=...>`, labelled as data), `readSkillFile` (blocks `..`, absolute paths, backslashes, NUL, links out of the folder, non-text types). Built-ins have no 20 KB cap. On/off per person: `src/lib/core-skills/settings.ts` (table `skill_settings`).
- **Assistant tools** (`connect-tools.ts`): `list_skills` (folder skills marked `folder`, `available`), `load_skill`, `read_skill_file`, and `sandbox_exec`, `sandbox_read_file`, `sandbox_write_file`, `sandbox_list_files`, `view_image`, `run_step`. Sandbox tools find the sandbox only through the person's own running build, never an id the model gives. `publish_preview` is NOT built (optional in the brief).
- **Sandbox** `src/lib/sandbox/`: `types.ts` (the provider interface), `fake-local.ts` (tests only, refuses in production, NOT a security boundary), `index.ts` (`SANDBOX_PROVIDER`; only `fake-local` exists, so in production builds say "not available"), `runs.ts` (start/confirm, step charging, caps, end + save zip to R2, sweep), `tools.ts` (audited tool calls), `zip.ts`. Tables `sandbox_runs`, `sandbox_audit` (commands cut to 500 chars, no output stored).
- **Routes** `GET/POST/PATCH /api/core/sandbox-runs` (estimate and runs, start with `confirm: true`, on/off switch), `POST/GET /api/core/sandbox-runs/<id>` (stop, download link). The daily cron also sweeps overdue or idle runs.
- **UI** `src/components/skills/TasteSkillRow.tsx` in Skills > Explore: "Built in" badge, switch, cost note, source text, Start with a cost confirm, step list, Stop, download, picture credits. Tagged Soon while no provider is set.

## Config values (all PROVISIONAL)
`SANDBOX_PROVIDER` (unset = off), `SANDBOX_REQUIRE_PAID` (default on; `off` for owner tests; "paid" = at least one PURCHASE ledger row), `SANDBOX_MAX_RUN_MINUTES` 60, `SANDBOX_MAX_TURNS` 400 (tool calls), `SANDBOX_RUN_CREDIT_CAP` 1200, `SANDBOX_MAX_PER_USER` 1, `SANDBOX_MAX_GLOBAL` 5, `SANDBOX_IDLE_MINUTES` 20, `TASTE_CREDITS_PLAN` 100, `TASTE_CREDITS_BUILD` 600, `TASTE_CREDITS_REVIEW` 150 (each review round). Charged only when `CREDITS_ENABLED=1`.

## NOT built (needs the owner or later phases)
- **A real sandbox provider** (phase 3): the owner chooses (E2B, Modal, a small VPS...) and records price. Needs Node 22+, Chromium (the wrapper looks for `$SANDBOX_CHROME`, `/usr/bin/chromium`, `chromium-browser`, `google-chrome`), HTTPS egress. Then implement `SandboxProvider` and add it to `index.ts`. Smoke: `draw.mjs --list sectors`, `lint.mjs`, `inspect.mjs` (these pass on the fake provider here).
- Live screenshots in the run view, `publish_preview`, egress allowlist (phase 5), evals run, a Core "resume" view after a closed tab (the run itself lives server-side, the panel re-reads it).
- Run orchestration is the assistant's own tool loop (`/api/connect/chat`, 48 s budget per turn): a 30 to 45 minute build is many turns; a worker that continues without the browser is NOT built.

## Findings from running the skill's scripts locally (evidence in `tests/integration/core-sandbox.test.ts`)
- `draw.mjs --list sectors` prints one id per line (saas, dev-tool, ...); `--sector` is required otherwise.
- `lint.mjs <file>` prints a block ending `RESULT: n FAIL, n WARN`, exit 0 on a clean file.
- `inspect.mjs <file|url> --out DIR` prints a report and writes `desktop-fold.jpg`, `tablet-fold.jpg`, `mobile-fold.jpg`, `*-page-01.jpg` and `report.json` (widths 1440, 768, 390). It finds Chrome only through `CHROME_PATH` or fixed paths and does NOT pass `--no-sandbox`: as root it fails ("Running as root without --no-sandbox"). The wrapper fixes this. ~11 s for a one-line page.
- `assets.mjs --credits` reads `assets/credits.json` and prints "No pictures recorded..." (exit 0) when empty, so the end of a run only saves credits when that file exists.
- Not verified: `assets.mjs` network search (sandbox has no access to the open collections), token use of a real build, any real sandbox image.
