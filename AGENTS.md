# AGENTS instructions for ShiDao

## Scope

These instructions apply to the entire repository.

## Required orientation

Before broad product, architecture, or implementation work, read in order:

1. `docs/project-state.md` — what is actually implemented and where;
2. `docs/roadmap.md` — agreed direction and sequencing;
3. the canonical document for the area being changed.

Strategic/future documents do not prove that a capability exists. When they
conflict with `docs/project-state.md`, inspect the code and current schema, then
update the documentation in the same change.

## Database context policy (important)

For database-related tasks, treat these as the **primary source of truth for current schema**:

1. `docs/database/current-schema.md`
2. `supabase/schema/current-schema.sql`

### Migration history role

- `supabase/migrations/*` is historical schema evolution.
- Do **not** read the full migration chain by default for every DB task.

Read migrations only when the task explicitly involves:

- writing a new migration,
- understanding legacy behavior,
- compatibility/backfill concerns,
- debugging migration history,
- rollback/reset analysis.

## Safety rules

- Never delete or rewrite old migrations unless explicitly requested.
- Keep current-schema snapshot/docs updated when DB model changes.
- Before any database write, run a read-only identity/schema sanity check and
  confirm that the target is the current ShiDao database.
- Use only project-local database access defined by this workspace. Never use a
  random/global database MCP connection.
- Never use the ignored legacy `enviromnent/db-mcp-cheatsheet.md`; it contains
  stale V1 instructions and historical plaintext credentials pending separate
  rotation. Do not print or copy its contents.
- Do not mass-reset `public` as part of ordinary V2 development.
- Do not change Auth, SMTP, JWT/API keys or base Storage configuration unless
  the user explicitly expands the task.
- Current Account preference/security and learner-identity relations use the
  audited RLS/closed-ACL contract. Do not restore legacy `user_preference` /
  `user_security` dual-write or copy their historical broad-grant pattern.

## Lesson workflow policy

Before changing Course, lesson plan, Student Screen, homework, component, or
course-material docs/code, read:

- `docs/architecture/lesson-workflow-model.md`

Before changing assessable components, learner responses, teacher observations,
learning evidence/profile state, adaptive behavior, voice/pronunciation or
activity telemetry, also read:

- `docs/architecture/learning-activity-system.md`

Policy:

- The canonical authored hierarchy is `Course → Lesson → ordered Components`.
- A Lesson owns one ordered component list. Do not introduce `Lesson Step`, a
  hidden/root step, `stepId`, or step-backed compatibility behavior.
- The Lesson title and teacher comment are Lesson fields, not required heading
  components.
- The teacher plan renders the complete ordered list. `Student Screen` /
  `Экран ученика` renders persisted Slides in slide order and only their
  assigned `learner_visible` components, preserving relative Lesson order
  inside each Slide. Slides are a presentation projection, not authored Steps
  or a second component order.
- Keep teacher-private data out of learner projections; hiding it with CSS is
  not sufficient.
- Course materials are course-wide attachments. They are not a lesson surface
  and must not be described as analyzed until parsing/RAG actually succeeded.
- Homework is a separate Lesson surface and is not encoded as a component
  group.
- Active V2 code and docs must not depend on Methodology entities, fixtures, or
  lesson-specific renderers. V1 methodology data exists only in immutable
  archive/recovery sources unless an explicit import task is approved.
- UI, application services, and development MCP use the same component
  registry contracts. MCP remains an adapter over services, never tables.
- During a future live lesson, free learner navigation must not become the
  default merely because full-course preview offers lesson navigation.
- Do not add migrations unless the task explicitly asks for DB implementation.

## Current product boundary

- Working application: `v2.shidao.ru`.
- `shidao.ru` and `www.shidao.ru` remain landing-only; internal pages and APIs
  are closed there.
- Current middleware enforces the explicit host allowlist: V2 application/API
  only on `v2.shidao.ru`, landing-only behavior on `shidao.ru`/www, isolated
  reference/demo hosts, and fail-closed unknown routed hosts.
- Current CSRF guard accepts unsafe production requests only from exact Origin
  `https://v2.shidao.ru`; landing, cross-subdomain and missing Origin fail
  closed. Preserve the host/Origin regression coverage when changing routing.
- Continue in the current repository, `main`, Coolify application and
  self-hosted Supabase unless the user explicitly decides otherwise.
- V1 recovery refs and `.local-backups/v1-snapshot-2026-08-03` are immutable.
  Never restore V1 without a separate explicit command.
- The tracked archive `archive/content/world-around-me-2026-08-04/` is a source
  for a future importer only. Active code must not import from it at runtime.

## Documentation maintenance

Every completed vertical slice must update, in the same work:

- `docs/project-state.md` for implemented behavior and code/schema locations;
- `docs/roadmap.md` for changed priorities;
- the relevant architecture/product/operations document;
- `docs/database/current-schema.md` and
  `supabase/schema/current-schema.sql` when the physical schema changes.

Use explicit status language: **current**, **next**, or **later**. Do not write
planned AI, parsing, Homework, live, learner, billing, or external MCP behavior
as if it already exists.

## Automatic Git delivery

For tasks that request implementation or repository changes, after the
implementation, required documentation, and task-relevant checks are complete:

1. Review the final diff for scope, secrets, generated artifacts, and unintended
   changes.
2. Stage only the files or hunks that belong to the current task; preserve
   unrelated worktree changes.
3. Create one descriptive commit without waiting for additional confirmation.
4. Push the current branch to its configured upstream with a normal
   fast-forward push, then report the commit and push result.

Current ShiDao product work normally stays on `main`. When already on `main`,
push `main` directly so Coolify can pick up the release; do not create a feature
branch or pull request unless the user explicitly asks for one.

Do not turn review, diagnosis, planning, or other read-only tasks into commits.
Follow any explicit user boundary exactly: `do not commit` means leave the
changes uncommitted; `commit but do not push` means create only the local
commit; `keep this local` means do not push and do not infer permission to
commit when the wording is ambiguous.

Do not automatically commit or push incomplete work, changes whose relevant
checks fail or cannot be completed, diffs containing secrets or unintended
artifacts, or task changes that cannot be safely separated from unrelated user
work. Report the blocker and leave the worktree intact.

Never force-push, amend or rewrite existing commits, bypass branch protection,
change remotes, or automatically resolve remote divergence with merge or
rebase. If no upstream is configured, the remote is ahead or diverged, a normal
push would be non-fast-forward, or authentication, permissions, or branch
protection blocks the push, keep any safely created task commit local, stop,
and report the exact blocker.
