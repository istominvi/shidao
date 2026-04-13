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
