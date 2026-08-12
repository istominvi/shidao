import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260812150745_educator_course_governance_progress.sql";
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
  const starts = [create, replace].filter((value) => value >= 0);
  const start = starts.length === 0 ? -1 : Math.min(...starts);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf("\n$function$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end + "\n$function$;".length);
}

test("educator governance is one guarded forward migration", () => {
  assert.match(migration, /^begin;\n/);
  assert.equal((migration.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((migration.match(/^commit;$/gm) ?? []).length, 1);
  assert.match(migration, /\nnotify pgrst, 'reload schema';\n\ncommit;\n$/);
  assert.doesNotMatch(
    migration,
    /drop\s+(?:table|schema|function)[^;]*\bcascade\b/i,
  );
  assert.match(migration, /shidao_schema_sanity_check_failed/);
  assert.match(migration, /educator_course_governance_objects_already_exist/);

  const tablePosition = migration.indexOf(
    "create table public.educator_course_revision_review",
  );
  const rpcPosition = migration.indexOf(
    "create or replace function public.publish_course_revision_with_attestation_admin",
  );
  assert.ok(tablePosition > 0 && rpcPosition > tablePosition);
});

test("Account capability and exact approved revision are canonical database state", () => {
  assert.match(
    migration,
    /alter table public\.account\s+add column can_author_educator_courses boolean not null default false/,
  );
  assert.match(
    migration,
    /alter table public\.course_publication\s+add column approved_revision_id uuid null/,
  );
  assert.match(
    migration,
    /course_publication_approved_revision_fkey[\s\S]*foreign key \(id, approved_revision_id\)[\s\S]*course_publication_revision\(publication_id, id\)/,
  );
  assert.match(
    migrationFunction("current_account_auth_context"),
    /can_author_educator_courses boolean[\s\S]*account\.can_author_educator_courses/,
  );
  assert.match(
    migration,
    /update public\.account as account[\s\S]*set can_author_educator_courses = true[\s\S]*course\.learning_audience = 'educators'/,
  );
  assert.match(
    migration,
    /revoke update \(can_author_educator_courses\) on table public\.account[\s\S]*from public, anon, authenticated/,
  );
  assert.match(migration, /educator_course_capability_update_acl_open/);
  assert.doesNotMatch(
    migration,
    /user_metadata|raw_user_meta_data|app_metadata/,
  );
});

test("official educator revisions require exact service-only review", () => {
  assert.match(
    migration,
    /license_code in \([\s\S]*'shidao_catalog_reuse_v1'[\s\S]*'shidao_official_learning_v1'/,
  );
  assert.match(
    migration,
    /create table public\.educator_course_revision_review \([\s\S]*status text not null check \(status in \('pending', 'approved', 'rejected'\)\)/,
  );
  assert.match(migration, /educator_course_publication_official_check/);
  assert.match(
    migration,
    /validate constraint educator_course_publication_official_check/,
  );

  const licenseInsert = migrationFunction(
    "set_course_publication_revision_license_on_insert",
  );
  assert.match(
    licenseInsert,
    /publication\.source_course_id[\s\S]*course\.learning_audience/,
  );
  assert.match(
    licenseInsert,
    /v_learning_audience = 'educators'[\s\S]*new\.license_code := 'shidao_official_learning_v1'/,
  );
  assert.match(
    migration,
    /disable trigger trg_course_publication_revision_immutable[\s\S]*set license_code = 'shidao_official_learning_v1'[\s\S]*enable trigger trg_course_publication_revision_immutable/,
  );
  assert.match(migration, /educator_course_legacy_copy_origin_exists/);
  assert.match(migration, /trg_course_publication_revision_license_insert/);

  const publish = migrationFunction(
    "publish_course_revision_with_attestation_admin",
  );
  assert.match(publish, /security definer[\s\S]*set search_path = ''/);
  assert.match(publish, /account\.can_author_educator_courses/);
  assert.match(publish, /educator_course_review_already_pending/);
  assert.match(
    publish,
    /review\.status = 'pending'[\s\S]*revision\.content_sha256 <> p_content_sha256[\s\S]*revision\.snapshot is distinct from p_snapshot/,
  );
  assert.doesNotMatch(
    publish,
    /update public\.course_publication_revision[\s\S]*set license_code/,
  );
  assert.match(
    publish,
    /revision\.license_code = 'shidao_official_learning_v1'/,
  );
  assert.match(publish, /insert into public\.educator_course_revision_review/);
  assert.match(publish, /'reviewStatus'/);
  assert.match(publish, /'reviewRevisionId'/);
  assert.match(publish, /'approvedRevisionId'/);

  const approve = migrationFunction("approve_educator_course_revision_admin");
  assert.match(approve, /security invoker[\s\S]*set search_path = ''/);
  assert.match(approve, /v_publication\.current_revision_id <> p_revision_id/);
  assert.match(approve, /v_review\.status <> 'pending'/);
  assert.match(approve, /set approved_revision_id = p_revision_id/);
  assert.match(approve, /status = 'published'/);

  const reject = migrationFunction("reject_educator_course_revision_admin");
  assert.match(reject, /security invoker[\s\S]*set search_path = ''/);
  assert.match(reject, /and review\.status = 'pending'/);
  assert.doesNotMatch(reject, /set approved_revision_id/);

  for (const signature of [
    "approve_educator_course_revision_admin",
    "reject_educator_course_revision_admin",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${signature}\\([\\s\\S]*?from public, anon, authenticated, service_role;[\\s\\S]*?grant execute on function public\\.${signature}\\([\\s\\S]*?to postgres, service_role;`,
      ),
    );
  }
});

test("catalog consumes only the approved immutable educator snapshot", () => {
  const catalog = migrationFunction("list_course_publication_catalog_v2_admin");
  assert.match(
    catalog,
    /when publication\.learning_audience = 'educators'[\s\S]*then publication\.approved_revision_id/,
  );
  assert.match(catalog, /review\.status = 'approved'/);
  assert.match(catalog, /revision\.snapshot -> 'course' ->> 'title'/);
  assert.match(
    catalog,
    /when publication\.learning_audience = 'educators'[\s\S]*then revision\.published_at/,
  );
  assert.match(
    catalog,
    /revision\.license_code = 'shidao_official_learning_v1'/,
  );
  assert.match(catalog, /publication\.is_shidao/);
});

test("self-learning progress is exact-revision, lesson-ref validated, and closed-table", () => {
  for (const table of [
    "course_publication_self_enrollment",
    "course_publication_lesson_completion",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated;`,
      ),
    );
  }

  const get = migrationFunction("get_my_course_publication_progress");
  const set = migrationFunction("set_my_course_publication_lesson_progress");
  const aggregate = migrationFunction(
    "build_course_publication_progress_admin",
  );
  assert.match(get, /publication\.approved_revision_id/);
  assert.match(get, /review\.status = 'approved'/);
  assert.match(get, /security definer[\s\S]*stable/);
  assert.doesNotMatch(
    get,
    /insert into public\.course_publication_self_enrollment/,
  );
  assert.match(set, /v_revision_id <> p_expected_revision_id/);
  assert.match(set, /course_publication_revision_has_lesson_ref/);
  assert.match(
    set,
    /last_opened_lesson_ref = excluded\.last_opened_lesson_ref/,
  );
  assert.match(
    set,
    /if p_completed then[\s\S]*insert into public\.course_publication_lesson_completion[\s\S]*else[\s\S]*delete from public\.course_publication_lesson_completion/,
  );

  for (const key of [
    "publicationId",
    "revisionId",
    "lastOpenedLessonRef",
    "completedLessonRefs",
    "completedLessonCount",
    "totalLessonCount",
    "percent",
    "complete",
  ]) {
    assert.match(aggregate, new RegExp(`'${key}'`));
  }
  assert.match(aggregate, /lesson\.value ->> 'ref'/);
  assert.doesNotMatch(aggregate, /lesson\.value ->> 'id'/);
});

test("existing awarded approved revisions receive fully completed progress", () => {
  assert.match(
    migration,
    /insert into public\.course_publication_self_enrollment[\s\S]*from public\.course_attestation_award as award/,
  );
  assert.match(
    migration,
    /insert into public\.course_publication_lesson_completion[\s\S]*\(lesson\.value ->> 'ref'\)::uuid/,
  );
  assert.match(migration, /educator_course_award_progress_backfill_failed/);
});

test("attestation reads and submissions are locked to completed approved revision", () => {
  const get = migrationFunction("get_my_course_publication_attestation");
  const submit = migrationFunction("submit_my_course_publication_attestation");
  const attemptGuard = migrationFunction(
    "guard_course_attestation_attempt_insert",
  );
  const list = migrationFunction("list_my_course_publication_attestations");

  for (const body of [get, submit, attemptGuard]) {
    assert.match(body, /approved_revision_id/);
    assert.match(body, /build_course_publication_progress_admin/);
    assert.match(body, /course_attestation_lessons_incomplete/);
  }
  assert.match(
    submit,
    /v_publication\.approved_revision_id <> p_expected_revision_id/,
  );
  assert.match(list, /publication\.approved_revision_id = award\.revision_id/);
});

test("educator courses cannot have rosters, LessonRuns, copies, or duplicates", () => {
  assert.match(migration, /educator_course_roster_forbidden/);
  assert.match(migration, /educator_course_lesson_run_forbidden/);
  assert.match(migration, /educator_course_copy_forbidden/);
  assert.match(migration, /educator_course_duplicate_forbidden/);
  assert.match(
    migration,
    /revoke execute on function public\.clone_course_publication_admin[\s\S]*from service_role/,
  );
  assert.match(
    migration,
    /revoke execute on function public\.duplicate_course_admin[\s\S]*from service_role/,
  );
  assert.match(migration, /educator_course_generic_admin_bypass_open/);
});

test("withdraw closes pending review and cannot later be approved", () => {
  const unpublish = migrationFunction("unpublish_course_publication_admin");
  assert.match(
    unpublish,
    /v_review\.status = 'pending'[\s\S]*set status = 'rejected'/,
  );
  assert.match(unpublish, /review_feedback = 'withdrawn_by_author'/);
  assert.match(
    unpublish,
    /approved_revision_id is not null[\s\S]*set status = 'published'/,
  );
  assert.doesNotMatch(
    unpublish,
    /set current_revision_id = publication\.approved_revision_id/,
  );
});

test("snapshot refresh refuses a database missing E2 governance", () => {
  assert.doesNotMatch(
    snapshotRefresh,
    /array\['search_path=""'\]/,
    "double quotes inside the Bash --command string must stay shell-escaped",
  );

  for (const table of [
    "educator_course_revision_review",
    "course_publication_self_enrollment",
    "course_publication_lesson_completion",
  ]) {
    assert.match(
      snapshotRefresh,
      new RegExp(`to_regclass\\('public\\.${table}'\\) is not null`),
    );
  }
  assert.match(snapshotRefresh, /can_author_educator_courses/);
  assert.match(snapshotRefresh, /approved_revision_id/);
  assert.match(snapshotRefresh, /educator_governance_user_rpc/);
  assert.match(snapshotRefresh, /educator_governance_admin_rpc/);
  assert.match(snapshotRefresh, /educator_governance_definer_admin_rpc/);
  assert.match(
    snapshotRefresh,
    /trg_course_publication_revision_license_insert/,
  );
  assert.match(
    snapshotRefresh,
    /set_course_publication_revision_license_on_insert/,
  );
});
