# Migration guidelines (schema hygiene)

> Do not use legacy aliases/duplicate docs as the current source of truth.

Canonical current-schema references:

1. `docs/database/current-schema.md`
2. `supabase/schema/current-schema.sql`

## Goal

Keep migration history reliable while reducing coupling between schema evolution and product/bootstrap content.

## Rules for new migrations

### 1) Prefer schema-only migrations

Default expectation: migration files in `supabase/migrations/*` should focus on:

- DDL changes (tables, columns, constraints, indexes, functions, RLS policies),
- safe compatibility backfills required for the new schema to function.

Avoid mixing product copy, lesson content, or UX bootstrap payloads into schema migrations.

### 2) Data migrations are acceptable only when required

Data updates inside migrations are acceptable when they are required for correctness or compatibility, for example:

- backfilling required values for newly-added NOT NULL constraints,
- transforming data to keep runtime reads valid after schema changes,
- fixing security constraints/policies that protect existing data.

If data work is not required for schema correctness, it should not be in the migration.

### 3) Product/bootstrap content should live separately

Seed/bootstrap content should go through explicit app/bootstrap paths (for example service scripts or dedicated bootstrap modules), not historical schema migrations.

Current repository anchor for content bootstrap behavior:

- `src/lib/server/lesson-content-bootstrap.ts`

If additional seed paths are added, document them in `docs/index.md` and keep them idempotent.

### 4) Never rewrite historical migrations

Historical migrations in `supabase/migrations/*` are immutable audit history.

- Do not delete old migrations.
- Do not rewrite old migrations.
- Apply new corrective migrations instead.

## Practical checklist for PRs

- [ ] schema change explained in PR and reflected in migration SQL;
- [ ] `docs/database/current-schema.md` updated if current model changed;
- [ ] `supabase/schema/current-schema.sql` snapshot refreshed if current model changed;
- [ ] product/content bootstrap changes implemented outside migration chain where possible;
- [ ] migration history left intact.
