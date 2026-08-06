import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260806190044_lesson_runs_learning_records.sql",
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
  assert.match(snapshot, /jsonb_array_length\(p_records\) = 0/);
  assert.match(
    snapshot,
    /GRANT SELECT,INSERT,UPDATE ON TABLE public\.learner_profile TO authenticated;/,
  );
  assert.doesNotMatch(
    snapshot,
    /GRANT [^;]*DELETE[^;]*ON TABLE public\.learner_profile TO authenticated;/,
  );
});
