import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260806190044_lesson_runs_learning_records.sql",
  "utf8",
);
const groupsMigration = readFileSync(
  "supabase/migrations/20260806220726_learner_groups_mixed_course_audience.sql",
  "utf8",
);
const canonicalMigration = readFileSync(
  "supabase/migrations/20260807033034_canonical_learner_profile.sql",
  "utf8",
);
const snapshot = readFileSync("supabase/schema/current-schema.sql", "utf8");

function functionBody(name: string) {
  const start = migration.indexOf(`create function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end + 4);
}

function tableBody(name: string) {
  const start = migration.indexOf(`create table public.${name} (`);
  assert.notEqual(start, -1, `missing table ${name}`);
  const end = migration.indexOf("\n);", start);
  assert.notEqual(end, -1, `unterminated table ${name}`);
  return migration.slice(start, end + 3);
}

function groupsFunctionBody(name: string) {
  const start = groupsMigration.indexOf(`create function public.${name}(`);
  const replaceStart = groupsMigration.indexOf(
    `create or replace function public.${name}(`,
  );
  const resolvedStart = start === -1 ? replaceStart : start;
  assert.notEqual(resolvedStart, -1, `missing groups function ${name}`);
  const end = groupsMigration.indexOf("\n$$;", resolvedStart);
  assert.notEqual(end, -1, `unterminated groups function ${name}`);
  return groupsMigration.slice(resolvedStart, end + 4);
}

function groupsTableBody(name: string) {
  const start = groupsMigration.indexOf(`create table public.${name} (`);
  assert.notEqual(start, -1, `missing groups table ${name}`);
  const end = groupsMigration.indexOf("\n);", start);
  assert.notEqual(end, -1, `unterminated groups table ${name}`);
  return groupsMigration.slice(start, end + 3);
}

function canonicalFunctionBody(name: string) {
  const start = canonicalMigration.indexOf(`create function public.${name}(`);
  const replaceStart = canonicalMigration.indexOf(
    `create or replace function public.${name}(`,
  );
  const resolvedStart = start === -1 ? replaceStart : start;
  assert.notEqual(resolvedStart, -1, `missing canonical function ${name}`);
  const end = canonicalMigration.indexOf("\n$$;", resolvedStart);
  assert.notEqual(end, -1, `unterminated canonical function ${name}`);
  return canonicalMigration.slice(resolvedStart, end + 4);
}

function snapshotTableBody(name: string) {
  const start = snapshot.indexOf(`CREATE TABLE public.${name} (`);
  assert.notEqual(start, -1, `missing snapshot table ${name}`);
  const end = snapshot.indexOf("\n);", start);
  assert.notEqual(end, -1, `unterminated snapshot table ${name}`);
  return snapshot.slice(start, end + 3);
}

test("lesson scheduling is one forward-only transactional migration", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\ncommit;\n$/);
  assert.doesNotMatch(
    migration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );

  for (const table of [
    "learner_profile",
    "course_learner",
    "lesson_run",
    "learning_record",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
  }

  assert.doesNotMatch(
    migration,
    /create table public\.lesson_run_participant/i,
  );
  assert.doesNotMatch(migration, /create table public\.[a-z_]*snapshot/i);
  assert.doesNotMatch(tableBody("lesson_run"), /\n\s*status\s+/i);
  assert.doesNotMatch(tableBody("learning_record"), /\n\s*status\s+/i);
});

test("LessonRun has one open alarm and no persisted state machine", () => {
  const run = tableBody("lesson_run");
  for (const column of [
    "lesson_id uuid not null",
    "scheduled_at timestamptz not null",
    "planned_duration_minutes integer not null",
    "started_at timestamptz null",
    "ended_at timestamptz null",
    "cancelled_at timestamptz null",
    "teacher_report text null",
  ]) {
    assert.equal(run.includes(column), true, `missing ${column}`);
  }

  assert.match(run, /planned_duration_minutes between 5 and 480/);
  assert.match(
    run,
    /cancelled_at is null[\s\S]*?started_at is null[\s\S]*?cancelled_at >= started_at/,
  );
  assert.match(
    functionBody("schedule_lesson_run"),
    /lesson\.estimated_duration_minutes between 5 and 480[\s\S]*?60/,
  );
  assert.match(
    migration,
    /create unique index lesson_run_one_open_per_lesson_idx[\s\S]*?where ended_at is null and cancelled_at is null;/,
  );
  assert.match(
    functionBody("schedule_lesson_run"),
    /if cardinality\(v_selected_ids\) = 0 then[\s\S]*?'lesson_run_requires_expected_learner'/,
  );
  assert.match(
    functionBody("schedule_lesson_run"),
    /p_expected_lesson_run_id uuid default null[\s\S]*?for update of run[\s\S]*?v_run\.id <> p_expected_lesson_run_id[\s\S]*?'lesson_run_changed'/,
  );
});

test("LearningRecord is expected attendance before completion and durable memory after it", () => {
  const record = tableBody("learning_record");
  for (const fragment of [
    "learner_profile_id uuid not null",
    "lesson_run_id uuid null",
    "source_course_id uuid null",
    "source_lesson_id uuid null",
    "occurred_at timestamptz null",
    "was_present boolean null",
    "needs_repeat boolean null",
    "learning_record_run_learner_unique",
    "needs_repeat is not true or was_present is true",
  ]) {
    assert.equal(record.includes(fragment), true, `missing ${fragment}`);
  }

  assert.match(
    record,
    /references public\.lesson_run\(id\) on delete set null/,
  );
  assert.match(record, /references public\.course\(id\) on delete set null/);
  assert.match(record, /references public\.lesson\(id\) on delete set null/);
  assert.match(
    record,
    /occurred_at is null[\s\S]*?lesson_run_id is not null[\s\S]*?occurred_at is not null[\s\S]*?was_present is not null/,
  );

  const cleanup = functionBody("delete_draft_learning_records_for_lesson_run");
  assert.match(cleanup, /record\.lesson_run_id = old\.id/);
  assert.match(cleanup, /record\.occurred_at is null/);
  assert.doesNotMatch(cleanup, /occurred_at is not null/);

  const deletion = functionBody("delete_lesson_with_history");
  assert.match(deletion, /delete from public\.lesson as lesson/);
  assert.match(deletion, /account\.auth_user_id = v_actor_user_id/);
});

test("Course audience is neutral, same-owner, and replace-only", () => {
  assert.match(
    migration,
    /course_audience_type_check[\s\S]*?audience_type in \('none', 'learner_profile'\)/,
  );
  assert.match(
    functionBody("enforce_course_learner_same_owner"),
    /course\.owner_account_id = profile\.owner_account_id/,
  );
  assert.match(
    functionBody("guard_course_audience_type"),
    /'course_audience_type_is_derived'/,
  );
  assert.match(
    functionBody("replace_course_learners"),
    /account\.auth_user_id = v_actor_user_id/,
  );
  assert.match(
    migration,
    /grant select[\s\S]*?public\.course_learner,[\s\S]*?public\.lesson_run,[\s\S]*?public\.learning_record[\s\S]*?to authenticated;/,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:insert|update|delete) on table public\.course_learner to authenticated;/,
  );
  assert.match(
    migration,
    /grant select, insert, update\s+on table public\.learner_profile\s+to authenticated;/,
  );
  assert.doesNotMatch(
    migration,
    /grant [^;]*delete[^;]*on table public\.learner_profile\s+to authenticated;/,
  );
});

test("run lifecycle RPCs are owner-checked, serialized, and least privilege", () => {
  for (const name of [
    "schedule_lesson_run",
    "start_lesson_run",
    "complete_lesson_run",
    "cancel_lesson_run",
    "delete_lesson_with_history",
  ]) {
    const body = functionBody(name);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /v_actor_user_id uuid := \(select auth\.uid\(\)\)/);
    assert.match(body, /account\.auth_user_id = v_actor_user_id/);
    assert.match(body, /for update of lesson/);
  }

  for (const signature of [
    "replace_course_learners(uuid, uuid[])",
    "schedule_lesson_run(\n  uuid,\n  timestamptz,\n  integer,\n  uuid[],\n  uuid\n)",
    "start_lesson_run(uuid, timestamptz)",
    "complete_lesson_run(\n  uuid,\n  jsonb,\n  text,\n  timestamptz\n)",
    "cancel_lesson_run(uuid, timestamptz)",
    "delete_lesson_with_history(uuid)",
  ]) {
    assert.equal(
      migration.includes(`grant execute on function public.${signature}`),
      true,
      `missing authenticated execute grant for ${signature}`,
    );
  }

  assert.doesNotMatch(
    migration,
    /grant execute on function public\.(?:replace_course_learners|schedule_lesson_run|start_lesson_run|complete_lesson_run|cancel_lesson_run|delete_lesson_with_history)[\s\S]*?to (?:anon|service_role);/,
  );
});

test("completion validates exact learner coverage and finalizes compact evidence", () => {
  const completion = functionBody("complete_lesson_run");
  for (const fragment of [
    "jsonb_typeof(p_records) <> 'array'",
    "jsonb_array_length(p_records) > 200",
    "jsonb_array_length(p_records) = 0",
    "lesson_run_requires_expected_learner",
    "lesson_run_record_learner_duplicate",
    "lesson_run_records_do_not_match_expected_learners",
    "course_title_at_time = v_course_title",
    "lesson_title_at_time = v_lesson_title",
    "subject_at_time = v_subject",
    "occurred_at = p_ended_at",
  ]) {
    assert.equal(completion.includes(fragment), true, `missing ${fragment}`);
  }

  assert.doesNotMatch(
    completion,
    /lesson_component|student_slide|payload|placement_config/,
  );

  const cancellation = functionBody("cancel_lesson_run");
  assert.match(
    cancellation,
    /p_cancelled_at < v_run\.started_at[\s\S]*?lesson_run_cancelled_before_start/,
  );
});

test("current schema snapshot preserves the hardened scheduling contract", () => {
  assert.match(
    snapshot,
    /CREATE FUNCTION public\.schedule_lesson_run\([^\n]*p_expected_lesson_run_id uuid DEFAULT NULL::uuid\)/,
  );
  assert.match(snapshot, /lesson_run_cancellation_time_check/);
  assert.match(snapshot, /'lesson_run_changed'/);
  assert.match(
    snapshot,
    /jsonb_array_length\(p_records\) not between 1 and 200/,
  );
  assert.match(
    snapshot,
    /GRANT SELECT ON TABLE public\.learner_profile TO authenticated;/,
  );
  assert.doesNotMatch(
    snapshot,
    /GRANT [^;]*(?:INSERT|UPDATE|DELETE)[^;]*ON TABLE public\.learner_profile TO authenticated;/,
  );
});

test("canonical learner identity is a forward-only backfilled relation model", () => {
  assert.match(canonicalMigration, /\nbegin;\n/);
  assert.match(canonicalMigration, /\ncommit;\n$/);
  assert.doesNotMatch(
    canonicalMigration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );

  assert.match(
    canonicalMigration,
    /create table public\.teacher_learner \([\s\S]*?teacher_account_id uuid not null[\s\S]*?learner_profile_id uuid not null[\s\S]*?primary key \(teacher_account_id, learner_profile_id\)/,
  );
  assert.match(
    canonicalMigration,
    /insert into public\.teacher_learner[\s\S]*?profile\.owner_account_id[\s\S]*?profile\.id[\s\S]*?profile\.archived_at/,
  );
  assert.match(
    canonicalMigration,
    /disable trigger trg_learning_record_updated_at;[\s\S]*?update public\.learning_record as record[\s\S]*?recorded_by_account_id = profile\.owner_account_id[\s\S]*?enable trigger trg_learning_record_updated_at;/,
  );
  assert.match(
    canonicalMigration,
    /alter column recorded_by_account_id set not null[\s\S]*?references public\.account\(id\)[\s\S]*?on delete restrict/,
  );
  assert.match(
    canonicalMigration,
    /add constraint learner_profile_account_id_key unique \(account_id\)[\s\S]*?on delete set null/,
  );
  assert.match(
    canonicalMigration,
    /drop column owner_account_id,[\s\S]*?drop column archived_at/,
  );
});

test("teacher directory, history and future audience are isolated per Account", () => {
  const schedule = canonicalFunctionBody("schedule_lesson_run");
  assert.match(schedule, /public\.teacher_learner/);
  assert.match(
    schedule,
    /teacher_learner\.teacher_account_id = v_teacher_account_id/,
  );
  assert.match(schedule, /recorded_by_account_id/);
  assert.match(schedule, /selected\.id,[\s\S]*?v_teacher_account_id/);

  const archive = canonicalFunctionBody("archive_learner_profile");
  assert.match(archive, /returns public\.teacher_learner/);
  assert.match(
    archive,
    /teacher_learner\.teacher_account_id = v_teacher_account_id/,
  );
  assert.doesNotMatch(archive, /delete from public\.learner_profile/);

  const detach = canonicalFunctionBody("detach_archived_teacher_learner_links");
  assert.match(detach, /course\.owner_account_id = new\.teacher_account_id/);
  assert.match(
    detach,
    /learner_group\.owner_account_id = new\.teacher_account_id/,
  );
  assert.doesNotMatch(
    detach,
    /learning_record|delete from public\.learner_profile/,
  );

  const updateProfile = canonicalFunctionBody(
    "update_learner_profile_with_groups",
  );
  assert.match(updateProfile, /update public\.teacher_learner/);
  assert.match(updateProfile, /set display_name = btrim\(p_display_name\)/);
  assert.doesNotMatch(updateProfile, /update public\.learner_profile/);

  for (const name of [
    "enforce_course_learner_teacher_relation",
    "enforce_learner_group_member_teacher_relation",
  ]) {
    const body = canonicalFunctionBody(name);
    assert.match(body, /public\.teacher_learner/);
    assert.match(body, /teacher_learner\.archived_at is null/);
  }

  assert.match(
    canonicalMigration,
    /create policy learning_record_producer_select[\s\S]*?recorded_by_account_id = \(select public\.current_account_id\(\)\)[\s\S]*?;/,
  );
  assert.match(
    canonicalMigration,
    /create trigger trg_learning_record_producer_immutable/,
  );
  assert.match(
    canonicalMigration,
    /revoke all on table public\.teacher_learner from public, anon, authenticated;[\s\S]*?grant select on table public\.teacher_learner to authenticated;/,
  );
  assert.doesNotMatch(
    canonicalMigration,
    /create (?:table|function|view)[^;]*(?:observer|guardian|invitation|merge)/i,
  );
});

test("current snapshot exposes canonical identity without cross-teacher history", () => {
  const profile = snapshotTableBody("learner_profile");
  const relation = snapshotTableBody("teacher_learner");
  const record = snapshotTableBody("learning_record");

  assert.match(profile, /account_id uuid/);
  assert.doesNotMatch(profile, /owner_account_id|archived_at/);
  assert.match(relation, /teacher_account_id uuid NOT NULL/);
  assert.match(relation, /learner_profile_id uuid NOT NULL/);
  assert.match(relation, /archived_at timestamp with time zone/);
  assert.match(record, /recorded_by_account_id uuid NOT NULL/);
  assert.match(
    snapshot,
    /CREATE POLICY learning_record_producer_select[\s\S]*?recorded_by_account_id = \( SELECT public\.current_account_id\(\)/,
  );
  assert.match(snapshot, /learning_record_recorded_by_account_id_fkey/);
  assert.match(snapshot, /ON DELETE RESTRICT/);
  assert.match(snapshot, /teacher_learner_teacher_select/);
  assert.doesNotMatch(
    snapshot,
    /GRANT [^;]*(?:INSERT|UPDATE|DELETE)[^;]*ON TABLE public\.teacher_learner TO authenticated;/,
  );
});

test("learner groups are a forward-only unordered collection model", () => {
  assert.match(groupsMigration, /^begin;\n/);
  assert.match(groupsMigration, /\ncommit;\n$/);
  assert.doesNotMatch(
    groupsMigration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );
  assert.match(
    groupsMigration,
    /alter table public\.learner_profile[\s\S]*?add column archived_at timestamptz null;/,
  );

  for (const table of [
    "learner_group",
    "learner_group_member",
    "course_learner_group",
  ]) {
    assert.match(
      groupsMigration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
  }

  const member = groupsTableBody("learner_group_member");
  const courseGroup = groupsTableBody("course_learner_group");
  assert.match(
    member,
    /references public\.learner_group\(id\) on delete cascade/,
  );
  assert.match(
    member,
    /references public\.learner_profile\(id\) on delete cascade/,
  );
  assert.match(
    courseGroup,
    /references public\.course\(id\) on delete cascade/,
  );
  assert.match(
    courseGroup,
    /references public\.learner_group\(id\) on delete cascade/,
  );
  assert.doesNotMatch(member, /\bposition\b|\bstatus\b/);
  assert.doesNotMatch(courseGroup, /\bposition\b|\bstatus\b/);
});

test("mixed Course audience is deduplicated while an open Run stays frozen", () => {
  const schedule = groupsFunctionBody("schedule_lesson_run");
  assert.match(
    schedule,
    /public\.course_learner[\s\S]*?union[\s\S]*?public\.course_learner_group[\s\S]*?public\.learner_group_member/,
  );
  assert.match(schedule, /profile\.archived_at is null/);
  assert.match(
    schedule,
    /p_learner_profile_ids is null and v_run\.id is not null[\s\S]*?public\.learning_record/,
  );
  assert.match(
    schedule,
    /public\.learner_group_member[\s\S]*?union[\s\S]*?select record\.learner_profile_id as id/,
  );
  assert.match(schedule, /cardinality\(v_selected_ids\) > 200/);
  assert.doesNotMatch(schedule, /lesson_run_participant|lesson_snapshot/);

  const replacement = groupsFunctionBody("replace_course_audience");
  assert.match(replacement, /select distinct requested_id as id/);
  assert.match(
    replacement,
    /from unnest\(v_direct_ids\)[\s\S]*?union[\s\S]*?public\.learner_group_member/,
  );
  assert.match(replacement, /v_effective_count > 200/);

  const compatibility = groupsFunctionBody("replace_course_learners");
  assert.match(compatibility, /public\.replace_course_audience/);
  assert.match(compatibility, /public\.course_learner_group/);
});

test("learner deletion is soft archive and Group deletion removes only links", () => {
  const archive = groupsFunctionBody("archive_learner_profile");
  const detach = groupsFunctionBody("detach_archived_learner_profile_links");
  const deleteGroup = groupsFunctionBody("delete_learner_group");

  assert.match(
    archive,
    /set archived_at = coalesce\(profile\.archived_at, now\(\)\)/,
  );
  assert.doesNotMatch(archive, /delete from public\.learner_profile/);
  assert.match(detach, /delete from public\.course_learner/);
  assert.match(detach, /delete from public\.learner_group_member/);
  assert.doesNotMatch(detach, /learning_record|lesson_run/);
  assert.match(deleteGroup, /delete from public\.learner_group/);
  assert.doesNotMatch(
    deleteGroup,
    /learner_profile|learning_record|lesson_run/,
  );
});

test("profile membership cannot overflow an attached Course or reveal a foreign Group", () => {
  for (const name of [
    "create_learner_profile_with_groups",
    "update_learner_profile_with_groups",
  ]) {
    const body = groupsFunctionBody(name);
    const ownershipValidation = body.indexOf("if cardinality(v_group_ids) <>");
    const capacityFailure = body.indexOf("course_audience_too_large");
    assert.notEqual(
      ownershipValidation,
      -1,
      `${name} lacks Group ownership validation`,
    );
    assert.notEqual(
      capacityFailure,
      -1,
      `${name} lacks Course capacity validation`,
    );
    assert.equal(
      ownershipValidation < capacityFailure,
      true,
      `${name} must reject a foreign Group before checking Course capacity`,
    );
    assert.match(body, /public\.course_learner_group/);
    assert.match(body, />= 200/);
  }

  assert.match(
    groupsFunctionBody("update_learner_profile_with_groups"),
    /not exists[\s\S]*?current_effective\.learner_profile_id = p_learner_profile_id/,
  );
});

test("group and mixed-audience RPCs are owner-scoped and closed by default", () => {
  const rpcNames = [
    "create_learner_profile_with_groups",
    "update_learner_profile_with_groups",
    "archive_learner_profile",
    "create_learner_group",
    "update_learner_group",
    "delete_learner_group",
    "replace_course_audience",
  ];

  for (const name of rpcNames) {
    const body = groupsFunctionBody(name);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /v_actor_user_id uuid := \(select auth\.uid\(\)\)/);
    assert.match(body, /account\.auth_user_id = v_actor_user_id/);
    assert.match(
      groupsMigration,
      new RegExp(
        `revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated, service_role;`,
      ),
    );
    assert.match(
      groupsMigration,
      new RegExp(
        `grant execute on function public\\.${name}\\([\\s\\S]*?to authenticated;`,
      ),
    );
  }

  assert.match(
    groupsMigration,
    /revoke insert, update on table public\.learner_profile from authenticated;/,
  );
  assert.match(
    groupsMigration,
    /grant update \(display_name\)[\s\S]*?public\.learner_profile to authenticated;/,
  );
  assert.doesNotMatch(
    groupsMigration,
    /grant update \([^)]*archived_at[^)]*\)[\s\S]*?to authenticated;/,
  );
});

test("current snapshot includes active Groups without a parallel Run model", () => {
  for (const table of [
    "learner_group",
    "learner_group_member",
    "course_learner_group",
  ]) {
    assert.match(snapshot, new RegExp(`CREATE TABLE public\\.${table} \\(`));
  }
  assert.match(snapshot, /archived_at timestamp with time zone/);
  assert.match(snapshot, /CREATE FUNCTION public\.replace_course_audience/);
  assert.match(snapshot, /CREATE FUNCTION public\.archive_learner_profile/);
  assert.match(
    snapshot,
    /CREATE FUNCTION public\.schedule_lesson_run[\s\S]*?public\.course_learner_group/,
  );
  assert.doesNotMatch(snapshot, /CREATE TABLE public\.lesson_run_participant/);
  assert.doesNotMatch(snapshot, /CREATE TABLE public\.lesson_snapshot/);
});
