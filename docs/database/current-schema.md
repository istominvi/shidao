# Current database schema (agent-first guide)

This guide describes the current ShiDao database model after migration
`20260804033421_course_lesson_components_remove_legacy_methodology.sql`.

## Read order for DB tasks

1. `docs/database/current-schema.md` (this file)
2. `supabase/schema/current-schema.sql`
3. `supabase/migrations/*` (only for migration, compatibility, backfill, or rollback work)

## Active entities

### Identity and school scope

- `parent` — parent profile linked to `auth.users`.
- `teacher` — teacher profile linked to `auth.users`.
- `school` — personal or organization workspace.
- `school_teacher` — teacher membership in a school (`owner | teacher`).
- `class` — group inside a school. It no longer has a methodology binding.
- `class_teacher` — teacher assignment to a class.
- `student` — learner profile with internal login mapping and optional `auth.users`/parent links.
- `class_student` — student membership in a class.

### User preference and security

- `user_preference` — last active profile, selected school, theme, and settings.
- `user_security` — PIN and lock metadata plus `sessions_invalid_before`, the per-user app-session revocation cutoff.

### V2 Account and Course Builder

- `account` — one application Account per `auth.users` row. Course ownership is Account-based.
- `course` — Account-owned editable Course draft with title, subject, goal, level, audience description, target lesson count, teacher preferences, and assembly/archive timestamps.
- `lesson` — an ordered Course lesson. Its title is intrinsic and required; it is not represented by a component.
- `lesson_component` — ordered component directly owned by a Lesson. It stores the code-first registry key/version, payload, placement, and visibility.
- `stored_file` — Account-owned metadata for an object in the private `course-assets` bucket (`pending | ready`).
- `course_attachment` — ownership-checked relation between a Course and a stored file.

There is no active `lesson_step` layer. Teacher Plan and Student Screen read the same ordered Lesson components; Student Screen filters their visibility.

## Course document invariants

- Lesson positions are positive and unique per Course through a deferrable constraint. Deletes compact positions with `compact_course_lesson_positions()`.
- Component positions are positive and unique per Lesson through a deferrable constraint. Deletes compact positions with `compact_lesson_component_positions()`.
- `reorder_lesson_component(component_id, new_position)` changes component order atomically under caller RLS.
- Supported component type keys remain code-first and are not a database enum.
- Component visibility is exactly `staff_only | learner_visible`:
  - `staff_only` is available on the teacher surface and excluded from Student Screen;
  - `learner_visible` is available on both teacher and learner surfaces.
- `course.assembled_at` records deterministic first-draft assembly. `assemble_course_draft(course_id, lesson_title, lesson_summary, components)` persists one Lesson and its validated component list atomically. Idempotent responses contain `courseId`, `lessonIds`, `componentIds`, and `alreadyAssembled`; there are no Step arguments or `stepIds`.
- The Step-removal migration preserves every original component ID and field, then deterministically flattens order by Step position and component position.
- For a former multi-Step lesson, or a former Step with non-empty instructions, the migration materializes:
  - Step title as a learner-visible `heading`;
  - teacher instructions as a `staff_only` `callout`;
  - learner instructions as a learner-visible `callout`.
- A single empty technical root is not materialized as an extra heading.

## Files and Storage

- `stored_file` is limited to 10 MiB and always points at the private `course-assets` bucket.
- A file must have a lowercase SHA-256 checksum before its status can become `ready`.
- Storage object paths start with the owning Account UUID; `storage.objects` policies enforce that first path segment.
- `course_attachment` can only connect a Course and file owned by the same current Account through its RLS policy.
- The migration does not change Storage buckets, object policies, Auth, SMTP, JWT secrets, or API keys.

## Archived V1 methodology/runtime model

The following tables are no longer part of the active `public` schema:

- methodology source: `methodology`, `methodology_lesson`, `methodology_lesson_block`, `methodology_lesson_block_asset`, `methodology_lesson_homework`, `methodology_lesson_student_content`, `reusable_asset`;
- lesson/homework runtime: `scheduled_lesson`, `scheduled_lesson_homework_assignment`, `student_homework_assignment`;
- communication runtime: `group_student_conversation`, `group_student_message`, `lesson_group_conversation`, `lesson_group_message`, `communication_message_attachment`;
- notifications: `notification`;
- superseded Course Builder Step model: `lesson_step`, `lesson_step_component`.

The migration also removes `class.methodology_id`, its invariant trigger/function, and `scheduled_homework_class_id(uuid)`. V1 recovery remains in the archive Git refs and recovery snapshot; those archives are not represented as active tables and must not be restored without an explicit recovery request.

## Identity and session helpers

- V2 identity uses `account`, linked one-to-one to `auth.users`; an Auth trigger bootstraps future Accounts.
- Adult identity remains split into `teacher` and `parent` profiles.
- A Student can authenticate through `student.internal_auth_email` and may also have `student.user_id`.
- Membership helpers remain for the preserved school/class model: `current_teacher_id`, `current_parent_id`, `current_student_id`, `is_class_teacher`, `is_class_student`, `parent_in_class`, `can_read_class`, `is_my_child`, `teaches_student`, and `parent_in_school`.
- `current_account_id()` is a least-privilege `SECURITY INVOKER` helper executable by `authenticated`; it resolves the caller through Account's self-read policy.
- `current_session_invalid_before()` is an authenticated-only `SECURITY DEFINER` helper that returns only the current `auth.uid()` revocation cutoff.
- `revoke_user_sessions(p_user_id, p_cutoff)` advances the cutoff; `APP_SESSION_VERSION` remains the independent all-users kill switch.

## Row-level security (RLS)

RLS is enabled on 14 of 16 active application tables. `user_preference` and `user_security` remain reachable through their existing security-definer boundaries rather than direct table policies.

- Identity/school membership policies remain unchanged.
- Course, Lesson, Lesson Component, file, and attachment tables grant owner-scoped CRUD to `authenticated`.
- `account` is self-readable but cannot be inserted, updated, or deleted through an ordinary user JWT.
- `lesson_component_course_owner_all` resolves ownership through Lesson → Course → Account.
- `anon` has no privileges on V2 document/file tables.
- `assemble_course_draft` and `reorder_lesson_component` are `SECURITY INVOKER`, so owner RLS remains active.
- The private `course-assets` bucket remains protected by owner policies on `storage.objects`.

## Compatibility notes

- Identity/school tables and their historical migrations are intentionally preserved.
- The migration chain still contains the deleted V1 methodology/runtime tables and seed data as historical upgrade records. Do not edit or delete those old migrations.
- Snapshot files describe the current post-migration model and should be preferred for day-to-day schema reasoning.

## When to consult migrations

Use `supabase/migrations/*` when you need:

- to write a new migration;
- to understand legacy behavior or backfills;
- to debug migration order or compatibility;
- to evaluate rollback/reset behavior;
- to confirm when a constraint, function, or table was introduced or removed.

## Snapshot refresh workflow

Preferred when DB access and `pg_dump` are available:

```bash
DATABASE_URL='postgresql://...' npm run db:snapshot
```

When the target migration has not yet been applied:

- update `supabase/schema/current-schema.sql` from the forward migration and verify it on an isolated schema clone;
- keep this guide synchronized with that snapshot;
- do not rewrite migration history.
