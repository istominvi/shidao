# Course Builder MCP (development/internal)

ShiDao Course Builder MCP is a local `stdio` server for development. It is not
an HTTP endpoint and must not be published externally during the first V2
milestone.

The server is a thin adapter:

`MCP tool → canonical Zod contract → CourseBuilderApplicationService → user-JWT repository → Supabase RLS`

It does not query tables directly. Component JSON Schema is generated from the
same code-first registry used by the application UI and service.

## Tools

- `course.create_draft`
- `course.get`
- `course.add_lesson`
- `lesson.add_step`
- `lesson.add_component`
- `lesson.reorder_component`

Only these six tools are registered.

## Credentials

The server requires four environment variables for a tool call:

- `NEXT_PUBLIC_SUPABASE_URL` — current self-hosted ShiDao Supabase URL;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon/publishable key;
- `SHIDAO_MCP_SUPABASE_ACCESS_TOKEN` — short-lived access token of the teacher;
- `SHIDAO_MCP_AUTH_USER_ID` — UUID of that same Supabase Auth user.

Never use or pass a secret/service-role key. Never commit a user token. Avoid
loading the whole `.env.local` into the MCP process: export only the four values
above.

On every tool invocation the server calls `supabase.auth.getUser(accessToken)`,
checks that the verified user ID equals `SHIDAO_MCP_AUTH_USER_ID`, checks the
project-wide session cutoff, and then creates the existing user-JWT repository.
All database authorization remains enforced by the current ownership RLS.

Credentials are intentionally resolved lazily. The server can start and list
tools without a token, but an actual call returns a configuration error until
all four values are present. Replace an expired access token and restart the MCP
process; do not add refresh tokens to this integration.

## Run and connect

With the four values exported in the environment:

```bash
npm run mcp:course-builder
```

The committed project-local `.codex/config.toml` starts this command and
forwards only the four explicit variables. Codex loads project MCP settings only
for a trusted repository; restart the task/app after changing its environment.
The config is optional (`required = false`), so absent credentials do not block
normal repository work. It also uses the `writes` approval mode: `course.get`
is marked read-only, while every tool that persists data requires confirmation
from the MCP host. The `cwd` is pinned to this development checkout
(`/Users/user/Documents/shidao`); update it if the repository is moved.

Run the MCP tests with:

```bash
npm run test:compile
node scripts/run-node-tests.mjs --include course-builder/mcp
```

The tests use an in-memory MCP client/transport to verify registration and tool
calls. They do not write to the production database.

## AI provider boundary

This MCP server does not call OpenRouter and does not generate lesson content.
A future OpenRouter integration should orchestrate these same tools/application
contracts with a server-side provider key. Until that adapter exists, the UI
must not claim that a lesson was generated or an attachment was analyzed by AI.
