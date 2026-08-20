import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260819142602_learning_activity_foundation.sql",
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

function functionBody(name: string) {
  const createStart = migration.indexOf(`create function public.${name}(`);
  const replaceStart = migration.indexOf(
    `create or replace function public.${name}(`,
  );
  const start = createStart === -1 ? replaceStart : createStart;
  assert.notEqual(start, -1, `missing function ${name}`);
  const delimiter = migration.indexOf("as $function$", start);
  assert.notEqual(delimiter, -1, `missing function delimiter for ${name}`);
  const end = migration.indexOf("\n$function$;", delimiter);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end + 12);
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
