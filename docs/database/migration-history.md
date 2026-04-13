# Migration history policy

ShiDao intentionally keeps **both** layers:

1. `supabase/schema/current-schema.sql` + `docs/database/current-schema.md` for understanding the current model quickly.
2. `supabase/migrations/*` for historical evolution and schema change authoring.

## Why both exist

- Snapshot/docs reduce context waste for developers and coding agents.
- Migration history preserves real upgrade path, backfills, and compatibility decisions.
- We do not replace or squash history in routine cleanup work.

## Practical rule

- Read snapshot/docs first for current-state work.
- Read migrations when work is migration-sensitive (new migration, legacy/backfill debugging, rollback/reset analysis).
