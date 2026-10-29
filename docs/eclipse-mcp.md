# Eclipse MCP: connect Eclipse to Claude (2026-10-29)

Eclipse is an MCP server at `https://eclipse.cosmoslabsai.com/api/mcp` (Streamable HTTP, JSON answers). It acts as the person who made the key, in their personal workspace, through the same code as the app (plan locks, credit holds, prices, moderation, daily limits).

## Connect
1. Settings, API/MCP: make a key (`ecl_...`, shown once). Needs a paid plan.
2. Claude Code: `claude mcp add --transport http eclipse https://eclipse.cosmoslabsai.com/api/mcp --header "Authorization: Bearer ecl_..."`
3. Other clients that accept a header: the JSON shown in Settings.
4. claude.ai and the Claude apps (2026-10-29, "Sign in with Eclipse", see below): Settings, Connectors, add a custom connector, address `https://eclipse.cosmoslabsai.com/api/mcp`, then Connect: Claude opens Eclipse's own sign-in and consent page; no key is needed. Connectors added on claude.ai show up in the phone app.

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

## Sign in with Eclipse (OAuth for the MCP, 2026-10-29)
Eclipse is its own OAuth 2.1 authorization server in the shape the MCP authorization spec asks for: `/.well-known/oauth-protected-resource` (also with the `/api/mcp` suffix) and `/.well-known/oauth-authorization-server` for discovery, `/oauth/register` (dynamic client registration, public clients), `/oauth/authorize` (a page: signs the person in with Clerk, checks the plan, shows what the app asks for, Allow or Cancel), `/oauth/token` (authorization code + PKCE S256 only; refresh tokens rotate), `/oauth/revoke`. `/api/mcp` answers 401 with `WWW-Authenticate: Bearer resource_metadata=...` so a client knows where to sign in, and accepts `Authorization: Bearer eca_...` (OAuth access token, 1 hour) next to `ecl_...` keys. Code: `src/lib/oauth.ts` (all rules), `src/lib/oauth-http.ts`, `src/lib/mcp-auth.ts`, `src/app/oauth/*`, `src/app/.well-known/*`, `src/app/api/oauth/{approve,grants}`, `src/components/oauth/Consent.tsx`; tables `oauth_clients`, `oauth_codes`, `oauth_grants` (check `db-push: applying`).
- SECURITY RULES: only hashes of codes and tokens are stored; a code is single use, 5 minutes, bound to the app, return address and PKCE challenge, and replaying one revokes the grant it made; a replaced refresh token that is shown again revokes the grant; return addresses are checked against a list (claude.ai, claude.com, loopback for tools on the person's computer, cursor/vscode schemes; more hosts: Config value `OAUTH_REDIRECT_HOSTS`, comma separated) at registration AND at every authorization; a bad app or return address is shown to the person and never redirected to; the approve request must come from our own page (same Origin, JSON) with a signed-in session; sign-in may return only to `/oauth/authorize?...` (`src/lib/safe-next.ts`); registration 30 an hour per address, token 120 a minute per app, approvals 20 an hour per person; tokens act in the person's personal workspace, need the API plan (Starter+), and stop when the plan lapses; the person can disconnect an app in Settings, API/MCP (list in `/api/oauth/grants`).
- NOT VERIFIED against the real Claude (the sandbox cannot reach the live site or claude.ai): the real connect flow end to end, Claude's registration request (its redirect address is assumed to be `https://claude.ai/api/mcp/auth_callback` or `claude.com`; if Claude uses another host the registration is refused: add it to `OAUTH_REDIRECT_HOSTS` or the list in `oauth.ts`), and the Clerk sign-in round trip with the `next` return path (the sign-up path goes to onboarding and loses the connection: connect again afterwards).
