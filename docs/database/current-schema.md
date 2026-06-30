# Current database schema (agent-first guide)

This guide describes the **current** ShiDao database model.

## Read order for DB tasks

1. `docs/database/current-schema.md` (this file)
2. `supabase/schema/current-schema.sql`
3. `supabase/migrations/*` (only when historical/compat analysis is needed)

## Core entities (current model)

### Identity and school scope

- `parent` — parent profile linked to `auth.users`.
- `teacher` — teacher profile linked to `auth.users`.
- `school` — school/org container (`kind = personal | organization`, owner, teacher limit, demo plan fields).
- `school_teacher` — teacher membership in school (`owner | teacher`).
- `class` — group inside school, with immutable `methodology_id` after creation.
- `class_teacher` — teacher assignment to class.
- `student` — learner profile (`login`, `internal_auth_email`, optional linked `auth.users` row, optional `parent_id`).
- `class_student` — student membership in class.

### User preference and security

- `user_preference` — `last_active_profile`, selected school, theme/settings.
- `user_security` — PIN hash + lock/attempt metadata, plus `sessions_invalid_before` (per-user app-session revocation cutoff).

### Methodology source layer

- `methodology`
- `methodology_lesson`
- `reusable_asset`
- `methodology_lesson_block`
- `methodology_lesson_block_asset`
- `methodology_lesson_student_content`
- `methodology_lesson_student_content` currently represents learner-facing source-layer lesson content; future live sync/telemetry may require additional runtime fields/tables (not part of this documentation-only task).

### Runtime lesson + homework + communication

- `scheduled_lesson` — runtime lesson instance bound to class + source lesson.
- `methodology_lesson_homework` — canonical homework attached to source lesson.
- `scheduled_lesson_homework_assignment` — issued homework for a runtime lesson.
- `student_homework_assignment` — per-student status/submission/review.
- `group_student_conversation` — continuous class+student communication channel.
- `group_student_message` — messages with optional lesson/homework context links (text body can be null for voice/file-only messages).
- `lesson_group_conversation` — one shared chat thread per scheduled lesson.
- `lesson_group_message` — lesson-scoped group chat messages (teacher/student authorship, supports voice-only entries).
- `communication_message_attachment` — message attachments metadata (voice now, files later) with private Storage pointer.
- `notification` — in-app runtime notifications with read/unread state for teacher/parent/student recipients.

## Key invariants

- `class.methodology_id` is required on insert and immutable after group creation (legacy rows may still be null).
- `scheduled_lesson` enforces online/offline format constraints (`meeting_link` vs `place`).
- `scheduled_lesson` runtime live-step state uses `runtime_current_step_id` + fallback `runtime_current_step_order`, plus lock/timestamps (`runtime_student_navigation_locked`, `runtime_step_updated_at`, `runtime_started_at`, `runtime_completed_at`).
- `methodology_lesson_homework.kind` supports `practice_text | quiz_single_choice`.
- `reusable_asset.kind` supports legacy + semantic kinds: `video | song | worksheet | vocabulary_set | activity_template | media_file | presentation | flashcards_pdf | lesson_video | worksheet_pdf | song_audio | song_video | pronunciation_audio`.
- `student.login` and `student.internal_auth_email` are unique.
- `school.kind = 'personal'` is the personal teacher workspace (shown as `Лично` in UI).
- `school.kind = 'organization'` is a real school/org (shown as `Школа` in UI).
- `user_preference.last_selected_school_id` stores selected organization; `null` means personal mode.
- App sessions are stateless encrypted cookies carrying an `iat`. `user_security.sessions_invalid_before` is a per-user revocation cutoff: any session with `iat` before it is treated as logged out (enforced in `resolveAccessPolicy`). The `revoke_user_sessions(p_user_id, p_cutoff)` RPC bumps it (used on password reset / "log out everywhere"); the global `APP_SESSION_VERSION` env remains a separate all-users kill-switch.

## Demo organization behavior (MVP)

- Teacher always has a personal workspace and lands in personal mode by default.
- Creating a school creates `school.kind = 'organization'` + `school_teacher(role='owner')`.
- Demo invite flow is immediate membership add for existing users (no pending invite yet).
- If email is not registered, API returns a validation message and does not create pending invitation rows.
- TODO (future): pending invite + in-app/email/Telegram notification + explicit accept before activation.

## Source-of-truth distinctions

- **Source layer:** methodology tables (`methodology*`, `reusable_asset`).
- **Runtime layer:** scheduled lessons, homework assignments, communication.
- App behavior depends on this distinction (read-only source content + mutable runtime execution data).

## Auth/profile model (current)

- Adult identity is split into explicit profile tables (`teacher`, `parent`) tied to `auth.users`.
- Student can authenticate via internal login mapping (`student.internal_auth_email`) and may also have `student.user_id` when linked.
- RLS identity/membership helpers are `SECURITY DEFINER` (their internal reads bypass RLS — required to avoid policy recursion): `current_teacher_id`, `current_parent_id`, `current_student_id`, plus membership predicates `is_class_teacher`, `is_class_student`, `parent_in_class`, `can_read_class`, `is_my_child`, `teaches_student`, `parent_in_school`, and the lookup `scheduled_homework_class_id`.

## Row-level security (RLS)

RLS is enabled on all 24 application tables (off only on `user_preference`/`user_security`, reached exclusively via SECURITY DEFINER RPCs). Since migration `202606300002` **every** RLS-enabled table has at least one policy — there are no remaining "RLS-on / 0-policies" tables.

- **Defense-in-depth, not the primary control.** The app always connects as `service_role` (`BYPASSRLS`), so policies do not change app behavior. They deliver real tenant isolation only if a PostgREST/Realtime surface is ever exposed with `anon`/`authenticated` keys. The primary access control remains `resolveAccessPolicy()` in app code.
- **Reads only.** Policies are `FOR SELECT` (plus the pre-existing narrow self-`UPDATE` on `parent`/`teacher`/`student`/`notification`). No `INSERT`/`UPDATE`/`DELETE` policies on runtime/content tables — all writes go through `service_role` / SECURITY DEFINER RPCs.
- **Grants.** Each policied table does `revoke all from anon, authenticated; grant select to authenticated`. `anon` has no table grants (schema-usage only) and sees nothing.
- **Membership model.** Visibility is computed via the SECURITY DEFINER helpers above, which bypass RLS internally so policies never read the mutually-recursive graph tables (`class_teacher`/`class_student`/`student`) directly:
  - Runtime layer (`scheduled_lesson`, homework assignments, conversations, messages, attachments) is scoped to the class/student: teacher of the class, the enrolled student, or the parent of an enrolled child (`can_read_class` / `is_class_teacher` / `is_my_child`). Messages/attachments are visible iff their parent conversation/message is.
  - Methodology/content layer (`methodology*`, `reusable_asset`) is a **shared global catalog**: readable by any `authenticated` user (`USING (true)`, scoped `to authenticated`), denied to `anon`. There is no school-ownership column, so per-school content isolation is not currently expressible (would require a schema change).
- **Recursion fix (202606300002).** The identity helpers were `SECURITY INVOKER` and the covered-table policies referenced one another, so reads under `authenticated` raised `stack depth limit exceeded`. The migration converts the helpers to `SECURITY DEFINER` and rewrites the covered-table predicates to use them (behavior-preserving; `service_role` unaffected).

## Compatibility / legacy notes

- Migration chain contains legacy transitions (`adult/adult_role` epoch, organization->school refactor).
- Some old migrations contain bootstrap/content inserts; they are preserved intentionally for upgrade safety.
- Snapshot files describe **current state** and should be preferred for day-to-day schema reasoning.

## When to consult migrations anyway

Use `supabase/migrations/*` when you need:

- to write a new migration,
- to understand legacy behavior/backfills,
- to debug migration order/idempotency,
- to evaluate rollback/reset behavior,
- to confirm historical introduction/removal of constraints/functions.

## Snapshot refresh workflow

Preferred (if DB access + pg_dump are available):

```bash
DATABASE_URL='postgresql://...' npm run db:snapshot
```

If not available in your environment:

- update `supabase/schema/current-schema.sql` manually based on latest applied migrations,
- call out manual refresh in PR notes,
- do **not** rewrite migration history.
