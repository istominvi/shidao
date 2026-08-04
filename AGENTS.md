# AGENTS instructions for ShiDao

## Scope

These instructions apply to the entire repository.

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

## Lesson workflow policy

Before changing Course, lesson plan, Student Screen, homework, component, or
course-material docs/code, read:

- `docs/architecture/lesson-workflow-model.md`

Policy:

- The canonical authored hierarchy is `Course → Lesson → ordered Components`.
- A Lesson owns one ordered component list. Do not introduce `Lesson Step`, a
  hidden/root step, `stepId`, or step-backed compatibility behavior.
- The Lesson title and teacher comment are Lesson fields, not required heading
  components.
- The teacher plan renders the complete ordered list. `Student Screen` /
  `Экран ученика` renders only `learner_visible` components while preserving
  their relative Lesson order.
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
