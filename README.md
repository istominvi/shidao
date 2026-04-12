# ShiDao MVP

ShiDao — role-aware educational MVP on Next.js + Supabase. The product model stays intentionally simple:

- methodology as source-of-truth,
- group + scheduled lesson as runtime container,
- homework and communication tied to lesson context,
- separate teacher/parent/student views under one auth/session contract.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Required environment

At minimum set:

- `APP_SESSION_SECRET` (32+ random chars)
- `APP_SESSION_VERSION` (default `1`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (or `SITE_URL`)

Generate secret example:

```bash
openssl rand -hex 32
```

## Runtime surfaces

- Marketing: `/`
- Auth: `/login`, `/join`, `/forgot-password`, `/reset-password`, `/auth/confirm`
- App: `/onboarding`, `/dashboard`, `/groups/*`, `/lessons/*`, `/methodologies/*`, `/settings/*`

Route groups:

- `src/app/(marketing)`
- `src/app/(auth)`
- `src/app/(app)`

## Local quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Repository map

- App routes: `src/app`
- UI components: `src/components`
- Domain/server logic: `src/lib`
- SQL migrations: `supabase/migrations`
- Docs index: [`docs/index.md`](docs/index.md)

## Documentation

Start here: [`docs/index.md`](docs/index.md)

Key docs:

- Architecture: `docs/architecture/*`
- Auth/session model: `docs/authorization.md`
- DB hygiene notes: `docs/db/*`
- Refactor/audit logs: `docs/refactors/*`

## Deployment notes

- Production Dockerfile is included (Next standalone build).
- Apply Supabase migrations before app start to avoid schema drift.
- Keep redirect/auth callback URLs aligned with `NEXT_PUBLIC_SITE_URL`.
