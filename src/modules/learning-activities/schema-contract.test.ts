import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260819142602_learning_activity_foundation.sql",
  "utf8",
);
const objectiveMigration = readFileSync(
  "supabase/migrations/20260820085049_learning_objectives_component_alignment.sql",
  "utf8",
);
const profileMigration = readFileSync(
  "supabase/migrations/20260820132725_learning_activity_profile_history_skills_recommendations.sql",
  "utf8",
);
const choiceQuizMigration = readFileSync(
  "supabase/migrations/20260821100000_choice_quiz_activity.sql",
  "utf8",
);
const snapshot = readFileSync("supabase/schema/current-schema.sql", "utf8");
const refreshScript = readFileSync(
  "scripts/refresh-schema-snapshot.sh",
  "utf8",
);

function tableBody(name: string) {
  const start = migration.indexOf(`create table public.${name} (`);
  assert.notEqual(start, -1, `missing table ${name}`);
  const end = migration.indexOf("\n);", start);
  assert.notEqual(end, -1, `unterminated table ${name}`);
  return migration.slice(start, end + 3);
}

function profileTableBody(name: string) {
  const start = profileMigration.indexOf(`create table public.${name} (`);
  assert.notEqual(start, -1, `missing LA-M3 table ${name}`);
  const end = profileMigration.indexOf("\n);", start);
  assert.notEqual(end, -1, `unterminated LA-M3 table ${name}`);
  return profileMigration.slice(start, end + 3);
}

function functionBodyIn(source: string, name: string) {
  const createStart = source.indexOf(`create function public.${name}(`);
  const replaceStart = source.indexOf(
    `create or replace function public.${name}(`,
  );
  const start = createStart === -1 ? replaceStart : createStart;
  assert.notEqual(start, -1, `missing function ${name}`);
  const delimiter = source.indexOf("as $function$", start);
  assert.notEqual(delimiter, -1, `missing function delimiter for ${name}`);
  const end = source.indexOf("\n$function$;", delimiter);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return source.slice(start, end + 12);
}

function functionBody(name: string) {
  return functionBodyIn(migration, name);
}

function snapshotTableBody(name: string) {
  const start = snapshot.indexOf(`CREATE TABLE public.${name} (`);
  assert.notEqual(start, -1, `snapshot missing table ${name}`);
  const end = snapshot.indexOf("\n);", start);
  assert.notEqual(end, -1, `snapshot has unterminated table ${name}`);
  return snapshot.slice(start, end + 3);
}

function snapshotFunctionBody(name: string) {
  const start = snapshot.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `snapshot missing function ${name}`);
  const tail = snapshot.slice(start);
  const delimiterMatch = /\bAS (\$[A-Za-z_]*\$)/.exec(tail);
  assert.ok(delimiterMatch, `snapshot missing function delimiter for ${name}`);
  const delimiter = delimiterMatch[1];
  const bodyStart = start + delimiterMatch.index;
  const end = snapshot.indexOf(`\n${delimiter};`, bodyStart);
  assert.notEqual(end, -1, `snapshot has unterminated function ${name}`);
  return snapshot.slice(start, end + delimiter.length + 2);
}

function assertLifecycleLockOrder(body: string, label: string) {
  const lessonLock = body.indexOf("for update of lesson;");
  const componentLock = body.indexOf("for update of component;");
  const runLock = body.indexOf("for update of run;");
  const recordLock = body.indexOf("for update of record;");
  assert.equal(
    lessonLock >= 0 &&
      lessonLock < componentLock &&
      componentLock < runLock &&
      runLock < recordLock,
    true,
    `${label} must lock Lesson -> Components -> Runs -> LearningRecords`,
  );
}

test("LA-M1 is one guarded forward-only migration", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\nnotify pgrst, 'reload schema';\n\ncommit;\n$/);
  assert.equal((migration.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((migration.match(/^commit;$/gm) ?? []).length, 1);
  assert.match(migration, /shidao_learning_activity_schema_sanity_failed/);
  assert.doesNotMatch(
    migration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );

  for (const forbidden of [
    "lesson_step",
    "lesson_run_participant",
    "lesson_session",
    "learning_event",
    "generic_metrics",
  ]) {
    if (forbidden === "lesson_step" || forbidden === "lesson_run_participant") {
      assert.match(
        migration,
        new RegExp(`to_regclass\\('public\\.${forbidden}'\\) is not null`),
      );
      continue;
    }
    assert.doesNotMatch(
      migration,
      new RegExp(`create table public\\.${forbidden}`),
    );
  }
});

test("observation rows are compact, bounded, and tied to the record producer", () => {
  const table = tableBody("lesson_component_observation");

  for (const column of [
    "learning_record_id uuid not null",
    "lesson_component_id uuid null",
    "source_lesson_component_id_at_time uuid not null",
    "component_position_at_time integer not null",
    "component_type_key_at_time text not null",
    "component_label_at_time text not null",
    "observable_criterion_at_time text not null",
    "rating text not null",
    "entry_method text not null",
    "private_note text null",
    "observed_at timestamptz not null",
    "recorded_by_account_id uuid not null",
  ]) {
    assert.equal(table.includes(column), true, `missing ${column}`);
  }

  assert.match(
    migration,
    /learning_record_id_recorded_by_unique[\s\S]*?unique \(id, recorded_by_account_id\)/,
  );
  assert.match(
    table,
    /foreign key \(learning_record_id, recorded_by_account_id\)[\s\S]*?references public\.learning_record\(id, recorded_by_account_id\)[\s\S]*?on delete cascade/,
  );
  assert.match(
    table,
    /foreign key \(lesson_component_id\)[\s\S]*?references public\.lesson_component\(id\)[\s\S]*?on delete set null/,
  );
  assert.match(
    table,
    /lesson_component_id is null[\s\S]*?lesson_component_id = source_lesson_component_id_at_time/,
  );
  assert.match(
    table,
    /unique \(learning_record_id, source_lesson_component_id_at_time\)/,
  );

  for (const bound of [
    "component_type_key_at_time)) <= 80",
    "component_label_at_time)) <= 500",
    "observable_criterion_at_time)) <= 500",
    "private_note)) <= 500",
  ]) {
    assert.equal(table.includes(bound), true, `missing bound ${bound}`);
  }

  assert.match(table, /rating in \('independent', 'with_support', 'not_yet'\)/);
  assert.match(table, /entry_method in \('direct', 'bulk_confirmed'\)/);
  assert.doesNotMatch(
    table,
    /\b(?:payload|placement|student_slide|lesson_snapshot|responses|events|metrics)\b/i,
  );
});

test("LA-M2 adds honest nullable objective-at-time context without backfilling LA-M1 rows", () => {
  const observationAlterStart = objectiveMigration.indexOf(
    "alter table public.lesson_component_observation",
  );
  const observationAlterEnd = objectiveMigration.indexOf(
    "\n\ncreate index lesson_component_observation_live_objective_idx",
    observationAlterStart,
  );
  assert.notEqual(observationAlterStart, -1);
  assert.notEqual(observationAlterEnd, -1);
  const observationAlter = objectiveMigration.slice(
    observationAlterStart,
    observationAlterEnd,
  );

  for (const column of [
    "learning_objective_id uuid null",
    "source_learning_objective_id_at_time uuid null",
    "learning_objective_title_at_time text null",
  ]) {
    assert.equal(observationAlter.includes(column), true, `missing ${column}`);
  }
  assert.match(
    observationAlter,
    /foreign key \(learning_objective_id\)[\s\S]*?references public\.learning_objective\(id\)[\s\S]*?on delete set null/,
  );
  assert.match(
    observationAlter,
    /source_learning_objective_id_at_time is null[\s\S]*?learning_objective_title_at_time is null[\s\S]*?learning_objective_id is null/,
  );
  assert.match(
    observationAlter,
    /source_learning_objective_id_at_time is not null[\s\S]*?learning_objective_title_at_time is not null[\s\S]*?char_length\(btrim\(learning_objective_title_at_time\)\) <= 240[\s\S]*?learning_objective_id = source_learning_objective_id_at_time/,
  );
  assert.doesNotMatch(
    observationAlter,
    /foreign key \(source_learning_objective_id_at_time\)/,
  );
  assert.match(
    objectiveMigration,
    /where observation\.learning_objective_id is not null[\s\S]*?or observation\.source_learning_objective_id_at_time is not null[\s\S]*?or observation\.learning_objective_title_at_time is not null[\s\S]*?learning_objective_postflight_legacy_data_changed/,
  );
});

test("LA-M2 save snapshots objective provenance only from locked server state", () => {
  const save = functionBodyIn(
    objectiveMigration,
    "save_lesson_component_observations",
  );
  const componentLock = save.indexOf("for update of component;");
  const objectiveLock = save.indexOf("for key share of objective;");
  const recordLock = save.indexOf("for update of record;");
  const observedAt = save.indexOf("v_observed_at := clock_timestamp();");
  const snapshotWrite = save.indexOf("learning_objective_id = v_objective.id");

  assert.equal(
    componentLock >= 0 &&
      componentLock < objectiveLock &&
      objectiveLock < recordLock &&
      recordLock < observedAt &&
      observedAt < snapshotWrite,
    true,
    "objective snapshot time must follow all lifecycle locks",
  );
  assert.match(
    save,
    /v_component\.primary_learning_objective_id[\s\S]*?where objective\.id = v_component\.primary_learning_objective_id/,
  );
  assert.match(
    save,
    /source_learning_objective_id_at_time = v_objective\.id[\s\S]*?learning_objective_title_at_time = btrim\(v_objective\.title\)/,
  );
  assert.doesNotMatch(save, /p_(?:learning|source)_objective/);
  assert.doesNotMatch(
    save,
    /submitted\.value ->> '(?:learningObjectiveId|sourceLearningObjectiveIdAtTime|learningObjectiveTitleAtTime)'/,
  );
});

test("LA-M2 component updates use the parent-first owner RPC while rolling grants remain compatible", () => {
  const update = functionBodyIn(
    objectiveMigration,
    "update_lesson_component_v2",
  );

  assert.match(
    update,
    /p_component_id uuid,[\s\S]*?p_payload jsonb,[\s\S]*?p_update_payload boolean,[\s\S]*?p_placement_config jsonb,[\s\S]*?p_update_placement_config boolean,[\s\S]*?p_primary_learning_objective_id uuid,[\s\S]*?p_update_primary_learning_objective_id boolean,[\s\S]*?p_activity_role text,[\s\S]*?p_update_activity_role boolean/,
  );
  assert.match(update, /returns setof public\.lesson_component/);
  assert.match(update, /security definer[\s\S]*?set search_path = ''/);
  assert.match(update, /account\.auth_user_id = v_actor_user_id/);
  assert.match(update, /jsonb_typeof\(p_payload\) <> 'object'/);
  assert.match(update, /jsonb_typeof\(p_placement_config\) <> 'object'/);
  assert.match(update, /lesson_component_learning_objective_cross_course/);
  assert.match(update, /lesson_component_learning_objective_archived/);
  assert.match(update, /lesson_component_activity_role_unsupported/);

  const courseLock = update.indexOf("for update of course;");
  const lessonLock = update.indexOf("for update of lesson;");
  const componentLock = update.indexOf("for update of component;");
  const objectiveLock = update.indexOf("for key share of objective;");
  const mutation = update.indexOf(
    "update public.lesson_component as component",
  );
  assert.equal(
    courseLock >= 0 &&
      courseLock < lessonLock &&
      lessonLock < componentLock &&
      componentLock < objectiveLock &&
      objectiveLock < mutation,
    true,
    "component mutation must lock Course -> Lesson -> Component -> Objective",
  );

  assert.match(
    objectiveMigration,
    /revoke all on function public\.update_lesson_component_v2\([\s\S]*?from public, anon, authenticated, service_role;[\s\S]*?grant execute on function public\.update_lesson_component_v2\([\s\S]*?to postgres, authenticated;/,
  );
  assert.match(
    objectiveMigration,
    /grant insert\(primary_learning_objective_id\),[\s\S]*?update\(primary_learning_objective_id\),[\s\S]*?insert\(activity_role\),[\s\S]*?update\(activity_role\)[\s\S]*?to authenticated;/,
  );
  assert.doesNotMatch(
    objectiveMigration,
    /revoke update\([\s\S]*?payload[\s\S]*?lesson_component[\s\S]*?from authenticated/,
  );
  for (const marker of [
    "learning_objective_postflight_rpc_acl_failed",
    "learning_objective_postflight_component_rpc_failed",
    "has_column_privilege",
  ]) {
    assert.equal(
      objectiveMigration.includes(marker),
      true,
      `missing ${marker}`,
    );
  }
});

test("LA-M2 objective bounds match the author and publication contracts", () => {
  assert.match(
    objectiveMigration,
    /constraint learning_objective_title_check check \([\s\S]*?char_length\(btrim\(title\)\) between 2 and 240/,
  );
  assert.equal(
    (
      objectiveMigration.match(
        /char_length\(btrim\(p_title\)\) not between 2 and 240/g,
      ) ?? []
    ).length,
    2,
  );
});

test("LA-M2 keeps the observation table closed to direct browser mutations", () => {
  assert.doesNotMatch(
    objectiveMigration,
    /(?:grant|revoke)[^;]*on table public\.lesson_component_observation/i,
  );
  assert.doesNotMatch(
    objectiveMigration,
    /(?:create|alter|drop) policy [^;]*lesson_component_observation/i,
  );
  assert.match(
    objectiveMigration,
    /revoke all on function public\.save_lesson_component_observations\([\s\S]*?from public, anon, authenticated, service_role;[\s\S]*?grant execute on function public\.save_lesson_component_observations\([\s\S]*?to postgres, authenticated;/,
  );
});

test("raw observations are recorder-read-only and mutations use one narrow RPC", () => {
  assert.match(
    migration,
    /alter table public\.lesson_component_observation enable row level security;/,
  );
  assert.match(
    migration,
    /create policy lesson_component_observation_recorder_select[\s\S]*?for select[\s\S]*?to authenticated[\s\S]*?recorded_by_account_id = \(select public\.current_account_id\(\)\)/,
  );
  assert.match(
    migration,
    /revoke all on table public\.lesson_component_observation[\s\S]*?from public, anon, authenticated, service_role;/,
  );
  assert.match(
    migration,
    /grant select on table public\.lesson_component_observation[\s\S]*?to authenticated;/,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:insert|update|delete)[^;]*on table public\.lesson_component_observation[^;]*to authenticated/i,
  );

  const save = functionBody("save_lesson_component_observations");
  assert.match(
    save,
    /p_lesson_run_id uuid,[\s\S]*?p_lesson_component_id uuid,[\s\S]*?p_component_label_at_time text,[\s\S]*?p_observable_criterion_at_time text,[\s\S]*?p_entry_method text,[\s\S]*?p_observations jsonb/,
  );
  assert.match(save, /returns setof public\.lesson_component_observation/);
  assert.match(save, /security definer[\s\S]*?set search_path = ''/);
  assert.match(
    migration,
    /revoke all on function public\.save_lesson_component_observations\([\s\S]*?from public, anon, authenticated, service_role;[\s\S]*?grant execute on function public\.save_lesson_component_observations\([\s\S]*?to postgres, authenticated;/,
  );
});

test("save RPC validates a bounded exact batch and derives source context", () => {
  const save = functionBody("save_lesson_component_observations");

  for (const fragment of [
    "jsonb_array_length(p_observations) not between 1 and 200",
    "'learningRecordId', 'rating', 'privateNote'",
    "lesson_component_observation_entry_invalid",
    "lesson_component_observation_record_duplicate",
    "lesson_component_observation_criterion_required",
    "p_entry_method is null",
    "p_entry_method not in ('direct', 'bulk_confirmed')",
    "component_position_at_time = v_component.position",
    "component_type_key_at_time = btrim(v_component.type_key)",
    "source_lesson_component_id_at_time",
  ]) {
    assert.equal(save.includes(fragment), true, `missing ${fragment}`);
  }

  assert.doesNotMatch(
    save,
    /submitted\.value ->> '(?:entryMethod|observedAt)'/,
  );
  assert.doesNotMatch(
    save,
    /component\.payload|placement_config|student_slide_id/,
  );
  assert.match(
    save,
    /nullif\(btrim\(submitted\.value ->> 'privateNote'\), ''\)/,
  );
  assert.match(save, /v_observed_at timestamptz := clock_timestamp\(\)/);
});

test("save RPC serializes lifecycle and rejects foreign or closed context", () => {
  const save = functionBody("save_lesson_component_observations");

  const lessonLock = save.indexOf("for update of lesson;");
  const componentLock = save.indexOf("for update of component;");
  const runLock = save.indexOf("for update of run;");
  const recordLock = save.indexOf("for update of record;");
  assert.equal(
    lessonLock >= 0 &&
      lessonLock < componentLock &&
      componentLock < runLock &&
      runLock < recordLock,
    true,
  );

  assert.match(save, /account\.auth_user_id = v_actor_user_id/);
  assert.match(save, /run\.lesson_id = v_lesson_id/);
  assert.match(save, /record\.lesson_run_id = v_run\.id/);
  assert.match(save, /record\.recorded_by_account_id = v_actor_account_id/);
  assert.match(save, /record\.occurred_at is null/);
  assert.match(
    save,
    /v_run\.cancelled_at is not null or v_run\.ended_at is not null[\s\S]*?lesson_run_not_open/,
  );
  assert.match(
    save,
    /v_run\.started_at is null or not v_run\.started_at_is_actual[\s\S]*?lesson_run_not_started/,
  );
});

test("not observed deletes only an open draft and rated saves share criterion", () => {
  const save = functionBody("save_lesson_component_observations");

  assert.match(
    save,
    /delete from public\.lesson_component_observation[\s\S]*?jsonb_typeof\(submitted\.value -> 'rating'\)[\s\S]*?= 'null'/,
  );
  assert.match(
    save,
    /update public\.lesson_component_observation as observation[\s\S]*?observable_criterion_at_time =[\s\S]*?btrim\(p_observable_criterion_at_time\)[\s\S]*?record\.lesson_run_id = v_run\.id/,
  );
  assert.match(
    save,
    /on conflict \([\s\S]*?learning_record_id,[\s\S]*?source_lesson_component_id_at_time[\s\S]*?\) do update/,
  );
  assert.doesNotMatch(save, /bulk_draft|not_observed/);
});

test("completion rejects absent learners with observations without deriving outcomes", () => {
  const completion = functionBody("complete_lesson_run_v2");
  const lessonLock = completion.indexOf("for update of lesson;");
  const componentLock = completion.indexOf("for update of component;");
  const runLock = completion.indexOf("for update of run;");
  const recordLock = completion.indexOf("for update of record;");
  assert.equal(
    lessonLock >= 0 &&
      lessonLock < componentLock &&
      componentLock < runLock &&
      runLock < recordLock,
    true,
  );
  assert.match(
    completion,
    /join public\.lesson_component_observation as observation[\s\S]*?where not \(submitted\.value ->> 'wasPresent'\)::boolean[\s\S]*?lesson_run_absent_learner_has_observation/,
  );

  assert.match(
    completion,
    /was_present = \(submitted\.value ->> 'wasPresent'\)::boolean/,
  );
  assert.match(
    completion,
    /needs_repeat = case[\s\S]*?submitted\.value -> 'needsRepeat'/,
  );
  assert.match(
    completion,
    /teacher_report = nullif\(btrim\(p_teacher_report\), ''\)/,
  );
  assert.doesNotMatch(
    completion,
    /set[\s\S]*?(?:was_present|needs_repeat|teacher_report)[^;]*?observation\.rating/i,
  );
});

test("deletion semantics retain final at-time context and erase subject data", () => {
  const table = tableBody("lesson_component_observation");

  assert.match(table, /learning_record[\s\S]*?on delete cascade/);
  assert.match(table, /lesson_component[\s\S]*?on delete set null/);
  assert.match(table, /source_lesson_component_id_at_time uuid not null/);
  assert.match(table, /component_label_at_time text not null/);
  assert.match(table, /observable_criterion_at_time text not null/);
  assert.match(
    migration,
    /create function public\.delete_draft_observations_for_lesson_component\(\)[\s\S]*?record\.occurred_at is null[\s\S]*?observation\.lesson_component_id = old\.id/,
  );
  assert.match(
    migration,
    /create trigger trg_lesson_component_delete_draft_observations[\s\S]*?before delete on public\.lesson_component/,
  );
  assert.match(
    migration,
    /revoke all on function[\s\S]*?delete_draft_observations_for_lesson_component\(\)[\s\S]*?from public, anon, authenticated, service_role/,
  );
  const deleteComponent = functionBody("delete_lesson_component");
  const lessonLock = deleteComponent.indexOf("for update of lesson;");
  const componentLock = deleteComponent.indexOf("for update of component;");
  const runLock = deleteComponent.indexOf("for update of run;");
  const recordLock = deleteComponent.indexOf("for update of record;");
  assert.equal(
    lessonLock >= 0 &&
      lessonLock < componentLock &&
      componentLock < runLock &&
      runLock < recordLock,
    true,
  );
  assert.match(
    deleteComponent,
    /join public\.lesson_run as run on run\.id = record\.lesson_run_id[\s\S]*?where run\.lesson_id = v_lesson_id/,
  );
  const deleteLesson = functionBody("delete_lesson_with_history");
  assert.match(
    deleteLesson,
    /for update of component[\s\S]*?for update of run[\s\S]*?for update of record/,
  );
  assert.match(
    deleteLesson,
    /set lesson_run_id = null,[\s\S]*?source_lesson_id = null[\s\S]*?record\.occurred_at is not null/,
  );
});

test("postflight audits constraints, ACL, RLS, and the completion guard", () => {
  for (const fragment of [
    "learning_activity_postflight_rls_failed",
    "learning_activity_postflight_constraint_failed",
    "learning_activity_postflight_table_acl_failed",
    "learning_activity_postflight_rpc_acl_failed",
    "learning_activity_postflight_delete_lifecycle_failed",
    "learning_activity_postflight_completion_guard_failed",
    "confdeltype = 'c'",
    "confdeltype = 'n'",
    "procedure.prosecdef",
    "procedure.proretset",
  ]) {
    assert.equal(migration.includes(fragment), true, `missing ${fragment}`);
  }
});

test("snapshot refresh refuses a partial LA-M1 lifecycle contract", () => {
  for (const fragment of [
    "'public.delete_draft_observations_for_lesson_component()'",
    "'public.delete_lesson_component(uuid)'::regprocedure",
    "'public.delete_lesson_with_history(uuid)'::regprocedure",
    "'trg_lesson_component_delete_draft_observations'",
    "trigger.tgtype = 11",
    "'delete from public.lesson_component_observation'",
    "'record.occurred_at is null'",
    "'observation.lesson_component_id = old.id'",
    "'set lesson_run_id = null,'",
    "'source_lesson_id = null'",
    "'record.occurred_at is not null'",
    "lesson_run_absent_learner_has_observation",
  ]) {
    assert.equal(
      refreshScript.includes(fragment),
      true,
      `refresh signature missing ${fragment}`,
    );
  }

  for (const requiredMarker of [
    '"learning_record_id_recorded_by_unique"',
    '"lesson_component_observation_record_source_unique"',
    '"lesson_component_observation_record_recorder_fkey"',
    '"lesson_component_observation_live_component_fkey"',
    '"CREATE INDEX lesson_component_observation_live_component_idx"',
    '"CREATE INDEX lesson_component_observation_recorder_observed_idx"',
    '"CREATE TRIGGER trg_lesson_component_observation_updated_at"',
    '"CREATE FUNCTION public.delete_draft_observations_for_lesson_component"',
    '"CREATE TRIGGER trg_lesson_component_delete_draft_observations"',
    '"lesson_run_absent_learner_has_observation"',
    '"set lesson_run_id = null,"',
    '"source_lesson_id = null"',
  ]) {
    assert.equal(
      refreshScript.includes(requiredMarker),
      true,
      `refresh required markers missing ${requiredMarker}`,
    );
  }

  assert.match(
    refreshScript,
    /'for update of component'[\s\S]*?'public\.delete_lesson_component\(uuid\)'::regprocedure[\s\S]*?\)[\s\S]*?> position\([\s\S]*?'for update of lesson'/,
  );
  assert.match(
    refreshScript,
    /'for update of run'[\s\S]*?'public\.delete_lesson_with_history\(uuid\)'::regprocedure[\s\S]*?\)[\s\S]*?> position\([\s\S]*?'for update of component'/,
  );
  const completionGuard = refreshScript.indexOf(
    "like '%lesson_run_absent_learner_has_observation%'",
  );
  assert.notEqual(completionGuard, -1);
  const completionOrderEnd = refreshScript.indexOf(
    "and exists (",
    completionGuard,
  );
  assert.notEqual(completionOrderEnd, -1);
  const completionOrder = refreshScript.slice(
    completionGuard,
    completionOrderEnd,
  );
  for (const lock of [
    "'for update of lesson'",
    "'for update of component'",
    "'for update of run'",
    "'for update of record'",
  ]) {
    assert.equal(completionOrder.includes(lock), true);
  }
  assert.equal((completionOrder.match(/> position\(/g) ?? []).length, 3);
});

test("current snapshot contains the complete LA-M1 physical contract", () => {
  const table = snapshotTableBody("lesson_component_observation");
  const lowerTable = table.toLowerCase();

  for (const column of [
    "id uuid",
    "learning_record_id uuid not null",
    "lesson_component_id uuid",
    "source_lesson_component_id_at_time uuid not null",
    "component_position_at_time integer not null",
    "component_type_key_at_time text not null",
    "component_label_at_time text not null",
    "observable_criterion_at_time text not null",
    "rating text not null",
    "entry_method text not null",
    "private_note text",
    "observed_at timestamp with time zone",
    "recorded_by_account_id uuid not null",
    "created_at timestamp with time zone",
    "updated_at timestamp with time zone",
  ]) {
    assert.equal(
      lowerTable.includes(column),
      true,
      `snapshot missing ${column}`,
    );
  }

  for (const constraint of [
    "lesson_component_observation_live_source_check",
    "lesson_component_observation_position_check",
    "lesson_component_observation_type_key_check",
    "lesson_component_observation_label_check",
    "lesson_component_observation_criterion_check",
    "lesson_component_observation_rating_check",
    "lesson_component_observation_entry_method_check",
    "lesson_component_observation_private_note_check",
  ]) {
    assert.equal(
      lowerTable.includes(`constraint ${constraint}`),
      true,
      `snapshot missing ${constraint}`,
    );
  }

  assert.match(
    snapshot,
    /ADD CONSTRAINT learning_record_id_recorded_by_unique UNIQUE \(id, recorded_by_account_id\);/,
  );
  assert.match(
    snapshot,
    /ADD CONSTRAINT lesson_component_observation_pkey PRIMARY KEY \(id\);/,
  );
  assert.match(
    snapshot,
    /ADD CONSTRAINT lesson_component_observation_record_source_unique UNIQUE \(learning_record_id, source_lesson_component_id_at_time\);/,
  );
  assert.match(
    snapshot,
    /ADD CONSTRAINT lesson_component_observation_record_recorder_fkey FOREIGN KEY \(learning_record_id, recorded_by_account_id\) REFERENCES public\.learning_record\(id, recorded_by_account_id\) ON DELETE CASCADE;/,
  );
  assert.match(
    snapshot,
    /ADD CONSTRAINT lesson_component_observation_live_component_fkey FOREIGN KEY \(lesson_component_id\) REFERENCES public\.lesson_component\(id\) ON DELETE SET NULL;/,
  );
  assert.match(
    snapshot,
    /CREATE INDEX lesson_component_observation_live_component_idx ON public\.lesson_component_observation USING btree \(lesson_component_id\) WHERE \(lesson_component_id IS NOT NULL\);/,
  );
  assert.match(
    snapshot,
    /CREATE INDEX lesson_component_observation_recorder_observed_idx ON public\.lesson_component_observation USING btree \(recorded_by_account_id, observed_at DESC, id\);/,
  );
  assert.match(
    snapshot,
    /CREATE TRIGGER trg_lesson_component_observation_updated_at BEFORE UPDATE ON public\.lesson_component_observation FOR EACH ROW EXECUTE FUNCTION public\.set_updated_at\(\);/,
  );

  assert.match(
    snapshot,
    /ALTER TABLE public\.lesson_component_observation ENABLE ROW LEVEL SECURITY;/,
  );
  assert.match(
    snapshot,
    /CREATE POLICY lesson_component_observation_recorder_select ON public\.lesson_component_observation FOR SELECT TO authenticated USING \([\s\S]*?current_account_id\(\)[\s\S]*?\);/,
  );
  assert.match(
    snapshot,
    /GRANT ALL ON TABLE public\.lesson_component_observation TO postgres;/,
  );
  assert.match(
    snapshot,
    /GRANT ALL ON TABLE public\.lesson_component_observation TO service_role;/,
  );
  assert.match(
    snapshot,
    /GRANT SELECT ON TABLE public\.lesson_component_observation TO authenticated;/,
  );
  assert.doesNotMatch(
    snapshot,
    /GRANT [^;]+ ON TABLE public\.lesson_component_observation TO (?:PUBLIC|anon);/,
  );
  assert.doesNotMatch(
    snapshot,
    /GRANT (?:INSERT|UPDATE|DELETE)[^;]*ON TABLE public\.lesson_component_observation TO authenticated;/,
  );

  const save = snapshotFunctionBody("save_lesson_component_observations");
  assert.match(save, /RETURNS SETOF public\.lesson_component_observation/i);
  assert.match(save, /SECURITY DEFINER/i);
  assert.match(save, /SET search_path (?:TO|=) ''/i);
  assert.match(
    save,
    /jsonb_array_length\(p_observations\) not between 1 and 200/i,
  );
  assert.match(save, /for update of lesson;/i);
  assert.match(save, /for update of component;/i);
  assert.match(save, /for update of run;/i);
  assert.match(save, /for update of record;/i);
  assert.match(
    snapshot,
    /REVOKE ALL ON FUNCTION public\.save_lesson_component_observations\([^;]+\) FROM PUBLIC;/,
  );
  assert.match(
    snapshot,
    /GRANT ALL ON FUNCTION public\.save_lesson_component_observations\([^;]+\) TO authenticated;/,
  );

  const deleteDraft = snapshotFunctionBody(
    "delete_draft_observations_for_lesson_component",
  ).toLowerCase();
  assert.match(deleteDraft, /security definer/);
  assert.match(deleteDraft, /set search_path (?:to|=) ''/);
  assert.match(deleteDraft, /delete from public\.lesson_component_observation/);
  assert.match(deleteDraft, /record\.occurred_at is null/);
  assert.match(deleteDraft, /observation\.lesson_component_id = old\.id/);
  assert.match(
    snapshot,
    /CREATE TRIGGER trg_lesson_component_delete_draft_observations BEFORE DELETE ON public\.lesson_component FOR EACH ROW EXECUTE FUNCTION public\.delete_draft_observations_for_lesson_component\(\);/,
  );
  assert.match(
    snapshot,
    /REVOKE ALL ON FUNCTION public\.delete_draft_observations_for_lesson_component\(\) FROM PUBLIC;/,
  );
  assert.doesNotMatch(
    snapshot,
    /GRANT ALL ON FUNCTION public\.delete_draft_observations_for_lesson_component\(\) TO (?:anon|authenticated|service_role);/,
  );

  const deleteComponent = snapshotFunctionBody(
    "delete_lesson_component",
  ).toLowerCase();
  assertLifecycleLockOrder(deleteComponent, "snapshot delete_lesson_component");

  const deleteLesson = snapshotFunctionBody(
    "delete_lesson_with_history",
  ).toLowerCase();
  assertLifecycleLockOrder(deleteLesson, "snapshot delete_lesson_with_history");
  assert.match(
    deleteLesson,
    /set lesson_run_id = null,[\s\S]*?source_lesson_id = null/,
  );
  assert.match(deleteLesson, /record\.occurred_at is not null/);

  const completion = snapshotFunctionBody(
    "complete_lesson_run_v2",
  ).toLowerCase();
  assertLifecycleLockOrder(completion, "snapshot complete_lesson_run_v2");
  assert.match(completion, /lesson_run_absent_learner_has_observation/);
  assert.match(completion, /join public\.lesson_component_observation/);
});

test("learner and observer snapshot projections cannot expose private observations", () => {
  for (const functionName of [
    "learner_safe_history_projection",
    "get_my_learning_history",
    "get_observed_learner_history",
  ]) {
    const body = snapshotFunctionBody(functionName).toLowerCase();
    assert.doesNotMatch(body, /lesson_component_observation/);
    assert.doesNotMatch(body, /private_note/);
  }
});

test("LA-M3 is one additive guarded migration with closed raw-table ACL", () => {
  assert.match(profileMigration, /^begin;\n/);
  assert.match(
    profileMigration,
    /\nnotify pgrst, 'reload schema';\n\ncommit;\n$/,
  );
  assert.equal((profileMigration.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((profileMigration.match(/^commit;$/gm) ?? []).length, 1);
  assert.doesNotMatch(
    profileMigration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );

  for (const tableName of [
    "learning_evidence",
    "learner_objective_state",
    "learner_objective_state_evidence",
    "learner_recommendation_override",
  ]) {
    assert.ok(profileTableBody(tableName));
    assert.match(
      profileMigration,
      new RegExp(
        `alter table public\\.${tableName} enable row level security;`,
      ),
    );
  }

  const rawGrant = profileMigration.slice(
    profileMigration.indexOf("grant all on table\n  public.learning_evidence"),
    profileMigration.indexOf(
      "-- Every workflow which can change the evidence set",
    ),
  );
  assert.match(rawGrant, /to postgres;/);
  assert.match(rawGrant, /grant select on table[\s\S]*?to authenticated;/);
  assert.doesNotMatch(rawGrant, /to service_role;/);
  assert.match(
    profileMigration,
    /has_table_privilege\(\s*'service_role', 'public\.learning_evidence', 'SELECT'/,
  );
  for (const tableName of [
    "learner_objective_state",
    "learner_objective_state_evidence",
    "learner_recommendation_override",
  ]) {
    assert.match(
      profileMigration,
      new RegExp(
        `has_table_privilege\\(\\s*'service_role', 'public\\.${tableName}', 'SELECT'`,
      ),
    );
  }
});

test("LA-M5 keeps quiz tables closed and generalizes typed evidence exactly once", () => {
  assert.match(choiceQuizMigration, /^begin;\n/);
  assert.match(choiceQuizMigration, /\ncommit;\n$/);

  for (const tableName of [
    "choice_quiz_issue",
    "choice_quiz_attempt",
    "choice_quiz_response",
    "choice_quiz_evaluation",
    "choice_quiz_feedback_delivery",
  ]) {
    assert.match(
      choiceQuizMigration,
      new RegExp(`create table public\\.${tableName} \\(`),
    );
    assert.match(
      choiceQuizMigration,
      new RegExp(
        `alter table public\\.${tableName} enable row level security;`,
      ),
    );
    assert.match(
      choiceQuizMigration,
      new RegExp(
        `revoke all on table public\\.${tableName}\\s+from public, anon, authenticated, service_role;`,
      ),
    );
    assert.match(
      choiceQuizMigration,
      new RegExp(`grant all on table public\\.${tableName} to postgres;`),
    );
  }

  assert.match(
    choiceQuizMigration,
    /alter column learning_record_id drop not null/,
  );
  assert.match(
    choiceQuizMigration,
    /alter column source_observation_id drop not null/,
  );
  assert.match(
    choiceQuizMigration,
    /add column source_choice_quiz_evaluation_id uuid/,
  );
  assert.match(
    choiceQuizMigration,
    /learning_evidence_exact_source_check check \([\s\S]*?source_observation_id is not null[\s\S]*?source_choice_quiz_evaluation_id is null[\s\S]*?learning_record_id is not null[\s\S]*?or \([\s\S]*?source_observation_id is null[\s\S]*?source_choice_quiz_evaluation_id is not null[\s\S]*?learning_record_id is null/,
  );
  for (const reasonCode of [
    "choice_quiz_independent_positive_evidence",
    "choice_quiz_supported_positive_evidence",
    "choice_quiz_not_yet_negative_evidence",
  ]) {
    assert.match(choiceQuizMigration, new RegExp(reasonCode));
  }
  assert.match(
    choiceQuizMigration,
    /source_observation_id is not null and eligibility_policy_version = 1/,
  );
  assert.match(
    choiceQuizMigration,
    /source_choice_quiz_evaluation_id is not null[\s\S]*?eligibility_policy_version = 2/,
  );
  assert.match(
    choiceQuizMigration,
    /'sourceKind', case[\s\S]*?evidence\.source_observation_id is not null[\s\S]*?'observation'[\s\S]*?'choice_quiz_evaluation'/,
  );
  assert.match(
    choiceQuizMigration,
    /'sourceChoiceQuizEvaluationId',[\s\S]*?evidence\.source_choice_quiz_evaluation_id/,
  );
  const evidenceGuard = functionBodyIn(
    choiceQuizMigration,
    "guard_learning_evidence_immutable",
  );
  assert.doesNotMatch(evidenceGuard, /'learning_record_id'/);
  assert.doesNotMatch(evidenceGuard, /new\.learning_record_id/);
  assert.match(
    choiceQuizMigration,
    /count\(distinct lower\(option\.value ->> 'id'\)\)/,
  );
  assert.match(
    choiceQuizMigration,
    /count\(distinct lower\(answer\.value #>> '\{\}'\)\)/,
  );
  assert.match(
    choiceQuizMigration,
    /order by \(answer\.value #>> '\{\}'\)::uuid/,
  );
  const projectionMatcher = functionBodyIn(
    choiceQuizMigration,
    "choice_quiz_projection_matches_payload",
  );
  assert.match(projectionMatcher, /lower\(authored\.value ->> 'id'\)/);
  assert.match(projectionMatcher, /lower\(delivered\.value ->> 'id'\)/);
  assert.match(projectionMatcher, /lower\(answer\.value #>> '\{\}'\)/);

  for (const functionName of [
    "issue_choice_quiz_definition_admin",
    "submit_choice_quiz_attempt_admin",
    "correct_choice_quiz_evaluation_admin",
    "list_choice_quiz_run_history_admin",
    "resolve_lesson_run_live_source_choice_quiz_admin",
  ]) {
    const body = functionBodyIn(choiceQuizMigration, functionName);
    assert.match(body, /security definer/i);
    assert.match(body, /set search_path = ''/i);
    assert.match(
      choiceQuizMigration,
      new RegExp(
        `revoke all on function public\\.${functionName}\\([\\s\\S]*?from public, anon, authenticated;`,
      ),
    );
  }
  assert.match(
    choiceQuizMigration,
    /grant execute on function public\.submit_choice_quiz_attempt_admin\([\s\S]*?\) to service_role, postgres;/,
  );
  const issueChoiceQuiz = functionBodyIn(
    choiceQuizMigration,
    "issue_choice_quiz_definition_admin",
  );
  assert.equal(
    issueChoiceQuiz.indexOf("lock_learning_activity_learners") <
      issueChoiceQuiz.indexOf("for share of session") &&
      issueChoiceQuiz.indexOf("for share of session") <
        issueChoiceQuiz.indexOf("for share of account, profile") &&
      issueChoiceQuiz.indexOf("for share of account, profile") <
        issueChoiceQuiz.indexOf("for share of security") &&
      issueChoiceQuiz.indexOf("for share of security") <
        issueChoiceQuiz.indexOf("for share of course") &&
      issueChoiceQuiz.indexOf("for share of course") <
        issueChoiceQuiz.indexOf("for share of lesson"),
    true,
  );
  assert.match(
    choiceQuizMigration,
    /count\(distinct evidence\.source_lesson_run_id_at_time\)/,
  );
  const currentAccount = functionBodyIn(
    choiceQuizMigration,
    "current_active_session_account_id",
  );
  assert.match(currentAccount, /security definer/);
  assert.match(currentAccount, /auth\.jwt\(\) ->> 'session_id'/);
  assert.match(currentAccount, /join auth\.sessions as session/);
  assert.match(
    currentAccount,
    /account\.status in \('active', 'provisional'\)/,
  );
  assert.match(currentAccount, /session\.not_after > statement_timestamp\(\)/);
  assert.match(
    currentAccount,
    /session\.created_at >= security\.sessions_invalid_before/,
  );
  for (const [tableName, policyName] of [
    ["learning_evidence", "learning_evidence_recorder_select"],
    ["learner_objective_state", "learner_objective_state_recorder_select"],
    [
      "learner_objective_state_evidence",
      "learner_objective_state_evidence_recorder_select",
    ],
    [
      "learner_recommendation_override",
      "learner_recommendation_override_recorder_select",
    ],
  ] as const) {
    assert.match(
      choiceQuizMigration,
      new RegExp(`drop policy ${policyName}\\s+on public\\.${tableName}`),
    );
    assert.match(
      choiceQuizMigration,
      new RegExp(
        `create policy ${policyName}[\\s\\S]*?current_active_session_account_id\\(\\)`,
      ),
    );
  }
  const sessionAuthority = functionBodyIn(
    choiceQuizMigration,
    "lock_current_account_session_authority",
  );
  assert.match(sessionAuthority, /auth\.jwt\(\) ->> 'session_id'/);
  assert.match(sessionAuthority, /for share of session/);
  assert.match(sessionAuthority, /for share of account, security/);
  assert.equal(
    sessionAuthority.indexOf("for share of session") <
      sessionAuthority.indexOf("for share of account, security"),
    true,
  );
  assert.match(
    choiceQuizMigration,
    /create function public\.get_teacher_learner_activity_profile_v2/,
  );
  assert.match(
    choiceQuizMigration,
    /create function public\.teacher_learning_activity_profile_projection_v2/,
  );
  assert.match(
    choiceQuizMigration,
    /create or replace function public\.resolve_lesson_run_live_source_admin/,
  );
  const choiceResolver = functionBodyIn(
    choiceQuizMigration,
    "resolve_lesson_run_live_source_choice_quiz_admin",
  );
  assert.match(choiceResolver, /primaryLearningObjectiveId/);
  assert.equal(
    choiceResolver.indexOf("lock_learning_activity_learners") <
      choiceResolver.indexOf("for share of session"),
    true,
  );
  const legacyResolver = functionBodyIn(
    choiceQuizMigration,
    "resolve_lesson_run_live_source_admin",
  );
  assert.match(
    legacyResolver,
    /resolve_lesson_run_live_source_choice_quiz_admin/,
  );
  assert.match(legacyResolver, /component\.value - array/);
  for (const privateM5Key of [
    "id",
    "primaryLearningObjectiveId",
    "activityRole",
    "updatedAt",
  ]) {
    assert.match(legacyResolver, new RegExp(`'${privateM5Key}'`));
  }
  const cancel = functionBodyIn(choiceQuizMigration, "cancel_lesson_run");
  assert.match(cancel, /detach_choice_quiz_history_from_learning_records/);
  assert.match(cancel, /delete from public\.learning_record as record/);
  assert.equal(
    cancel.indexOf("lock_current_account_session_authority") <
      cancel.indexOf("for update of course") &&
      cancel.indexOf("for update of course") <
        cancel.indexOf("for update of lesson"),
    true,
  );
  const history = functionBodyIn(
    choiceQuizMigration,
    "list_choice_quiz_run_history_admin",
  );
  assert.match(history, /lock_learning_activity_learners/);
  assert.match(history, /from public\.learning_record as record/);
  assert.match(history, /v_current_learner_profile_ids is distinct from/);
  assert.match(history, /choice_quiz_history_stale/);
  assert.match(history, /auth\.sessions/);
  assert.match(history, /security\.sessions_invalid_before/);
  const correction = functionBodyIn(
    choiceQuizMigration,
    "correct_choice_quiz_evaluation_admin",
  );
  assert.match(correction, /lock_learning_activity_learners/);
  assert.match(correction, /auth\.sessions/);
  assert.match(correction, /security\.sessions_invalid_before/);
  assert.match(correction, /course\.owner_account_id = v_actor_account_id/);
  assert.equal(
    correction.indexOf("lock_learning_activity_learners") <
      correction.indexOf("for share of session"),
    true,
  );
  assert.equal(
    correction.indexOf("lock_learning_activity_learners") <
      correction.indexOf("for share of account"),
    true,
  );
  assert.equal(
    correction.indexOf("for share of course") <
      correction.indexOf("for update of evaluation"),
    true,
  );
  assert.equal(
    correction.indexOf("for update of evidence") <
      correction.indexOf("for share of issue"),
    true,
  );
  assert.match(
    correction,
    /insert into public\.learning_evidence \([\s\S]*?\) values \(\s*v_old_evidence\.learner_profile_id,\s*v_old_evidence\.recorded_by_account_id,\s*null,\s*null,\s*v_new_evaluation_id,/,
  );
  assert.doesNotMatch(correction, /v_old_evidence\.learning_record_id/);
  const submit = functionBodyIn(
    choiceQuizMigration,
    "submit_choice_quiz_attempt_admin",
  );
  assert.match(submit, /choice_quiz_execution_payload_at_attempt/);
  assert.match(
    submit,
    /insert into public\.learning_evidence \([\s\S]*?\) values \(\s*v_issue\.learner_profile_id,\s*v_issue\.recorded_by_account_id,\s*null,\s*null,\s*v_evaluation_id,/,
  );
  assert.doesNotMatch(submit, /v_issue\.learning_record_id/);
  assert.equal(
    submit.indexOf("lock_learning_activity_learners") <
      submit.indexOf("for share of session"),
    true,
  );
  const detach = functionBodyIn(
    choiceQuizMigration,
    "detach_choice_quiz_history_from_learning_records",
  );
  assert.match(
    detach,
    /from public\.choice_quiz_evaluation as evaluation[\s\S]*?join public\.choice_quiz_issue as issue[\s\S]*?issue\.learning_record_id = any\(p_learning_record_ids\)/,
  );
  assert.doesNotMatch(
    detach.slice(
      detach.indexOf("update public.learning_evidence"),
      detach.indexOf("update public.choice_quiz_issue"),
    ),
    /set learning_record_id = null,/,
  );
  assert.equal(
    detach.indexOf("update public.learning_evidence") <
      detach.indexOf("update public.choice_quiz_issue"),
    true,
  );
  const transfer = functionBodyIn(
    choiceQuizMigration,
    "transfer_detached_choice_quiz_history_on_profile_merge",
  );
  assert.equal(
    transfer.indexOf("update public.learning_evidence") <
      transfer.indexOf("update public.choice_quiz_issue"),
    true,
  );
  for (const deletionName of [
    "delete_lesson_component",
    "delete_lesson_with_history",
  ]) {
    const deletion = functionBodyIn(choiceQuizMigration, deletionName);
    assert.equal(
      deletion.indexOf("lock_current_account_session_authority") <
        deletion.indexOf("for update of course") &&
        deletion.indexOf("for update of course") <
          deletion.indexOf("for update of lesson"),
      true,
    );
    assert.equal(
      deletion.indexOf("for update of evidence") <
        deletion.indexOf("for update of issue"),
      true,
    );
  }
  const legacyProjection = functionBodyIn(
    choiceQuizMigration,
    "teacher_learning_activity_profile_projection",
  );
  assert.match(
    legacyProjection,
    /teacher_learning_activity_legacy_observation_state/,
  );
  assert.match(legacyProjection, /candidate\.has_observation desc/);
  assert.match(legacyProjection, /limit 200/);
  assert.match(legacyProjection, /source_observation_id is not null/);
  assert.match(legacyProjection, /source_choice_quiz_evaluation_id is null/);
  assert.doesNotMatch(
    legacyProjection,
    /teacher_learning_activity_profile_projection_v2/,
  );
  const legacyObservationState = functionBodyIn(
    choiceQuizMigration,
    "teacher_learning_activity_legacy_observation_state",
  );
  assert.match(legacyObservationState, /source_observation_id is not null/);
  assert.match(
    legacyObservationState,
    /source_choice_quiz_evaluation_id is null/,
  );
  assert.match(legacyObservationState, /eligibility_policy_version = 1/);
  assert.match(legacyObservationState, /record\.was_present/);
  assert.match(legacyObservationState, /'sourceObservationId'/);
  assert.match(legacyObservationState, /p_fallback_state ->> 'evaluatedAt'/);
  assert.match(
    legacyObservationState,
    /greatest\(v_state_evaluated_at, v_freshness_due_at\)/,
  );
  assert.match(legacyObservationState, /'status', 'no_data'/);
  assert.doesNotMatch(legacyObservationState, /'sourceKind'/);
  const legacyOverrideToken = functionBodyIn(
    choiceQuizMigration,
    "teacher_learning_activity_legacy_override_token_is_valid",
  );
  assert.match(
    legacyOverrideToken,
    /latest\.observed_at \+ interval '90 days'/,
  );
  const recommendationOverride = functionBodyIn(
    choiceQuizMigration,
    "set_learner_recommendation_override",
  );
  assert.match(
    recommendationOverride,
    /teacher_learning_activity_legacy_override_token_is_valid/,
  );
  assert.equal(
    recommendationOverride.indexOf("lock_learning_activity_learners") <
      recommendationOverride.indexOf("lock_current_account_session_authority"),
    true,
  );
  const teacherProfileV2 = functionBodyIn(
    choiceQuizMigration,
    "get_teacher_learner_activity_profile_v2",
  );
  const teacherProfileLegacy = functionBodyIn(
    choiceQuizMigration,
    "get_teacher_learner_activity_profile",
  );
  const selfProfile = functionBodyIn(
    choiceQuizMigration,
    "get_my_learning_activity_profile",
  );
  assert.equal(
    selfProfile.indexOf("lock_learning_activity_learners") <
      selfProfile.indexOf("lock_current_account_session_authority") &&
      selfProfile.indexOf("lock_current_account_session_authority") <
        selfProfile.indexOf("for update of profile") &&
      selfProfile.indexOf("for update of profile") <
        selfProfile.indexOf("refresh_learning_activity_states_for_profile"),
    true,
  );
  const observerProfile = functionBodyIn(
    choiceQuizMigration,
    "get_observed_learner_activity_profile",
  );
  assert.equal(
    observerProfile.indexOf("lock_learning_activity_learners") <
      observerProfile.indexOf("lock_current_account_session_authority") &&
      observerProfile.indexOf("lock_current_account_session_authority") <
        observerProfile.indexOf("for update of profile") &&
      observerProfile.indexOf("for update of profile") <
        observerProfile.indexOf("for share of grant_row"),
    true,
  );
  assert.equal(
    teacherProfileLegacy.indexOf("lock_learning_activity_learners") <
      teacherProfileLegacy.indexOf("lock_current_account_session_authority") &&
      teacherProfileLegacy.indexOf("lock_current_account_session_authority") <
        teacherProfileLegacy.indexOf("for share of relation"),
    true,
  );
  assert.equal(
    teacherProfileV2.indexOf("lock_learning_activity_learners") <
      teacherProfileV2.indexOf("lock_current_account_session_authority"),
    true,
  );
  const erasurePreview = functionBodyIn(
    choiceQuizMigration,
    "preview_my_learning_data_erasure",
  );
  assert.match(erasurePreview, /- 'choiceQuizIssueCount'/);
  assert.equal(
    erasurePreview.indexOf("lock_learning_activity_learners") <
      erasurePreview.indexOf("lock_current_account_session_authority") &&
      erasurePreview.indexOf("lock_current_account_session_authority") <
        erasurePreview.indexOf("for share of profile") &&
      erasurePreview.indexOf("for share of profile") <
        erasurePreview.indexOf("delete from public.learner_erasure_request"),
    true,
  );
  const erasure = functionBodyIn(
    choiceQuizMigration,
    "confirm_my_learning_data_erasure",
  );
  assert.match(erasure, /p_session_id uuid/);
  assert.match(erasure, /v_counts := v_current_base/);
  assert.equal(
    erasure.indexOf("lock_learning_activity_learners") <
      erasure.indexOf("for share of session") &&
      erasure.indexOf("for share of session") <
        erasure.indexOf("for update of account") &&
      erasure.indexOf("for update of account") <
        erasure.indexOf("for share of security"),
    true,
  );
  assert.match(erasure, /account\.status = 'active'/);
  assert.match(erasure, /learning_data_erasure_session_revoked/);
  assert.match(
    choiceQuizMigration,
    /drop function public\.confirm_my_learning_data_erasure\(uuid, text\)/,
  );
  assert.match(
    choiceQuizMigration,
    /grant execute on function public\.confirm_my_learning_data_erasure\([\s\S]*?uuid, uuid, text[\s\S]*?\) to service_role, postgres;/,
  );
});

test("schema refresh fail-closes on the exact LA-M5 database contract", () => {
  const tableNames = [
    "choice_quiz_issue",
    "choice_quiz_attempt",
    "choice_quiz_response",
    "choice_quiz_evaluation",
    "choice_quiz_feedback_delivery",
  ];
  const serviceSignatures = [
    "public.issue_choice_quiz_definition_admin(uuid,uuid,uuid,uuid,bigint,timestamp with time zone,jsonb,jsonb)",
    "public.submit_choice_quiz_attempt_admin(uuid,uuid,uuid,text,bigint,uuid,uuid[])",
    "public.correct_choice_quiz_evaluation_admin(uuid,uuid,uuid,boolean,text,uuid)",
    "public.list_choice_quiz_run_history_admin(uuid,uuid,uuid)",
    "public.resolve_lesson_run_live_source_choice_quiz_admin(uuid,uuid,uuid)",
  ];
  const teacherSignatures = [
    "public.get_my_learning_activity_profile()",
    "public.get_observed_learner_activity_profile(uuid)",
    "public.get_teacher_learner_activity_profile(uuid)",
    "public.get_teacher_learner_activity_profile_v2(uuid)",
    "public.current_active_session_account_id()",
  ];
  const helperSignatures = [
    "public.choice_quiz_learner_definition_is_valid(jsonb)",
    "public.choice_quiz_evaluator_config_is_valid(jsonb,jsonb)",
    "public.guard_choice_quiz_issue_immutable()",
    "public.guard_choice_quiz_attempt_immutable()",
    "public.guard_choice_quiz_strictly_immutable()",
    "public.guard_choice_quiz_evaluation_immutable()",
    "public.assert_choice_quiz_evaluation_supersession_chain()",
    "public.choice_quiz_projection_matches_payload(jsonb,jsonb,jsonb)",
    "public.choice_quiz_execution_payload_at_attempt(uuid,integer)",
    "public.choice_quiz_execution_payload(uuid)",
    "public.choice_quiz_history_item(uuid)",
    "public.lock_current_account_session_authority(uuid)",
    "public.detach_choice_quiz_history_from_learning_records(uuid[])",
    "public.delete_draft_learning_records_for_lesson_run()",
    "public.guard_learning_record_choice_quiz_presence()",
    "public.transfer_detached_choice_quiz_history_on_profile_merge()",
    "public.guard_choice_quiz_profile_unlink()",
    "public.guard_learning_evidence_immutable()",
    "public.rebuild_learner_objective_state_for_actor(uuid,uuid,uuid,timestamp with time zone)",
    "public.learning_activity_scope_fingerprint(uuid[])",
    "public.execute_learner_profile_merge_for_actor(uuid,uuid,text)",
    "public.learner_erasure_state_for_actor(uuid,uuid)",
    "public.learner_safe_unlink_preview_for_actor(uuid)",
    "public.teacher_learning_activity_legacy_observation_state(uuid,uuid,uuid,timestamp with time zone,jsonb)",
    "public.teacher_learning_activity_legacy_override_token_is_valid(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)",
    "public.teacher_learning_activity_profile_projection(uuid,uuid,timestamp with time zone)",
    "public.teacher_learning_activity_profile_projection_v2(uuid,uuid,timestamp with time zone)",
  ];
  const triggerNames = [
    "trg_choice_quiz_issue_immutable",
    "trg_choice_quiz_attempt_immutable",
    "trg_choice_quiz_response_immutable",
    "trg_choice_quiz_evaluation_immutable",
    "trg_choice_quiz_feedback_immutable",
    "trg_choice_quiz_evaluation_supersession_chain",
    "trg_learning_record_choice_quiz_presence",
    "trg_learner_profile_transfer_detached_choice_quiz",
    "trg_learner_profile_choice_quiz_unlink_guard",
    "trg_learner_profile_choice_quiz_delete_guard",
  ];

  for (const marker of [
    ...tableNames,
    ...serviceSignatures,
    ...teacherSignatures,
    ...helperSignatures,
    ...triggerNames,
    "choice_quiz_table(table_name)",
    "choice_quiz_service_rpc(signature)",
    "choice_quiz_teacher_rpc(signature)",
    "choice_quiz_internal_helper(signature)",
    "choice_quiz_trigger(",
    "choice_quiz_function_marker(signature, marker)",
    "relation.relrowsecurity",
    "pg_get_userbyid(relation.relowner) <> 'supabase_admin'",
    "from choice_quiz_table as required_table\n           join pg_policy as policy",
    "array['anon', 'authenticated', 'service_role']",
    "acl_entry.grantee = 0",
    "not procedure.prosecdef",
    `procedure.proconfig @> array['search_path=""']`,
    "'service_role', procedure.oid, 'EXECUTE'",
    "'postgres', procedure.oid, 'EXECUTE'",
    "database_trigger.tgtype <> required_trigger.trigger_type",
    "required_trigger.is_constraint",
    "required_trigger.is_deferrable",
    "required_trigger.is_initially_deferred",
    "learning_evidence_exact_source_check",
    "learning_evidence_semantics_check",
    "learning_evidence_version_check",
    "learning_evidence_choice_quiz_evaluation_fkey",
    "source_choice_quiz_evaluation_id is not null",
    "learning_record_id is null",
    "eligibility_policy_version = 2",
    "choice_quiz_issue_record_identity_fkey",
    "choice_quiz_attempt_issue_learner_fkey",
    "confupdtype = 'c'",
    "confdeltype = 'c'",
    "'primaryLearningObjectiveId'",
    "component.primary_learning_objective_id",
    "'activityRole'",
    "component.activity_role",
    "'updatedAt'",
    "component.updated_at",
    "limit 5001",
    "'truncated'",
    "choice_quiz_history_stale",
    "lock_learning_activity_learners",
    "'quiz-issue:'",
    "'quiz-attempt:'",
    "'quiz-response:'",
    "'quiz-evaluation:'",
    "'quiz-feedback:'",
    "learning_activity_scope_fingerprint",
    "app.learner_identity_merge",
    "app.learner_identity_erasure",
    "'choiceQuizFeedbackDeliveryCount'",
    "'sourceKind'",
    "'sourceChoiceQuizEvaluationId'",
    "choice_quiz_service_rpc_name",
    "get_teacher_learner_activity_profile_v2",
    "choice_quiz_internal_helper_name",
    "generated result has incomplete service-only ACL",
    "generated result has incomplete closed helper ACL",
    "generated result exposes a choice_quiz table through a policy",
    "generated result exposes raw choice_quiz table privileges",
    "generated result exposes a choice_quiz internal helper",
    "generated result exposes a choice_quiz service RPC to a browser role",
  ]) {
    assert.equal(refreshScript.includes(marker), true, marker);
  }

  const tableContract = refreshScript.slice(
    refreshScript.indexOf("choice_quiz_table(table_name)"),
    refreshScript.indexOf("choice_quiz_service_rpc(signature)"),
  );
  assert.equal((tableContract.match(/\('choice_quiz_/g) ?? []).length, 5);

  const rpcContract = refreshScript.slice(
    refreshScript.indexOf("choice_quiz_service_rpc(signature)"),
    refreshScript.indexOf("choice_quiz_teacher_rpc(signature)"),
  );
  assert.equal((rpcContract.match(/\('public\./g) ?? []).length, 5);

  const teacherRpcContract = refreshScript.slice(
    refreshScript.indexOf("choice_quiz_teacher_rpc(signature)"),
    refreshScript.indexOf("choice_quiz_internal_helper(signature)"),
  );
  assert.equal((teacherRpcContract.match(/\('public\./g) ?? []).length, 5);

  const helperContract = refreshScript.slice(
    refreshScript.indexOf("choice_quiz_internal_helper(signature)"),
    refreshScript.indexOf("choice_quiz_function(signature)"),
  );
  assert.equal((helperContract.match(/\('public\./g) ?? []).length, 27);

  const triggerContract = refreshScript.slice(
    refreshScript.indexOf("choice_quiz_trigger("),
    refreshScript.indexOf("choice_quiz_function_marker(signature, marker)"),
  );
  assert.equal((triggerContract.match(/27::smallint/g) ?? []).length, 5);
  assert.equal((triggerContract.match(/21::smallint/g) ?? []).length, 1);
  assert.equal((triggerContract.match(/23::smallint/g) ?? []).length, 1);
  assert.equal((triggerContract.match(/11::smallint/g) ?? []).length, 2);
  assert.equal((triggerContract.match(/19::smallint/g) ?? []).length, 1);
  for (const triggerName of triggerNames) {
    assert.equal(triggerContract.includes(`'${triggerName}'`), true);
    assert.equal(
      refreshScript.includes(
        `"CREATE${
          triggerName.endsWith("supersession_chain") ? " CONSTRAINT" : ""
        } TRIGGER ${triggerName}"`,
      ),
      true,
    );
  }

  for (const tableName of tableNames) {
    assert.equal(
      refreshScript.includes(`"CREATE TABLE public.${tableName}"`),
      true,
    );
    assert.equal(
      refreshScript.includes(
        `"ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;"`,
      ),
      true,
    );
    assert.equal(
      refreshScript.includes(
        `"GRANT ALL ON TABLE public.${tableName} TO postgres;"`,
      ),
      true,
    );
  }
});

test("LA-M3 evidence is identity-consistent, immutable, and deletion-safe", () => {
  const evidence = profileTableBody("learning_evidence");
  const links = profileTableBody("learner_objective_state_evidence");
  assert.match(evidence, /component_visibility_at_time text not null/);
  assert.match(
    evidence,
    /component_visibility_at_time in \('learner_visible', 'staff_only'\)/,
  );
  assert.match(
    profileMigration,
    /add column component_visibility_at_time text null[\s\S]*?lesson_component_observation_visibility_at_time_check/,
  );
  const visibilityCapture = functionBodyIn(
    profileMigration,
    "capture_observation_component_visibility",
  );
  assert.match(
    visibilityCapture,
    /new\.corrected_from_observation_id is not null/,
  );
  assert.match(visibilityCapture, /component\.visibility/);
  assert.match(
    profileMigration,
    /create trigger trg_observation_component_visibility[\s\S]*?component_label_at_time/,
  );
  for (const constraint of [
    "learning_evidence_record_identity_fkey",
    "learning_evidence_observation_identity_fkey",
    "learning_evidence_state_identity_unique",
    "learning_evidence_supersedes_fkey",
    "learning_evidence_superseded_by_fkey",
  ]) {
    assert.match(evidence, new RegExp(`constraint ${constraint}`));
  }
  assert.match(
    links,
    /learner_objective_state_evidence_state_identity_fkey[\s\S]*?learner_objective_state_evidence_fact_identity_fkey/,
  );

  const immutable = functionBodyIn(
    profileMigration,
    "guard_learning_evidence_immutable",
  ).toLowerCase();
  assert.match(immutable, /old\.lesson_component_id is not null/);
  assert.match(immutable, /new\.lesson_component_id is null/);
  assert.match(immutable, /old\.learning_objective_id is not null/);
  assert.match(immutable, /new\.learning_objective_id is null/);
  assert.match(immutable, /new\.component_visibility_at_time/);
  assert.match(immutable, /app\.learner_identity_merge/);
  assert.match(immutable, /app\.learning_activity_materialization/);
  assert.match(immutable, /app\.learner_identity_erasure/);

  const supersession = functionBodyIn(
    profileMigration,
    "assert_learning_evidence_supersession_chain",
  ).toLowerCase();
  assert.match(supersession, /prior\.superseded_by_evidence_id = new\.id/);
  assert.match(supersession, /replacement\.supersedes_evidence_id = new\.id/);
  for (const identityPart of [
    "recorded_by_account_id",
    "learner_profile_id",
    "source_course_id_at_time",
    "source_learning_objective_id_at_time",
  ]) {
    assert.match(supersession, new RegExp(identityPart));
  }
  assert.match(
    profileMigration,
    /create constraint trigger trg_learning_evidence_supersession_chain[\s\S]*?deferrable initially deferred/,
  );
});

test("LA-M3 completion, rebuild and correction preserve chronology contracts", () => {
  const completion = functionBodyIn(
    profileMigration,
    "complete_lesson_run_v2",
  ).toLowerCase();
  const learnerLock = completion.indexOf("lock_learning_activity_learners");
  const lessonLock = completion.indexOf("for update of lesson;");
  assert.equal(learnerLock >= 0 && learnerLock < lessonLock, true);
  assert.match(completion, /materialize_learning_evidence_for_records/);
  assert.match(completion, /rebuild_learner_objective_state_for_actor/);
  assert.match(
    profileMigration,
    /grant execute on function public\.complete_lesson_run_v2\([\s\S]*?\) to postgres, authenticated, service_role;/,
  );

  const materialize = functionBodyIn(
    profileMigration,
    "materialize_learning_evidence_for_records",
  ).toLowerCase();
  for (const eligibility of [
    "record.occurred_at is not null",
    "record.was_present",
    "record.superseded_by_record_id is null",
    "observation.superseded_by_observation_id is null",
    "observation.source_learning_objective_id_at_time is not null",
  ]) {
    assert.match(materialize, new RegExp(eligibility.replaceAll(".", "\\.")));
  }
  assert.match(
    materialize,
    /observation\.component_visibility_at_time = 'learner_visible'[\s\S]*?else 'staff_only'/,
  );

  const rebuild = functionBodyIn(
    profileMigration,
    "rebuild_learner_objective_state_for_actor",
  );
  for (const policyMarker of [
    "latest_not_yet",
    "latest_with_support",
    "independent_opportunities_missing",
    "multiple_independent_opportunities",
    "confirmed_evidence_stale",
    "interval '90 days'",
    "count(distinct evidence.source_lesson_run_id_at_time)",
  ]) {
    assert.equal(rebuild.includes(policyMarker), true, policyMarker);
  }
  assert.doesNotMatch(profileTableBody("learner_objective_state"), /no_data/);

  const correction = functionBodyIn(
    profileMigration,
    "correct_finalized_lesson_component_observation",
  );
  assert.match(correction, /v_corrected_at timestamptz := clock_timestamp\(\)/);
  assert.match(correction, /correction_idempotency_conflict/g);
  assert.match(correction, /learning_observation_correction_no_change/);
  assert.match(
    correction,
    /p_rating is not distinct from v_source_observation\.rating[\s\S]*?p_private_note[\s\S]*?v_source_observation\.private_note/,
  );
  assert.match(
    correction,
    /v_replay_observation\.rating is distinct from p_rating/,
  );
  assert.match(
    correction,
    /v_replay_observation\.private_note is distinct from[\s\S]*?nullif\(btrim\(p_private_note\), ''\)/,
  );
  assert.match(
    correction,
    /component_visibility_at_time[\s\S]*?v_old_observation\.component_visibility_at_time/,
  );
  assert.match(
    profileMigration,
    /correct_finalized_lesson_component_observation\(\s*uuid, uuid, uuid, text, text, text, uuid, timestamptz/,
  );

  const correctionHistory = functionBodyIn(
    profileMigration,
    "get_teacher_learning_record_correction_history",
  );
  assert.match(
    correctionHistory,
    /cardinality\(p_active_learning_record_ids\)/,
  );
  assert.match(correctionHistory, /v_input_count not between 1 and 200/);
  assert.match(correctionHistory, /lock_learning_activity_learners/);
  assert.match(correctionHistory, /for share of profile/);
  assert.match(correctionHistory, /with recursive lineage/);
  assert.match(correctionHistory, /lineage\.depth < 201/);
  assert.match(correctionHistory, /limit 201/);
  assert.match(correctionHistory, /'activeLearningRecordId'/);
  assert.match(correctionHistory, /'oldPrivateNote'/);
  assert.match(correctionHistory, /'newPrivateNote'/);
  assert.match(correctionHistory, /'correctionReason'/);
  assert.match(correctionHistory, /'truncated'/);
  assert.match(
    profileMigration,
    /grant execute on function public\.get_teacher_learning_record_correction_history\([\s\S]*?uuid\[\][\s\S]*?\) to postgres, authenticated;/,
  );
});

test("LA-M3 profile DTOs synthesize bounded no_data without private notes", () => {
  const teacher = functionBodyIn(
    profileMigration,
    "teacher_learning_activity_profile_projection",
  );
  assert.match(teacher, /'no_data'::text/);
  assert.match(teacher, /null::uuid/);
  assert.match(teacher, /limit 200/i);
  assert.match(teacher, /'stateId', projected\.state_id/);

  const safe = functionBodyIn(
    profileMigration,
    "safe_learning_activity_profile_projection",
  );
  assert.match(safe, /'no_data'::text/);
  assert.match(safe, /limit 200/i);
  assert.match(safe, /limit 5/i);
  assert.match(safe, /'las_' \|\| encode/);
  assert.match(safe, /'lae_' \|\| encode/);
  assert.doesNotMatch(safe, /private_reason/i);
  assert.doesNotMatch(safe, /private_note/i);
  assert.match(
    safe,
    /evidence\.component_visibility_at_time = 'learner_visible'/,
  );
  assert.match(safe, /Служебный компонент преподавателя/);
  assert.match(safe, /Служебный критерий преподавателя/);

  const observer = functionBodyIn(
    profileMigration,
    "get_observed_learner_activity_profile",
  );
  assert.match(observer, /for share of grant_row/i);
  assert.match(observer, /learner_observer_activity_profile_read/);
});

test("Course activity AI RPC is own-recorder/current-Course and service-only", () => {
  const projection = functionBodyIn(
    profileMigration,
    "course_learning_activity_projection",
  );
  assert.match(
    projection,
    /state\.recorded_by_account_id = p_recorded_by_account_id/,
  );
  assert.match(projection, /state\.source_course_id_at_time = p_course_id/);
  assert.match(
    projection,
    /where not exists \([\s\S]*?state\.learner_profile_id = profiles\.id[\s\S]*?state\.recorded_by_account_id = p_recorded_by_account_id[\s\S]*?state\.source_course_id_at_time = course\.id/,
  );
  assert.match(projection, /limit 80/i);
  assert.match(projection, /limit 3/i);
  assert.match(projection, /'las_' \|\| encode/);
  assert.match(projection, /'lae_' \|\| encode/);
  assert.match(
    projection,
    /evidence\.component_visibility_at_time = 'learner_visible'/,
  );
  assert.match(projection, /Служебный компонент преподавателя/);
  assert.match(projection, /Служебный критерий преподавателя/);
  assert.doesNotMatch(projection, /private_reason/i);
  assert.doesNotMatch(projection, /private_note/i);

  const builder = functionBodyIn(
    profileMigration,
    "build_course_learning_activity_context",
  );
  assert.match(builder, /course\.owner_account_id = v_actor_account_id/);
  assert.match(builder, /from public\.course_learner as direct/);
  assert.match(builder, /from public\.course_learner_group as course_group/);
  assert.match(builder, /v_actor_account_id,[\s\S]*?v_generated_at/);
  assert.match(builder, /'revision', repeat\('0', 64\)/);
  assert.match(builder, /'projectionVersion', 1/);
  assert.match(builder, /'includedStateCount'/);
  assert.match(builder, /'evidenceReferenceCount'/);
  assert.match(
    builder,
    /v_total_state_count::text \|\| ':' \|\| v_states::text/,
  );
  assert.doesNotMatch(builder, /learner_ai_consent/);
  assert.doesNotMatch(builder, /valid_consents/);
  assert.doesNotMatch(
    profileMigration,
    /create function public\.build_cross_provider_learning_activity_context/,
  );
  assert.match(
    profileMigration,
    /to_regprocedure\(\s*'public\.build_cross_provider_learner_context\(uuid,uuid\)'\s*\) is null/,
  );
  assert.match(
    profileMigration,
    /not has_function_privilege\(\s*'service_role',\s*'public\.build_cross_provider_learner_context\(uuid,uuid\)',\s*'EXECUTE'/,
  );
  assert.match(
    profileMigration,
    /has_function_privilege\(\s*'authenticated',\s*'public\.build_cross_provider_learner_context\(uuid,uuid\)',\s*'EXECUTE'/,
  );
  assert.match(
    profileMigration,
    /grant execute on function public\.build_course_learning_activity_context\([\s\S]*?\) to postgres, service_role;/,
  );
  assert.match(
    profileMigration,
    /has_function_privilege\(\s*'authenticated',[\s\S]*?'public\.build_course_learning_activity_context\(uuid,uuid\)'/,
  );
});

test("LA-M3 merge and erasure bind scope and preserve active correction chains", () => {
  const preview = functionBodyIn(
    profileMigration,
    "learner_profile_merge_preview_for_actor",
  );
  assert.match(preview, /source_record\.superseded_by_record_id is null/);
  assert.match(preview, /target_record\.superseded_by_record_id is null/);
  assert.match(preview, /for update of operation/);
  assert.match(preview, /v_operation\.status = 'cancelled'/);
  assert.match(preview, /operation\.status in \('pending', 'ready'\)/);
  assert.match(preview, /get diagnostics v_update_count = row_count/);

  const merge = functionBodyIn(
    profileMigration,
    "execute_learner_profile_merge_for_actor",
  );
  assert.match(merge, /source_record\.superseded_by_record_id is null/);
  assert.match(merge, /target_record\.superseded_by_record_id is null/);
  assert.match(merge, /learning_activity_scope_fingerprint/);
  assert.match(merge, /lock_learning_activity_learners/);
  assert.match(merge, /app\.learner_identity_merge/);

  const erasure = functionBodyIn(
    profileMigration,
    "confirm_my_learning_data_erasure",
  );
  assert.match(erasure, /learning_activity_scope_fingerprint/);
  assert.match(erasure, /lock_learning_activity_learners/);
  assert.match(erasure, /delete from public\.learner_objective_state_evidence/);
  assert.match(erasure, /delete from public\.learner_recommendation_override/);
  assert.match(erasure, /delete from public\.learner_objective_state/);
  assert.match(erasure, /delete from public\.learning_evidence/);
});

test("schema refresh gate requires the LA-M3 signatures without snapshot edits", () => {
  for (const marker of [
    "learning_evidence",
    "learner_objective_state",
    "learner_objective_state_evidence",
    "learner_recommendation_override",
    "correct_finalized_lesson_component_observation(uuid,uuid,uuid,text,text,text,uuid,timestamp with time zone)",
    "get_teacher_learner_activity_profile(uuid)",
    "get_my_learning_activity_profile()",
    "get_observed_learner_activity_profile(uuid)",
    "build_course_learning_activity_context(uuid,uuid)",
  ]) {
    assert.equal(refreshScript.includes(marker), true, marker);
  }
  assert.match(
    refreshScript,
    /has_function_privilege\(\s*'service_role',\s*'public\.complete_lesson_run_v2\(uuid,jsonb,text,timestamptz,integer\)'/,
  );
});
