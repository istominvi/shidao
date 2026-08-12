import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260812113000_educator_course_attestations.sql";
const migration = readFileSync(migrationPath, "utf8");
const snapshotRefresh = readFileSync(
  "scripts/refresh-schema-snapshot.sh",
  "utf8",
);

function migrationFunction(name: string) {
  const create = migration.indexOf(`create function public.${name}(`);
  const replace = migration.indexOf(
    `create or replace function public.${name}(`,
  );
  const start = create === -1 ? replace : create;
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf("\n$function$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end + "\n$function$;".length);
}

const attestationTables = [
  "course_attestation",
  "course_publication_attestation",
  "course_attestation_attempt",
  "course_attestation_award",
] as const;

test("educator attestations are one forward-only guarded migration", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\nnotify pgrst, 'reload schema';\n\ncommit;\n$/);
  assert.doesNotMatch(
    migration,
    /drop\s+(?:table|schema|function)[^;]*\bcascade\b/i,
  );
  assert.match(migration, /shidao_schema_sanity_check_failed/);
  assert.match(migration, /educator_course_attestation_objects_already_exist/);
  assert.match(
    migration,
    /lock table public\.course in share row exclusive mode;[\s\S]*lock table public\.course_publication in share row exclusive mode;[\s\S]*lock table public\.course_publication_revision in share row exclusive mode;/,
  );
});

test("Course and compact publication rows have a distinct learning audience", () => {
  assert.match(
    migration,
    /alter table public\.course\s+add column learning_audience text not null default 'children'/,
  );
  assert.match(
    migration,
    /alter table public\.course_publication\s+add column learning_audience text not null default 'children'/,
  );
  assert.equal(
    (
      migration.match(
        /check \(learning_audience in \('children', 'educators'\)\)/g,
      ) ?? []
    ).length,
    2,
  );
  assert.match(
    migration,
    /grant update \(learning_audience\) on table public\.course to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /alter table public\.course\s+add column audience_type/,
  );
});

test("the live aggregate and immutable issuance graph keep exact definitions", () => {
  for (const table of attestationTables) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
  }

  assert.match(
    migration,
    /create table public\.course_attestation \([\s\S]*course_id uuid primary key[\s\S]*version integer not null[\s\S]*passing_score_percent integer not null[\s\S]*questions jsonb not null/,
  );
  assert.match(
    migration,
    /create table public\.course_publication_attestation \([\s\S]*revision_id uuid primary key[\s\S]*publication_id uuid not null[\s\S]*course_attestation_definition_is_valid/,
  );
  assert.match(
    migration,
    /course_publication_attestation_revision_identity_fkey[\s\S]*foreign key \(publication_id, revision_id\)[\s\S]*references public\.course_publication_revision\(publication_id, id\)/,
  );
  assert.match(
    migration,
    /course_attestation_attempt_publication_revision_fkey[\s\S]*references public\.course_publication_attestation/,
  );
  assert.match(
    migration,
    /course_attestation_attempt_score_consistency_check check \([\s\S]*score_percent = floor\([\s\S]*correct_answer_count::numeric \* 100 \/ question_count/,
  );
  assert.match(migration, /trg_course_attestation_attempt_insert/);
  assert.match(
    migrationFunction("guard_course_attestation_attempt_insert"),
    /course_attestation_attempt_snapshot_mismatch[\s\S]*course_attestation_attempt_answers_mismatch[\s\S]*course_attestation_attempt_score_mismatch/,
  );
  assert.match(
    migration,
    /course_attestation_award_account_revision_unique\s+unique \(account_id, revision_id\)/,
  );
  assert.match(
    migration,
    /course_attestation_award_attempt_identity_fkey[\s\S]*references public\.course_attestation_attempt/,
  );
});

test("one validator enforces exact question and option shapes everywhere", () => {
  const questions = migrationFunction("course_attestation_questions_are_valid");
  const definition = migrationFunction(
    "course_attestation_definition_is_valid",
  );

  assert.match(
    questions,
    /v_question - array\[[\s\S]*'correctOptionId',[\s\S]*'explanation'[\s\S]*\]\) <> '\{\}'::jsonb/,
  );
  assert.match(
    questions,
    /v_option - array\['id', 'label'\]\) <> '\{\}'::jsonb/,
  );
  assert.match(questions, /jsonb_array_length\(p_questions\) > 50/);
  assert.match(questions, /jsonb_array_length\(v_question -> 'options'\) > 8/);
  assert.match(questions, /count\(distinct question\.value ->> 'id'\)/);
  assert.match(questions, /count\(distinct option\.value ->> 'id'\)/);
  assert.match(
    questions,
    /option\.value ->> 'id' = v_question ->> 'correctOptionId'/,
  );
  assert.match(
    definition,
    /public\.course_attestation_questions_are_valid\(p_questions\)/,
  );
  assert.equal(
    (migration.match(/course_attestation_definition_is_valid\(/g) ?? [])
      .length >= 5,
    true,
  );
});

test("live definitions are educator-only and advance the publication clock", () => {
  const liveGuard = migrationFunction(
    "guard_course_attestation_live_definition",
  );
  const audienceGuard = migrationFunction(
    "guard_course_learning_audience_change",
  );
  const touch = migrationFunction("touch_course_from_attestation_child");
  const courseClock = migrationFunction(
    "set_course_publication_content_updated_at",
  );

  assert.match(liveGuard, /course\.learning_audience/);
  assert.match(liveGuard, /v_learning_audience <> 'educators'/);
  assert.match(liveGuard, /course\.archived_at/);
  assert.match(
    audienceGuard,
    /old\.learning_audience = 'educators'[\s\S]*new\.learning_audience = 'children'[\s\S]*public\.course_attestation/,
  );
  assert.match(audienceGuard, /security definer/);
  assert.match(touch, /security definer/);
  assert.match(
    touch,
    /set updated_at = clock_timestamp\(\),\s+publication_content_updated_at = clock_timestamp\(\)/,
  );
  assert.match(
    courseClock,
    /new\.learning_audience is distinct from old\.learning_audience/,
  );
  assert.match(migration, /trg_course_attestation_touch_course/);
});

test("immutable attestation rows have no direct browser table surface", () => {
  for (const table of [
    "course_publication_attestation",
    "course_attestation_attempt",
    "course_attestation_award",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated;`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant all on table public\\.${table}[\\s\\S]*?to postgres, service_role;`,
      ),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`create policy[^;]+on public\\.${table}`),
    );
  }

  assert.match(migration, /create policy course_attestation_owner_all/);
  assert.match(
    migration,
    /course\.owner_account_id = \(\s*select public\.current_account_id\(\)/,
  );
  assert.match(migration, /trg_course_publication_attestation_immutable/);
  assert.match(migration, /trg_course_attestation_attempt_immutable/);
  assert.match(migration, /trg_course_attestation_award_immutable/);
});

test("publication wrappers preserve old atomic implementations and sidecar definitions", () => {
  const publish = migrationFunction(
    "publish_course_revision_with_attestation_admin",
  );
  const clone = migrationFunction(
    "clone_course_publication_with_attestation_admin",
  );
  const preflight = migrationFunction(
    "assert_course_publication_copy_eligible_admin",
  );
  const duplicate = migrationFunction(
    "duplicate_course_with_attestation_admin",
  );

  assert.match(publish, /security invoker/);
  assert.match(publish, /public\.publish_course_revision_admin\(/);
  assert.match(publish, /p_learning_audience text,[\s\S]*p_attestation jsonb/);
  assert.match(publish, /p_attestation is distinct from v_live_json/);
  assert.match(publish, /insert into public\.course_publication_attestation/);
  assert.match(publish, /course_publication_attestation_revision_conflict/);
  assert.match(publish, /set learning_audience = p_learning_audience/);

  assert.match(clone, /public\.clone_course_publication_admin\(/);
  assert.match(
    clone,
    /course_attestation_award[\s\S]*award\.account_id = p_actor_account_id[\s\S]*award\.revision_id = v_publication\.current_revision_id[\s\S]*course_attestation_required_before_clone[\s\S]*errcode = '42501'[\s\S]*v_result := public\.clone_course_publication_admin/,
  );
  assert.match(clone, /insert into public\.course_attestation/);
  assert.match(
    clone,
    /set learning_audience = v_publication\.learning_audience/,
  );

  assert.match(preflight, /security invoker/);
  assert.match(preflight, /actor_account\.status = 'active'/);
  assert.match(preflight, /owner_account\.status = 'active'/);
  assert.match(preflight, /publication\.status = 'published'/);
  assert.match(
    preflight,
    /course_attestation_award[\s\S]*award\.account_id = p_actor_account_id[\s\S]*award\.revision_id = v_publication\.current_revision_id[\s\S]*course_attestation_required_before_clone[\s\S]*errcode = '42501'/,
  );
  assert.match(preflight, /return jsonb_build_object\('eligible', true\)/);

  assert.match(duplicate, /public\.duplicate_course_admin\(/);
  assert.match(duplicate, /insert into public\.course_attestation/);
  assert.match(
    duplicate,
    /set learning_audience = v_source\.learning_audience/,
  );

  for (const name of [
    "publish_course_revision_with_attestation_admin",
    "clone_course_publication_with_attestation_admin",
    "duplicate_course_with_attestation_admin",
    "assert_course_publication_copy_eligible_admin",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated, service_role;[\\s\\S]*?grant execute on function public\\.${name}\\([\\s\\S]*?to postgres, service_role;`,
      ),
    );
  }
});

test("catalog v2 filters and facets before pagination by learning audience", () => {
  const catalog = migrationFunction("list_course_publication_catalog_v2_admin");

  assert.match(
    catalog,
    /p_learning_audience text,[\s\S]*p_subject text,[\s\S]*p_offset integer/,
  );
  assert.equal(
    (
      catalog.match(/publication\.learning_audience = p_learning_audience/g) ??
      []
    ).length,
    3,
    "page, subject facets, and level facets must share the audience scope",
  );
  assert.match(catalog, /'learningAudience', publication\.learning_audience/);
  assert.match(catalog, /limit p_limit \+ 1/);
  assert.equal((catalog.match(/limit 100/g) ?? []).length, 2);
  assert.doesNotMatch(
    catalog,
    /revision\.snapshot|course_publication_revision/,
  );
});

test("authenticated RPCs score exact answers server-side and reveal keys only after award", () => {
  const get = migrationFunction("get_my_course_publication_attestation");
  const submit = migrationFunction("submit_my_course_publication_attestation");
  const list = migrationFunction("list_my_course_publication_attestations");

  for (const body of [get, submit, list]) {
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /account\.auth_user_id = \(select auth\.uid\(\)\)/);
    assert.match(body, /account\.status = 'active'/);
  }

  assert.match(get, /publication\.current_revision_id/);
  assert.match(get, /owner_account\.status = 'active'/);
  assert.match(
    get,
    /when v_certified then question\.value ->> 'correctOptionId'\s+else null/,
  );
  assert.match(
    get,
    /when v_certified then question\.value ->> 'explanation'\s+else null/,
  );

  assert.match(submit, /for update of publication/);
  assert.match(submit, /p_expected_revision_id uuid/);
  assert.match(
    submit,
    /v_publication\.current_revision_id <> p_expected_revision_id[\s\S]*course_attestation_revision_stale[\s\S]*errcode = '40001'/,
  );
  assert.match(
    submit,
    /v_attestation\.revision_id <> p_expected_revision_id[\s\S]*course_attestation_revision_stale/,
  );
  assert.match(submit, /course_attestation_selected_answers_are_valid/);
  assert.match(submit, /jsonb_object_keys/);
  assert.match(
    submit,
    /p_selected_option_by_question_id ->> \(question\.value ->> 'id'\)\s+= question\.value ->> 'correctOptionId'/,
  );
  assert.match(
    submit,
    /v_score_percent := floor\([\s\S]*v_correct_answer_count::numeric \* 100 \/ v_question_count/,
  );
  assert.doesNotMatch(submit, /p_score|p_passed/);
  assert.match(
    submit,
    /if found then\s+return public\.get_my_course_publication_attestation/,
  );
  assert.match(
    submit,
    /if found then\s+return public\.get_my_course_publication_attestation[\s\S]*attempt\.completed_at >= clock_timestamp\(\) - interval '15 minutes'[\s\S]*\) >= 5 then[\s\S]*course_attestation_attempt_rate_limited[\s\S]*errcode = 'P0004'/,
  );
  assert.match(submit, /insert into public\.course_attestation_attempt/);
  assert.match(submit, /insert into public\.course_attestation_award/);

  for (const field of [
    "publicationId",
    "revisionId",
    "courseTitle",
    "courseSubject",
    "assessmentTitle",
    "publisherDisplayName",
    "scorePercent",
    "passingScorePercent",
    "completedAt",
    "assessmentVersion",
    "isCurrentRevision",
    "publicationAvailable",
  ]) {
    assert.match(list, new RegExp(`'${field}'`));
  }
  assert.match(list, /limit 200/);

  for (const name of [
    "get_my_course_publication_attestation",
    "submit_my_course_publication_attestation",
    "list_my_course_publication_attestations",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated, service_role;[\\s\\S]*?grant execute on function public\\.${name}\\([\\s\\S]*?to postgres, authenticated;`,
      ),
    );
  }
});

test("owner authoring RPC replaces the aggregate atomically with monotonic versions", () => {
  const replace = migrationFunction("replace_my_course_attestation");
  const get = migrationFunction("get_my_authored_course_attestation");

  assert.match(replace, /security definer/);
  assert.match(replace, /course\.owner_account_id = v_account_id/);
  assert.match(replace, /course\.archived_at is null/);
  assert.match(replace, /course\.learning_audience = 'educators'/);
  assert.match(replace, /for update of course/);
  assert.match(replace, /for update;/);
  assert.match(
    replace,
    /v_next_version := case when found then v_existing\.version \+ 1 else 1 end/,
  );
  assert.match(replace, /on conflict \(course_id\) do update/);
  assert.match(replace, /'passingScorePercent'/);
  assert.match(replace, /'questions'/);

  assert.match(get, /security definer/);
  assert.match(get, /return null/);
  assert.match(get, /'questions', v_attestation\.questions/);
});

test("postflight checks RLS, closed ACL, function modes, triggers, and backfill", () => {
  assert.match(migration, /course_learning_audience_backfill_failed/);
  assert.match(migration, /course_attestation_acl_postcondition_failed/);
  assert.match(migration, /course_attestation_user_rpc_contract_invalid/);
  assert.match(migration, /course_attestation_admin_rpc_contract_invalid/);
  assert.match(migration, /course_attestation_rls_postcondition_failed/);
  assert.match(migration, /course_attestation_clock_contract_invalid/);
  assert.match(
    migration,
    /course_attestation_private_trigger_contract_invalid/,
  );
  assert.match(migration, /procedure\.prosecdef/);
  assert.match(migration, /procedure\.proconfig @> array\['search_path=""'\]/);
});

test("snapshot refresh accepts only the complete E1 attestation contract", () => {
  for (const table of attestationTables) {
    assert.match(
      snapshotRefresh,
      new RegExp(`to_regclass\\('public\\.${table}'\\) is not null`),
    );
    assert.match(
      snapshotRefresh,
      new RegExp(`"CREATE TABLE public\\.${table}"`),
    );
  }

  assert.match(snapshotRefresh, /\('course', 'learning_audience'\)/);
  assert.match(
    snapshotRefresh,
    /\('course_publication', 'learning_audience'\)/,
  );
  assert.match(snapshotRefresh, /where not relation\.relrowsecurity/);
  assert.match(snapshotRefresh, /course_attestation_owner_all/);
  assert.match(snapshotRefresh, /attestation_user_rpc/);
  assert.match(snapshotRefresh, /attestation_admin_rpc/);
  assert.match(
    snapshotRefresh,
    /public\.assert_course_publication_copy_eligible_admin\(uuid,uuid\)/,
  );
  assert.match(
    snapshotRefresh,
    /public\.submit_my_course_publication_attestation\(uuid,uuid,jsonb\)/,
  );
  assert.match(snapshotRefresh, /to_regclass\('public\.lesson_step'\) is null/);
  assert.match(
    snapshotRefresh,
    /generated result restores forbidden Lesson Step storage/,
  );
});
