# Auth and routing

## Domains

- `shidao.ru` and `www.shidao.ru` expose only the public landing and its
  landing assets. Auth, API, and internal pages are unavailable there.
- `v2.shidao.ru` is the working application.
- Local development uses the same application routes without the host split.

## Entry flow

1. A guest opens `/login` or `/join`.
2. An authenticated adult without a profile is sent to `/onboarding`.
3. An authenticated user with a profile is sent to `/courses`.
4. A student identity is also sent to `/courses`; learner-specific course
   enrollment is a later product slice.

Safe relative `next` values are preserved. Absolute and protocol-relative
redirect targets are rejected.

## Active private routes

- `/onboarding`
- `/courses`
- `/courses/new`
- `/courses/[courseId]`
- `/courses/[courseId]/student-preview`
- `/settings/profile`
- `/settings/security`

The removed dashboard, group, scheduled-lesson, methodology, notification and
team-management pages are not compatibility routes.

## Authorization boundaries

- The app session identifies the Auth user and existing profile context.
- Course Builder obtains a short-lived Supabase user JWT and performs normal
  browser/database operations under RLS.
- Course ownership is resolved through `account.auth_user_id = auth.uid()`.
- Student Screen is an explicit server-side projection; teacher-only fields and
  `staff_only` components are not returned.
- A service-role key is never used by ordinary Course Builder browser or MCP
  requests.

## Session revocation

Encrypted app sessions carry an issue time. `user_security.sessions_invalid_before`
is the per-user cutoff used by the current access policy and Course Builder MCP.
`APP_SESSION_VERSION` remains the global all-user invalidation mechanism.
