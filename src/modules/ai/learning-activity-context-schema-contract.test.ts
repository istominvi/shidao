import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260821100000_choice_quiz_activity.sql",
  "utf8",
);
const refreshScript = readFileSync(
  "scripts/refresh-schema-snapshot.sh",
  "utf8",
);

function functionBody(marker: string) {
  const start = migration.indexOf(marker);
  assert.notEqual(start, -1, `missing function marker: ${marker}`);
  const delimiter = migration.indexOf("as $function$", start);
  assert.notEqual(delimiter, -1, `missing function delimiter: ${marker}`);
  const end = migration.indexOf("\n$function$;", delimiter);
  assert.notEqual(end, -1, `unterminated function: ${marker}`);
  return migration.slice(start, end + 12);
}

test("AI activity context binds service-role reads to one retained user session", () => {
  const body = functionBody(
    `create function public.build_course_learning_activity_context(
  p_actor_auth_user_id uuid,
  p_actor_session_id uuid,
  p_course_id uuid
)`,
  );
  const learnerLock = body.indexOf(
    "perform public.lock_learning_activity_learners",
  );
  const sessionLock = body.indexOf("from auth.sessions as session");
  const accountLock = body.indexOf("from public.account as account");
  const courseLock = body.indexOf("from public.course as course");
  const profileLock = body.indexOf("from public.learner_profile as profile");
  const stateRefresh = body.indexOf(
    "public.refresh_learning_activity_states_for_profile",
  );

  assert.equal(
    learnerLock >= 0 &&
      learnerLock < sessionLock &&
      sessionLock < accountLock &&
      accountLock < courseLock &&
      courseLock < profileLock &&
      profileLock < stateRefresh,
    true,
    "context must retain learner -> Session -> Account/security -> Course/Profile/state order",
  );
  assert.match(body, /session\.id = p_actor_session_id/);
  assert.match(body, /session\.user_id = p_actor_auth_user_id/);
  assert.match(body, /session\.not_after/);
  assert.match(body, /for share of session/);
  assert.match(body, /account\.status in \('active', 'provisional'\)/);
  assert.match(body, /security\.sessions_invalid_before/);
  assert.match(body, /for share of account, security/);
  assert.match(body, /course\.owner_account_id = v_actor_account_id/);
  assert.doesNotMatch(body, /auth\.uid\(\)|auth\.jwt\(\)/);
});

test("rolling two-argument AI context boundary stays present but fails closed", () => {
  const body = functionBody(
    `create or replace function public.build_course_learning_activity_context(
  p_actor_auth_user_id uuid,
  p_course_id uuid
)`,
  );
  assert.match(
    body,
    /raise exception 'learning_activity_context_session_required'/,
  );
  assert.match(body, /errcode = '42501'/);
  assert.doesNotMatch(body, /course_learning_activity_projection/);

  assert.match(
    migration,
    /revoke all on function public\.build_course_learning_activity_context\(\s*uuid, uuid, uuid\s*\) from public, anon, authenticated, service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.build_course_learning_activity_context\(\s*uuid, uuid, uuid\s*\) to postgres, service_role;/,
  );
  assert.match(
    migration,
    /revoke all on function public\.build_course_learning_activity_context\(\s*uuid, uuid\s*\) from public, anon, authenticated, service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.build_course_learning_activity_context\(\s*uuid, uuid\s*\) to postgres, service_role;/,
  );
});

test("schema refresh gate requires both secure and rolling AI context overloads", () => {
  for (const marker of [
    "public.build_course_learning_activity_context(uuid,uuid,uuid)",
    "public.build_course_learning_activity_context(uuid,uuid)",
    "learning_activity_context_session_required",
  ]) {
    assert.equal(refreshScript.includes(marker), true, marker);
  }
});
