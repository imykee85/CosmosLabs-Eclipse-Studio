# Eclipse MCP: connect Eclipse to Claude (2026-10-29)

Eclipse is an MCP server at `https://eclipse.cosmoslabsai.com/api/mcp` (Streamable HTTP, JSON answers). It acts as the person who made the key, in their personal workspace, through the same code as the app (plan locks, credit holds, prices, moderation, daily limits).

## Connect
1. Settings, API/MCP: make a key (`ecl_...`, shown once). Needs a paid plan.
2. Claude Code: `claude mcp add --transport http eclipse https://eclipse.cosmoslabsai.com/api/mcp --header "Authorization: Bearer ecl_..."`
3. Other clients that accept a header: the JSON shown in Settings. NOT YET SUPPORTED: claude.ai's own custom connectors and Claude on the phone, which sign in with OAuth; Eclipse has no OAuth sign-in for MCP (keys only). If the owner wants those, an OAuth flow must be built.

## Tools
`list_models`, `generate_image`, `generate_video`, `get_render`, `list_renders`, `get_credits`, and (2026-10-29) `ask_atlas` and `ask_core`.
- `ask_atlas { message, history?, pictures?, draft_prompt?, agent? }`: Atlas plans and writes prompts (JSON, Seedance, scene direction, pictures it is shown). It keeps no chat on the server: send earlier turns in `history`. It NEVER renders; it returns `reply` and `suggestions` (a prompt to use, a render proposal, choices). Render with `generate_image` / `generate_video`. Growth plan or higher; charged like an Atlas reply in the app.
- `ask_core { message, chat_id?, project_id?, model?: auto|lite|pro|max, image_ids? }`: Core's chat (memory, skills, connected apps, can make pictures). Returns `reply`, `chat_id` (pass it back to continue), `renders_started` (poll with `get_render`). Growth plan or higher; the plan's daily Core limit applies; charged like a Core reply.

## Slash commands (MCP prompts)
`image`, `video`, `atlas`, `storyboard` (Atlas writes a timed Seedance 2.5 prompt, then offers to render it), `core`, `balance`. In Claude Code: `/mcp__eclipse__image <idea>` and so on. Defined in `src/lib/mcp-prompts.ts`.

## Code
`src/lib/mcp.ts` (protocol, tools), `src/lib/mcp-agents.ts` (Atlas and Core), `src/lib/mcp-prompts.ts`, `src/lib/agent-turn.ts` (Atlas's turn, shared with `/api/agent/chat`). Tests: `tests/integration/mcp-agents.test.ts`, `tests/integration/api-mcp.test.ts`.

## Not verified
Against the live site (the sandbox cannot reach it): a real client connection, Atlas and Core answers on the live Anthropic account, how Claude Code shows the slash commands. A long Core turn can take up to about 50 s; the MCP route allows 300 s.
