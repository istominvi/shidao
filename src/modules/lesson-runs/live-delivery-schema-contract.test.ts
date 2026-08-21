import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260821093000_lesson_run_live_delivery.sql",
  "utf8",
);
const currentSchema = readFileSync(
  "supabase/schema/current-schema.sql",
  "utf8",
);

function functionBody(name: string) {
  const create = migration.indexOf(`create function public.${name}(`);
  const replace = migration.indexOf(
    `create or replace function public.${name}(`,
  );
  const start = create === -1 ? replace : create;
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

test("LA-M4 is one forward-only migration without live-run backfill", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\ncommit;\n$/);
  assert.doesNotMatch(migration, /drop\s+(?:table|schema)[^;]*\bcascade\b/i);
  assert.match(
    migration,
    /lesson_run_live_delivery_postflight_unexpected_backfill/,
  );
  assert.doesNotMatch(
    migration,
    /insert into public\.course_learner_enrollment[\s\S]*?select[\s\S]*?from public\.course_learner(?:\s|;)/,
  );
});

test("LA-M4 stores three closed capability relations and no parallel lesson model", () => {
  for (const table of [
    "course_learner_enrollment",
    "lesson_run_execution_capability",
    "lesson_run_presentation_state",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`create policy [^;]+ on public\\.${table}`),
    );
  }

  assert.match(
    migration,
    /revoke all on table[\s\S]*?course_learner_enrollment[\s\S]*?lesson_run_execution_capability[\s\S]*?lesson_run_presentation_state[\s\S]*?from public, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(migration, /create table public\.lesson_step/i);
  assert.doesNotMatch(
    migration,
    /create table public\.lesson_run_participant/i,
  );
  assert.doesNotMatch(migration, /create table public\.[a-z_]*attempt/i);
  assert.doesNotMatch(migration, /create table public\.[a-z_]*response/i);
});

test("Course enrollment is explicit, revisioned, and profile-erasure safe", () => {
  const enrollment = tableBody("course_learner_enrollment");
  assert.match(enrollment, /primary key \(course_id, learner_profile_id\)/);
  assert.match(
    enrollment,
    /learner_profile_id[\s\S]*?references public\.learner_profile\(id\)[\s\S]*?on delete cascade/,
  );
  assert.match(enrollment, /status in \('active', 'revoked'\)/);
  assert.match(enrollment, /revision bigint not null default 1/);
  assert.match(
    enrollment,
    /status = 'active'[\s\S]*?revoked_at is null[\s\S]*?status = 'revoked'[\s\S]*?revoked_at is not null/,
  );

  const setter = functionBody("set_lesson_run_live_access");
  assert.match(setter, /record\.learner_profile_id = p_learner_profile_id/);
  assert.match(setter, /learner_account\.status = 'active'/);
  assert.match(setter, /revision = enrollment\.revision \+ 1/);
  assert.match(setter, /teacher_revoked_course_access/);
  assert.match(setter, /teacher_revoked_run_access/);
  assert.match(setter, /run_capability_not_granted/);
  assert.match(setter, /learner_account\.status = 'active'/);
  assert.match(
    setter,
    /account\.id = any\(array\[[\s\S]*?v_actor_account_id,[\s\S]*?v_learner_account_id[\s\S]*?order by account\.id[\s\S]*?for share of account/,
  );
  assert.match(
    setter,
    /profile\.account_id is not distinct from v_learner_account_id/,
  );
  assert.ok(
    setter.indexOf("for share of account") <
      setter.indexOf("for update of profile") &&
      setter.indexOf("for update of profile") <
        setter.indexOf("for update of course"),
    "grant must lock sorted Accounts before exact Profile and Course",
  );
  assert.ok(
    setter.indexOf("perform record.id") <
      setter.indexOf("lesson_run_live_learner_not_eligible"),
    "eligibility must not reveal an offline Profile outside the exact Run roster",
  );
  assert.match(
    setter,
    /if not v_has_current_record[\s\S]*?not p_course_access_enabled[\s\S]*?not p_run_capability_enabled[\s\S]*?v_capability\.lesson_run_id is not null/,
  );
  assert.match(
    setter,
    /v_capability\.lesson_run_id is null then[\s\S]*?'revoked'[\s\S]*?'run_capability_not_granted'/,
  );
  assert.doesNotMatch(setter, /course_has_effective_learner/);

  const postflight = migration.slice(migration.indexOf("do $postflight$"));
  assert.match(
    postflight,
    /'for share of account'[\s\S]*?set_lesson_run_live_access\(uuid,uuid,boolean,boolean\)/,
  );
  assert.doesNotMatch(
    postflight,
    /'for update of account'[\s\S]*?set_lesson_run_live_access\(uuid,uuid,boolean,boolean\)/,
  );
});

test("Run start materializes only enrollment intersect frozen roster", () => {
  const start = functionBody("start_lesson_run");
  assert.match(
    start,
    /create or replace function public\.start_lesson_run\([\s\S]*?p_lesson_run_id uuid,[\s\S]*?p_started_at timestamptz default now\(\)/,
  );
  assert.match(start, /v_was_actual := v_run\.started_at_is_actual/);
  assert.match(start, /if not v_was_actual then/);
  assert.match(start, /insert into public\.lesson_run_presentation_state/);
  assert.match(start, /insert into public\.lesson_run_execution_capability/);
  assert.match(
    start,
    /from public\.learning_record as record[\s\S]*?join public\.course_learner_enrollment as enrollment/,
  );
  assert.match(start, /record\.occurred_at is null/);
  assert.match(start, /record\.superseded_by_record_id is null/);
  assert.match(start, /enrollment\.status = 'active'/);
  assert.match(start, /learner_account\.status = 'active'/);
  assert.match(
    start,
    /lock_learning_activity_learners\(v_learner_profile_ids\)/,
  );
  assert.match(start, /owner_account\.status = 'active'/);
  assert.match(
    start,
    /array_agg\(profile\.account_id order by record\.learner_profile_id\)/,
  );
  assert.match(start, /order by account\.id[\s\S]*?for share of account/);
  assert.match(
    start,
    /unnest\(v_learner_profile_ids, v_learner_account_ids\)[\s\S]*?profile\.account_id is not distinct from expected\.account_id[\s\S]*?for update of profile/,
  );
  assert.match(
    start,
    /on conflict \(lesson_run_id, learner_profile_id\) do update[\s\S]*?status = 'active'[\s\S]*?revision = capability\.revision \+ 1[\s\S]*?revocation_reason = null/,
  );
  assert.doesNotMatch(start, /course_has_effective_learner|learning_audience/);
});

test("teacher RPCs are owner-only definers and learner source is service-only", () => {
  for (const name of [
    "get_lesson_run_live_delivery_admin",
    "set_lesson_run_live_access",
    "set_lesson_run_presentation_cursor",
  ]) {
    const body = functionBody(name);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /auth\.uid\(\)/);
    assert.match(body, /course\.owner_account_id|owner_account\.id/);
  }

  assert.match(
    migration,
    /grant execute on function[\s\S]*?get_lesson_run_live_delivery_admin\(uuid\),[\s\S]*?set_lesson_run_live_access\(uuid,uuid,boolean,boolean\),[\s\S]*?set_lesson_run_presentation_cursor\(uuid,uuid,bigint\)[\s\S]*?to authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function[\s\S]*?resolve_lesson_run_live_source_admin\(uuid,uuid,uuid\)[\s\S]*?to service_role/,
  );
  assert.match(
    migration,
    /has_function_privilege\([\s\S]*?'authenticated',[\s\S]*?'public\.resolve_lesson_run_live_source_admin\(uuid,uuid,uuid\)'[\s\S]*?'EXECUTE'[\s\S]*?\)/,
  );
});

test("teacher delivery DTO is strict and cursor compare-and-swap is versioned", () => {
  const workspace = functionBody("get_lesson_run_live_delivery_admin");
  for (const key of [
    "'run'",
    "'started'",
    "'ended'",
    "'cursor'",
    "'slideId'",
    "'revision'",
    "'slides'",
    "'componentCount'",
    "'learners'",
    "'identityState'",
    "'courseAccessEnabled'",
    "'runCapabilityEnabled'",
  ]) {
    assert.match(workspace, new RegExp(key));
  }
  assert.doesNotMatch(
    workspace,
    /courseAccessRevision|runCapabilityRevision|accountId|authUserId/,
  );
  assert.match(workspace, /record\.superseded_by_record_id is null/);
  assert.match(
    workspace,
    /union[\s\S]*?from public\.lesson_run_execution_capability as capability_member[\s\S]*?capability_member\.lesson_run_id = run\.id/,
  );
  assert.match(
    workspace,
    /'courseAccessEnabled',[\s\S]*?coalesce\([\s\S]*?false[\s\S]*?'runCapabilityEnabled',[\s\S]*?coalesce\([\s\S]*?false/,
  );

  const cursor = functionBody("set_lesson_run_presentation_cursor");
  assert.match(cursor, /state\.cursor_version <> p_expected_revision/);
  assert.match(cursor, /lesson_run_cursor_stale/);
  assert.match(cursor, /using errcode = '40001'/);
  assert.match(cursor, /cursor_version = state\.cursor_version \+ 1/);
  assert.match(cursor, /component\.visibility = 'learner_visible'/);
  assert.ok(
    cursor.indexOf("for update of slide") <
      cursor.indexOf("for update of state"),
    "cursor must lock Slide before presentation state",
  );
  for (const relation of ["account", "course", "lesson"]) {
    assert.match(
      cursor,
      new RegExp(
        `for share of ${relation};[\\s\\S]*?if not found then[\\s\\S]*?lesson_run_live_not_found`,
      ),
    );
  }
  assert.match(
    cursor,
    /for update of run;[\s\S]*?if not found then[\s\S]*?lesson_run_live_not_found/,
  );
  const postflight = migration.slice(migration.indexOf("do $postflight$"));
  for (const relation of ["account", "course", "lesson"]) {
    assert.match(
      postflight,
      new RegExp(
        `'for share of ${relation}'[\\s\\S]*?set_lesson_run_presentation_cursor\\(uuid,uuid,bigint\\)`,
      ),
    );
  }

  const deletion = functionBody("clear_deleted_lesson_run_presentation_cursor");
  assert.match(deletion, /student_slide_id = null/);
  assert.match(deletion, /cursor_version = state\.cursor_version \+ 1/);
  assert.match(
    migration,
    /before delete on public\.lesson_student_slide[\s\S]*?clear_deleted_lesson_run_presentation_cursor/,
  );
});

test("empty authored Slides compose with the canonical Component cleanup trigger", () => {
  assert.match(
    currentSchema,
    /CREATE FUNCTION public\.cleanup_empty_lesson_student_slide\(\)[\s\S]*?delete from public\.lesson_student_slide as slide[\s\S]*?component\.visibility = 'learner_visible'/i,
  );
  assert.match(
    currentSchema,
    /CREATE TRIGGER trg_lesson_component_cleanup_empty_student_slide AFTER DELETE OR UPDATE OF lesson_id, visibility, student_slide_id ON public\.lesson_component FOR EACH ROW EXECUTE FUNCTION public\.cleanup_empty_lesson_student_slide\(\);/,
  );
  assert.match(
    migration,
    /trg_lesson_component_cleanup_empty_student_slide[\s\S]*?database_trigger\.tgtype = 25::smallint[\s\S]*?'lesson_id',[\s\S]*?'student_slide_id',[\s\S]*?'visibility'/,
  );
  assert.match(
    migration,
    /lesson_run_live_delivery_postflight_empty_slide_dependency/,
  );
});

test("service-only resolver validates session and returns one minimal source shape", () => {
  const resolver = functionBody("resolve_lesson_run_live_source_admin");
  assert.match(resolver, /from auth\.sessions as session/);
  assert.match(resolver, /session\.id = p_session_id/);
  assert.match(resolver, /session\.user_id = p_auth_user_id/);
  assert.match(resolver, /session\.not_after/);
  assert.match(resolver, /v_session_not_after <= clock_timestamp\(\)/);
  assert.match(resolver, /live_delivery_session_revoked/);
  assert.match(resolver, /security\.sessions_invalid_before/);
  assert.match(resolver, /profile\.account_id = account\.id/);
  assert.match(resolver, /lock_learning_activity_learners/);
  assert.match(resolver, /owner_account\.status = 'active'/);
  assert.equal(
    resolver.match(/for share of session/g)?.length,
    2,
    "both exact Supabase session checks must retain a SHARE lock",
  );
  assert.match(resolver, /for share of account, profile/);
  assert.match(resolver, /for share of security/);
  assert.match(
    resolver,
    /for share of security;[\s\S]*?if not found then[\s\S]*?live_delivery_session_revoked/,
  );
  assert.match(
    resolver,
    /for share of[\s\S]*?owner_account,[\s\S]*?course,[\s\S]*?run,[\s\S]*?enrollment,[\s\S]*?capability/,
  );
  assert.doesNotMatch(resolver, /for key share/);
  assert.match(resolver, /enrollment\.status = 'active'/);
  assert.match(resolver, /capability\.status = 'active'/);
  assert.match(
    resolver,
    /capability\.enrollment_revision = enrollment\.revision/,
  );

  for (const state of ["waiting", "live", "ended"]) {
    assert.match(resolver, new RegExp(`'state', '${state}'`));
  }
  for (const key of [
    "'typeKey'",
    "'schemaVersion'",
    "'position'",
    "'payload'",
    "'placement'",
    "'assets'",
    "'storageBucket'",
    "'storagePath'",
  ]) {
    assert.match(resolver, new RegExp(key));
  }
  assert.doesNotMatch(
    resolver,
    /teacher_report|teacher_comment|primary_learning_objective_id|activity_role/,
  );
});

test("owner transfer is blocked and archive revokes without authority transfer", () => {
  const ownerGuard = functionBody("guard_course_owner_change_with_live_access");
  assert.match(
    ownerGuard,
    /old\.owner_account_id is distinct from new\.owner_account_id/,
  );
  assert.match(ownerGuard, /enrollment\.status = 'active'/);
  assert.match(ownerGuard, /course_live_access_owner_change_blocked/);
  assert.match(
    migration,
    /before update of owner_account_id[\s\S]*?guard_course_owner_change_with_live_access/,
  );

  const archive = functionBody("revoke_live_access_after_course_archive");
  assert.match(
    archive,
    /old\.archived_at is null and new\.archived_at is not null/,
  );
  assert.match(archive, /'course_archived'/);
  assert.match(archive, /new\.owner_account_id/);
});

test("unlink or relink revokes profile authority instead of transferring it", () => {
  const accountChange = functionBody(
    "revoke_live_access_after_learner_account_change",
  );
  assert.match(
    accountChange,
    /old\.account_id is distinct from new\.account_id/,
  );
  assert.match(accountChange, /enrollment\.status = 'active'/);
  assert.match(accountChange, /'learner_account_changed'/);
  assert.match(
    accountChange,
    /revoke_course_learner_live_access\([\s\S]*?new\.id/,
  );
  assert.match(
    migration,
    /after update of account_id[\s\S]*?when \(old\.account_id is distinct from new\.account_id\)[\s\S]*?revoke_live_access_after_learner_account_change/,
  );
});

test("Account deactivation revokes learner and owner authority without silent revival", () => {
  const accountStatus = functionBody(
    "revoke_live_access_after_account_deactivation",
  );
  assert.match(accountStatus, /old\.status = 'active'/);
  assert.match(accountStatus, /new\.status <> 'active'/);
  assert.match(accountStatus, /course_owner_account_deactivated/);
  assert.match(accountStatus, /learner_account_deactivated/);
  assert.match(accountStatus, /revoke_course_learner_live_access/);
  assert.match(
    migration,
    /after update of status[\s\S]*?when \(old\.status = 'active' and new\.status <> 'active'\)[\s\S]*?revoke_live_access_after_account_deactivation/,
  );
  const closeAclStart = migration.indexOf("do $close_function_acl$");
  const closeAclEnd = migration.indexOf("$close_function_acl$;", closeAclStart);
  assert.notEqual(closeAclStart, -1);
  assert.notEqual(closeAclEnd, -1);
  const closeAcl = migration.slice(closeAclStart, closeAclEnd);
  assert.match(
    closeAcl,
    /'public\.revoke_live_access_after_account_deactivation\(\)'/,
  );
  assert.match(
    closeAcl,
    /revoke all on function %s from public, anon, authenticated, service_role/,
  );
});

test("teacher projection contains only non-empty learner Slides", () => {
  const workspace = functionBody("get_lesson_run_live_delivery_admin");
  assert.match(
    workspace,
    /from public\.lesson_student_slide as slide[\s\S]*?exists \([\s\S]*?component\.visibility = 'learner_visible'/,
  );
  assert.match(
    workspace,
    /'courseAccessEnabled',[\s\S]*?learner_account\.status = 'active'[\s\S]*?'runCapabilityEnabled',[\s\S]*?learner_account\.status = 'active'/,
  );
});
