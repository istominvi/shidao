# Документация ShiDao

## Start here

- [README](../README.md) — быстрый запуск и карта проекта.
- [Auth и routing](./authorization-routing.md)
- [Доменная модель](./domain-model.md)

## Архитектура

- [Teacher group-centric IA](./architecture/teacher-group-centric-ia.md)
- [Lesson content model](./architecture/lesson-content-model.md)
- [Lesson three-part model](./architecture/lesson-three-part-model.md)
- [Homework runtime model](./architecture/homework-runtime-model.md)
- [Communication runtime model](./architecture/communication-runtime-model.md)

## Database / migrations

- SQL migration history: `supabase/migrations/*`
- [Current schema guide](./database/current-schema.md)
- [Current schema SQL snapshot](../supabase/schema/current-schema.sql)
- [Migration history policy](./database/migration-history.md)
- [Schema hygiene note (2026-04-12)](./database/schema-hygiene-2026-04-12.md)

## Deployment / auth operations

- [Email auth runbook (self-hosted Supabase)](./email-auth-selfhosted-supabase.md)

## Testing

- Commands: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
- Node-based test runner: `scripts/run-node-tests.mjs`

## Refactors

- [Repo cleanup audit (2026-04-12)](./refactors/repo-cleanup-audit-2026-04-12.md)
