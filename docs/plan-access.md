# Plan access: who can use what (owner decisions 2026-10-21)

One table, `src/lib/access-table.ts` (browser and server). Server checks and lookup: `src/lib/access.ts`.

| Feature (code name) | Free | Starter | Growth | Scale |
| --- | --- | --- | --- | --- |
| 2 free images | yes | yes | yes | yes |
| Image Studio (credits decide after the free ones), Library, Assets | | yes | yes | yes |
| Video and Audio Studios (`studios`) | locked | yes | yes | yes |
| Treatment and Prompts (`plan_tools`) | locked | yes | yes | yes |
| Certificates, Portfolio publish, Academy, API/MCP keys, Teams, top-ups | locked | yes | yes | yes |
| Atlas, Canvas, your own agents, Core (chat, skills, tools, memory, connectors) | locked | locked | yes | yes |
| Core daily messages | | | 150 a day (Config `CORE_DAILY_MESSAGES_GROWTH`) | no limit |
| Build-with-Core (sandbox build sessions, `builds`) | locked | locked | locked | yes |
| Automated workflows (`workflows`) | | | | SOON, nothing built |

Rules from the owner: a locked feature is SHOWN; the first use opens the upgrade pop-up (server answer HTTP 402 with `code: "UPGRADE"`, or the app opens it at once, e.g. switching Atlas on). Every plan includes the one before it. Everyone moves to this table (no grandfathering). Core uses all model tiers on every plan that has it; only the daily message count and builds differ. Teams are in every paid plan.

How the plan is found: `planOf(workspaceId)` = a plan the owner gave by hand (`BillingSettings.planOverride`, set in /admin/credits "Give a plan") else the latest recent plan payment on the workspace's ledger (note `Plan: Starter|Growth|Scale`, window `SUBSCRIPTION_DAYS` 33, ended by `subscriptionEndedAt`) else Free. A team uses the team's plan. The owner (`ADMIN_EMAILS`) is always Scale. `PLAN_GATING=off` (Config value) switches every check off.

Gates (all call `gateFeature` / `gateFeatureFor`): Atlas chat; Treatment and Prompts chat; Canvas create/save/delete and Polish prompt; own agents create; Certificates issue; Portfolio publish (taking a page down is always allowed); API key create and every API/MCP request; Core chat, user skills, memory writes, connectors connect; sandbox jobs (`KIND_FEATURE` in `src/lib/sandbox/runner.ts`: mux = plan tools, saved tools = Core, build session = Scale); `POST /api/video`, `/api/video/edit`, `/api/video/draft`, `/api/audio/generate` (studios). Client: `useAccess` / `allowedNow` / `askUpgrade` in `src/lib/use-access.ts`; Atlas's switch (`useAgent`) and the Team tab use them; the pop-up is `src/components/SubscribeAlert.tsx`.

Plan cards (landing Pricing and Settings > Billing): every paid card lists every benefit (`BENEFITS`), the ones the plan lacks greyed with a lock, "See more" / "See less" (`src/components/PlanBenefits.tsx`). The Free card is unchanged.

NOT done on purpose: Academy has no gate (nothing in it needs one yet); Portfolio draft saving and certificate viewing are not locked; image generation beyond the free ones is limited by credits, not by plan.
