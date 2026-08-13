# Course Builder MCP (development/internal)

**Статус:** реализован и протестирован; local `stdio`, без external endpoint
**MCP implementation baseline:** `808510e`

ShiDao Course Builder MCP is a local `stdio` server for development. It is not
an HTTP endpoint and must not be published externally without a separately
implemented OAuth/scopes/audit/rate-limit security layer.

The server is a thin adapter:

`MCP tool → canonical Zod contract → CourseBuilderApplicationService → user-JWT repository → Supabase RLS`

It does not query tables directly. Component JSON Schema is generated from the
same code-first registry contracts used by UI and service. The current React
payload editor is switch-based; renderers use a separate exhaustive typed map
over the same `ComponentTypeKey`. Neither becomes a duplicated MCP schema.

## Tools

- `course.create_draft`
- `course.get`
- `course.add_lesson`
- `lesson.add_component`
- `lesson.set_component_student_screen`
- `lesson.reorder_component`

Only these six tools are registered.

The canonical authoring contract is `Course → Lesson → ordered Components`:

- `lesson.add_component` accepts `lessonId` and the registry payload/placement;
  every new Component is contractually `staff_only` and has no Slide assignment;
- the application service creates the Component directly in the Lesson and
  appends it to that Lesson's single ordered component list;
- `lesson.set_component_student_screen` accepts `hide`, `existing + slideId`,
  or `new` and delegates the atomic legal assignment to the application service;
- `lesson.reorder_component` moves a Component within the whole Lesson list and
  the database clamps any visible assignment to its legal neighboring Slides;
- learner projection omits teacher fields and staff-only Components, then groups
  visible Components by ordered Student Screen Slide while preserving Lesson
  component order inside each Slide.

There is no Lesson Step/root Step compatibility layer. MCP input/output does
not expose `stepId`, and no step tool is registered. Active V2 does not expose
Methodology entities through this server.

## Credentials

The server requires four environment variables for a tool call:

- `NEXT_PUBLIC_SUPABASE_URL` — current self-hosted ShiDao Supabase URL;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon/publishable key;
- `SHIDAO_MCP_SUPABASE_ACCESS_TOKEN` — short-lived access token of the Course
  owner Account;
- `SHIDAO_MCP_AUTH_USER_ID` — UUID of that same Supabase Auth user.

Never use or pass a secret/service-role key. Never commit a user token. Avoid
loading the whole `.env.local` into the MCP process: export only the four values
above.

On every tool invocation the server calls `supabase.auth.getUser(accessToken)`,
checks that the verified user ID equals `SHIDAO_MCP_AUTH_USER_ID`, checks the
project-wide session cutoff, and then creates the existing user-JWT repository.
Database authorization remains tied to the same user JWT. Ordinary reads and
authoring fields use ownership RLS; the serialized Student Screen assignment
and reorder RPCs use an explicit `auth.uid()` → Account → Course ownership
check inside their narrow database boundary.

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

The tests use an in-memory MCP client/transport to verify exact six-tool
registration, registry-derived JSON Schema and tool calls. They do not write to
the live ShiDao database.

## Implementation map

```text
scripts/course-builder-mcp.ts                 stdio entrypoint
src/modules/course-builder/mcp/runtime.ts     actor/session resolution
src/modules/course-builder/mcp/server.ts      MCP server registration
src/modules/course-builder/mcp/tools.ts       six tools + generated schemas
src/modules/course-builder/service.ts         application commands
src/modules/course-builder/repository.ts      user-JWT Supabase adapter
src/modules/course-builder/registry/contracts.ts
.codex/config.toml                            project-local optional server
```

The MCP package has no HTTP route under `src/app/api`. Adding one is not a
deployment shortcut: external access requires a separately approved security
design.

## AI provider boundary

This MCP server still does not call an AI provider or generate lesson content.
The current production RouterAI integration is a separate server-side web
orchestration layer: it reuses the same application service/registry contracts
directly, without starting this `stdio` transport or inventing a static MCP
actor.

Course and Lesson generation use validated preview → explicit Apply; the
compatibility course-scoped assistant is read-only and does not call MCP tools.
The global System Assistant is a separate signed-confirmation web flow and also
does not call this development MCP transport. Attachments remain metadata only
until a separate parsing pipeline succeeds. Provider-compatible flat
structured output is an AI transport detail: it is converted back into the
canonical registry-backed plan before Apply and is not reused as an MCP schema.
The canonical boundary and deployment state are documented in
[`docs/architecture/ai-provider-integration.md`](../architecture/ai-provider-integration.md).

Do not add RouterAI keys to MCP input schemas, browser environment, logs or
committed config. `ROUTERAI_API_KEY` belongs only in the production web
runtime's server-side secret environment.
