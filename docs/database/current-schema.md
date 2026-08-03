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

### V2 Account and teacher Course Builder slice

- `account` — one application Account per `auth.users` row. Existing Auth users are bootstrapped by migration `20260803142924`; a locked-down Auth trigger creates future rows.
- `course` — an Account-owned editable Course draft. The first slice stores title, subject, goal, level, audience description, target lesson count and `teacher_preferences`; `audience_type` is intentionally limited to `none`.
- `lesson` — ordered Course lesson document.
- `lesson_step` — canonical ordered Lesson Step. Its title/position are shared by Teacher Side and Student Screen; `teacher_content` remains teacher-private, while the optional learner instruction lives in `settings.learnerInstruction`.
- `lesson_step_component` — ordered component placement with registry `type_key`, schema version, validated payload, placement config and visibility. Supported type keys are code-first and are not a database enum.
- `stored_file` — Account-owned metadata for an object in the private `course-assets` bucket (`pending | ready`).
- `course_attachment` — ownership-checked relation between a Course and a stored file.

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
- Course, Lesson and Lesson Step positions are positive and unique within their parent through deferrable constraints. Component order is changed atomically by `reorder_lesson_step_component`; delete triggers compact Lesson, Step and component positions in the same transaction.
- `course.assembled_at` records completion of the deterministic first-draft assembly. `assemble_course_draft` persists the validated Lesson/Step/component plan atomically and returns the same IDs on an idempotent repeat.
- The Student Screen API returns an explicit learner-facing projection: only `learner_visible` component placements and the learner instruction are exposed; teacher-private instructions are omitted from the response contract.
- `stored_file` is limited to 10 MiB, uses the `course-assets` bucket, and requires a SHA-256 checksum before becoming `ready`.
- Storage object paths start with the owning Account UUID; private `storage.objects` policies enforce that first path segment.

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

- V2 identity uses `account`, linked one-to-one to every `auth.users` row; existing users are backfilled and future Auth signups are bootstrapped by a database trigger. Account has no global role, and Course ownership is based on `auth.uid()` rather than legacy teacher/parent/student profile membership or user-editable metadata.
- Adult identity is split into explicit profile tables (`teacher`, `parent`) tied to `auth.users`.
- Student can authenticate via internal login mapping (`student.internal_auth_email`) and may also have `student.user_id` when linked.
- RLS identity/membership helpers are `SECURITY DEFINER` (their internal reads bypass RLS — required to avoid policy recursion): `current_teacher_id`, `current_parent_id`, `current_student_id`, plus membership predicates `is_class_teacher`, `is_class_student`, `parent_in_class`, `can_read_class`, `is_my_child`, `teaches_student`, `parent_in_school`, and the lookup `scheduled_homework_class_id`.
- `current_account_id` is a least-privilege `SECURITY INVOKER` helper executable only by `authenticated`; it resolves the caller through the self-only Account policy.
- `current_session_invalid_before` is an authenticated-only `SECURITY DEFINER` helper that returns only the current `auth.uid()` revocation cutoff, allowing V2 routes to enforce the existing app-session kill switch without a service-role read.

## Row-level security (RLS)

RLS is enabled on 31 of 33 application tables (off only on `user_preference`/`user_security`, reached exclusively via SECURITY DEFINER RPCs). Every RLS-enabled table has at least one policy — there are no remaining "RLS-on / 0-policies" tables.

- **V1 compatibility layer.** Existing V1 repositories still connect as `service_role` (`BYPASSRLS`), so their policies remain defense-in-depth and primary authorization remains `resolveAccessPolicy()` in app code.
- **V2 Course Builder.** Course document/file tables grant owner-scoped CRUD only to `authenticated`; `account` itself is self-readable but cannot be inserted, updated, or deleted through an ordinary user JWT. Ordinary Course Builder UI and Storage requests must use the user's JWT, not `service_role`. The assembler and reorder RPCs are `SECURITY INVOKER`, so the same RLS remains active.
- **V1 policies.** Existing runtime/content policies are primarily `FOR SELECT` (plus narrow self-`UPDATE` policies); existing writes still use the legacy server layer.
- **Grants.** `anon` has no privileges on the new V2 tables. `authenticated` receives explicit CRUD grants constrained by RLS; helper/RPC `EXECUTE` is explicitly revoked from `PUBLIC`/`anon` and granted only where required.
- **Membership model.** Visibility is computed via the SECURITY DEFINER helpers above, which bypass RLS internally so policies never read the mutually-recursive graph tables (`class_teacher`/`class_student`/`student`) directly:
  - Runtime layer (`scheduled_lesson`, homework assignments, conversations, messages, attachments) is scoped to the class/student: teacher of the class, the enrolled student, or the parent of an enrolled child (`can_read_class` / `is_class_teacher` / `is_my_child`). Messages/attachments are visible iff their parent conversation/message is.
  - Methodology/content layer (`methodology*`, `reusable_asset`) is a **shared global catalog**: readable by any `authenticated` user (`USING (true)`, scoped `to authenticated`), denied to `anon`. There is no school-ownership column, so per-school content isolation is not currently expressible (would require a schema change).
- **Recursion fix (202606300002).** The identity helpers were `SECURITY INVOKER` and the covered-table policies referenced one another, so reads under `authenticated` raised `stack depth limit exceeded`. The migration converts the helpers to `SECURITY DEFINER` and rewrites the covered-table predicates to use them (behavior-preserving; `service_role` unaffected).
- **Private Course Storage.** `course-assets` is private, capped at 10 MiB, MIME-restricted, and protected by owner policies on `storage.objects` for select/insert/update/delete.

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
