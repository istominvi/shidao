#!/usr/bin/env bash
set -euo pipefail

# True multi-session learner-identity acceptance harness.
#
# Run only against a disposable, fully upgraded clone. Unlike the transactional
# acceptance harness, this script commits fixtures because independent sessions
# must observe and contend on the same rows. Drop the clone after the run.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (disposable upgraded test database)." >&2
  exit 2
fi

db_name="$(psql "$DATABASE_URL" -X -Atqc 'select current_database()')"
if [[ ! "$db_name" =~ (test|tmp|ci|clone|concurr) ]] \
  && [[ "${ALLOW_IDENTITY_DB_TESTS:-}" != "yes" ]]; then
  echo "Refusing concurrency harness for database '$db_name'." >&2
  exit 2
fi

if [[ "$(psql "$DATABASE_URL" -X -Atqc \
  "select
     to_regprocedure('public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)') is not null
     and to_regclass('public.learning_evidence') is not null
     and to_regprocedure('public.build_course_learning_activity_context(uuid,uuid)') is not null
     and position(
       'for update of operation'
       in lower(pg_get_functiondef(to_regprocedure(
         'public.learner_profile_merge_preview_for_actor(uuid,uuid)'
       )))
     ) > 0
     and position(
       'operation.status in (''pending'', ''ready'')'
       in lower(pg_get_functiondef(to_regprocedure(
         'public.learner_profile_merge_preview_for_actor(uuid,uuid)'
       )))
     ) > 0")" != "t" ]]; then
  echo "Learner identity/LA-M3 migrations are not fully applied." >&2
  exit 2
fi

task_tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/shidao-identity-concurrency.XXXXXX")"
cleanup() {
  rm -f "$task_tmp_dir"/*
  rmdir "$task_tmp_dir"
}
trap cleanup EXIT

psql_base=(psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1)

show_failure() {
  local label="$1"
  echo "--- $label session A ---" >&2
  sed -n '1,160p' "$task_tmp_dir/a.out" >&2
  echo "--- $label session B ---" >&2
  sed -n '1,160p' "$task_tmp_dir/b.out" >&2
}

run_pair_one_winner() {
  local label="$1"
  local sql_a="$2"
  local sql_b="$3"
  local pid_a pid_b rc_a rc_b winner_count

  "${psql_base[@]}" -c "$sql_a" >"$task_tmp_dir/a.out" 2>&1 &
  pid_a=$!
  "${psql_base[@]}" -c "$sql_b" >"$task_tmp_dir/b.out" 2>&1 &
  pid_b=$!

  set +e
  wait "$pid_a"; rc_a=$?
  wait "$pid_b"; rc_b=$?
  set -e

  winner_count=0
  if (( rc_a == 0 )); then winner_count=$((winner_count + 1)); fi
  if (( rc_b == 0 )); then winner_count=$((winner_count + 1)); fi
  if (( winner_count != 1 )); then
    show_failure "$label"
    echo "$label expected exactly one committed winner; rc=($rc_a,$rc_b)." >&2
    exit 1
  fi
  echo "$label: exactly one committed winner"
}

run_pair_both_same() {
  local label="$1"
  local sql_a="$2"
  local sql_b="$3"
  local pid_a pid_b rc_a rc_b

  "${psql_base[@]}" -c "$sql_a" >"$task_tmp_dir/a.out" 2>&1 &
  pid_a=$!
  "${psql_base[@]}" -c "$sql_b" >"$task_tmp_dir/b.out" 2>&1 &
  pid_b=$!

  set +e
  wait "$pid_a"; rc_a=$?
  wait "$pid_b"; rc_b=$?
  set -e

  if (( rc_a != 0 || rc_b != 0 )) \
    || ! cmp -s "$task_tmp_dir/a.out" "$task_tmp_dir/b.out"; then
    show_failure "$label"
    echo "$label expected two identical successful terminal results; rc=($rc_a,$rc_b)." >&2
    exit 1
  fi
  echo "$label: two identical terminal results"
}

assert_sql_true() {
  local label="$1"
  local sql="$2"
  local result
  result="$("${psql_base[@]}" -c "$sql")"
  if [[ "$result" != "t" ]]; then
    echo "$label failed (result: $result)." >&2
    exit 1
  fi
  echo "$label: passed"
}

# Concurrent duplicate Auth signup: the Auth primary key has one winner and
# the committed bootstrap owns exactly one canonical profile.
run_pair_one_winner \
  "concurrent signup/bootstrap" \
  "insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) values ('d1000000-0000-0000-0000-000000000001','parallel@test.invalid',now(),'{\"full_name\":\"Parallel Signup\"}','{}');" \
  "insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) values ('d1000000-0000-0000-0000-000000000001','parallel@test.invalid',now(),'{\"full_name\":\"Parallel Signup\"}','{}');"
assert_sql_true "signup exactly-one invariant" "
  select count(*) = 1
    and (select count(*)
         from public.learner_profile as profile
         join public.account as linked on linked.id = profile.account_id
         where linked.auth_user_id =
           'd1000000-0000-0000-0000-000000000001') = 1
  from public.account as account
  where account.auth_user_id = 'd1000000-0000-0000-0000-000000000001';
"

"${psql_base[@]}" <<'SQL'
insert into auth.users (
  id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data
) values
  ('d1000000-0000-0000-0000-000000000010','race-teacher@test.invalid',now(),'{"full_name":"Race Teacher"}','{}'),
  ('d1000000-0000-0000-0000-000000000011','race-adult-a@test.invalid',now(),'{"full_name":"Race Adult A"}','{}'),
  ('d1000000-0000-0000-0000-000000000012','race-adult-b@test.invalid',now(),'{"full_name":"Race Adult B"}','{}'),
  ('d1000000-0000-0000-0000-000000000013','race-child-a@learners.shidao.internal',now(),'{"full_name":"Race Child A"}','{"identity_status":"provisional"}'),
  ('d1000000-0000-0000-0000-000000000014','race-child-b@learners.shidao.internal',now(),'{"full_name":"Race Child B"}','{"identity_status":"provisional"}'),
  ('d1000000-0000-0000-0000-000000000020','link-a@test.invalid',now(),'{"full_name":"Link A"}','{}'),
  ('d1000000-0000-0000-0000-000000000021','link-b@test.invalid',now(),'{"full_name":"Link B"}','{}'),
  ('d1000000-0000-0000-0000-000000000022','link-c@test.invalid',now(),'{"full_name":"Link C"}','{}'),
  ('d1000000-0000-0000-0000-000000000030','merge-subject@test.invalid',now(),'{"full_name":"Merge Subject"}','{}'),
  ('d1000000-0000-0000-0000-000000000031','merge-teacher@test.invalid',now(),'{"full_name":"Merge Teacher"}','{}');
select set_config('app.learner_profile_link_mutation','off',false);
SQL

# Two Accounts race for one offline profile. The first commit is valid; the
# second would orphan the winner and is rejected by the deferred invariant.
"${psql_base[@]}" -c "insert into public.learner_profile (id,display_name) values ('d2000000-0000-0000-0000-000000000001','Shared Offline');"
run_pair_one_winner \
  "two Accounts -> one profile" \
  "begin; select set_config('app.learner_profile_link_mutation','on',true); update public.learner_profile set account_id=null where account_id=public.account_id_for_auth_user('d1000000-0000-0000-0000-000000000020'); select pg_sleep(0.4); update public.learner_profile set account_id=public.account_id_for_auth_user('d1000000-0000-0000-0000-000000000020') where id='d2000000-0000-0000-0000-000000000001'; commit;" \
  "begin; select set_config('app.learner_profile_link_mutation','on',true); update public.learner_profile set account_id=null where account_id=public.account_id_for_auth_user('d1000000-0000-0000-0000-000000000021'); select pg_sleep(0.4); update public.learner_profile set account_id=public.account_id_for_auth_user('d1000000-0000-0000-0000-000000000021') where id='d2000000-0000-0000-0000-000000000001'; commit;"
assert_sql_true "two-Account race preserved every Account" "
  select count(*) filter (where profile_count <> 1) = 0
  from (
    select account.id,count(profile.id) profile_count
    from public.account as account
    left join public.learner_profile as profile on profile.account_id=account.id
    where account.auth_user_id in (
      'd1000000-0000-0000-0000-000000000020',
      'd1000000-0000-0000-0000-000000000021'
    ) group by account.id
  ) checked;
"

# One Account races to two targets. Both sessions read the same original
# canonical profile before the sleep; only one target can win the unique and
# exactly-one constraints.
"${psql_base[@]}" -c "insert into public.learner_profile (id,display_name) values ('d2000000-0000-0000-0000-000000000002','Candidate One'),('d2000000-0000-0000-0000-000000000003','Candidate Two');"
profile_c="$("${psql_base[@]}" -c "select profile.id from public.learner_profile as profile join public.account as account on account.id=profile.account_id where account.auth_user_id='d1000000-0000-0000-0000-000000000022';")"
run_pair_one_winner \
  "one Account -> two profiles" \
  "begin; select set_config('app.learner_profile_link_mutation','on',true); select id from public.learner_profile where id='$profile_c'; select pg_sleep(0.4); update public.learner_profile set account_id=null where id='$profile_c'; update public.learner_profile set account_id=public.account_id_for_auth_user('d1000000-0000-0000-0000-000000000022') where id='d2000000-0000-0000-0000-000000000002'; commit;" \
  "begin; select set_config('app.learner_profile_link_mutation','on',true); select id from public.learner_profile where id='$profile_c'; select pg_sleep(0.4); update public.learner_profile set account_id=null where id='$profile_c'; update public.learner_profile set account_id=public.account_id_for_auth_user('d1000000-0000-0000-0000-000000000022') where id='d2000000-0000-0000-0000-000000000003'; commit;"
assert_sql_true "one-Account race preserved exactly one profile" "
  select count(*) = 1
  from public.learner_profile
  where account_id=public.account_id_for_auth_user('d1000000-0000-0000-0000-000000000022');
"

# Two verified recipients race the same child activation. Row locking and the
# one-way recipient binding allow one Account/provisional target only.
"${psql_base[@]}" <<'SQL'
insert into public.learner_profile (id,display_name)
values ('d2000000-0000-0000-0000-000000000010','Concurrent Offline Child');
insert into public.teacher_learner (teacher_account_id,learner_profile_id,display_name)
select account.id,'d2000000-0000-0000-0000-000000000010','Concurrent Offline Child'
from public.account as account
where account.auth_user_id='d1000000-0000-0000-0000-000000000010';
select public.create_learner_profile_invitation(
  'd1000000-0000-0000-0000-000000000010',
  'd2000000-0000-0000-0000-000000000010','child_activation',
  decode(repeat('a1',32),'hex'),decode(repeat('a2',32),'hex'),
  now()+interval '1 day'
);
SQL
child_invitation_id="$("${psql_base[@]}" -c "select id from public.learner_claim_invitation where token_digest=decode(repeat('a2',32),'hex');")"
run_pair_one_winner \
  "concurrent recipient-bound child activation" \
  "select public.activate_verified_offline_learner_account('d1000000-0000-0000-0000-000000000011','$child_invitation_id',decode(repeat('a1',32),'hex'),'race.child.a','1234','d1000000-0000-0000-0000-000000000013',true,false);" \
  "select public.activate_verified_offline_learner_account('d1000000-0000-0000-0000-000000000012','$child_invitation_id',decode(repeat('a1',32),'hex'),'race.child.b','5678','d1000000-0000-0000-0000-000000000014',true,false);"
assert_sql_true "child activation has one identity/recovery winner" "
  select invitation.status='accepted'
    and operation.status='completed'
    and (select count(*) from public.learner_credential_recovery_delegate as delegate
         where delegate.subject_account_id=operation.subject_account_id
           and delegate.status='active')=1
    and (select count(*) from public.account as account
         where account.id=operation.subject_account_id
           and account.status='active')=1
  from public.learner_claim_invitation as invitation
  join public.learner_profile_merge as operation on operation.invitation_id=invitation.id
  where invitation.id='$child_invitation_id';
"

# The same reset idempotency key races with different requested credentials.
# Both callers observe one frozen result and only the winning credential write.
reset_sql_a="select public.reset_recoverable_learner_credentials((select actor.auth_user_id from public.learner_credential_recovery_delegate delegate join public.account actor on actor.id=delegate.delegate_account_id where delegate.activation_invitation_id='$child_invitation_id'),(select id from public.learner_credential_recovery_delegate where activation_invitation_id='$child_invitation_id'),'reset.race.a','2468',clock_timestamp(),'d6000000-0000-0000-0000-000000000001');"
reset_sql_b="select public.reset_recoverable_learner_credentials((select actor.auth_user_id from public.learner_credential_recovery_delegate delegate join public.account actor on actor.id=delegate.delegate_account_id where delegate.activation_invitation_id='$child_invitation_id'),(select id from public.learner_credential_recovery_delegate where activation_invitation_id='$child_invitation_id'),'reset.race.b','8642',clock_timestamp(),'d6000000-0000-0000-0000-000000000001');"
run_pair_both_same "concurrent credential reset idempotency" "$reset_sql_a" "$reset_sql_b"
assert_sql_true "concurrent reset left one alias and cutoff" "
  select count(*)=1
    and bool_and(alias.normalized_login in ('reset.race.a','reset.race.b'))
    and bool_and(security.sessions_invalid_before is not null)
  from public.learner_credential_recovery_delegate as delegate
  join public.account_login_alias as alias on alias.account_id=delegate.subject_account_id and alias.revoked_at is null
  join public.account_security as security on security.account_id=delegate.subject_account_id
  where delegate.activation_invitation_id='$child_invitation_id';
"

# Concurrent merge with overlapping direct/group audience and duplicate
# finalized records for one LessonRun. Both confirmations return the same
# terminal result; memberships and the conflict are retained exactly once.
"${psql_base[@]}" <<'SQL'
insert into public.course (id,owner_account_id,title,subject)
select 'd3000000-0000-0000-0000-000000000001',account.id,'Concurrent Merge Course','Math'
from public.account as account where account.auth_user_id='d1000000-0000-0000-0000-000000000031';
insert into public.lesson (id,course_id,position,title)
values ('d3100000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001',1,'Concurrent Merge Lesson');
insert into public.lesson_run (id,lesson_id,scheduled_at,planned_duration_minutes,started_at,started_at_is_actual,ended_at,actual_duration_minutes)
values ('d3200000-0000-0000-0000-000000000001','d3100000-0000-0000-0000-000000000001',now()-interval '1 hour',60,now()-interval '50 minutes',true,now()-interval '10 minutes',40);
insert into public.learner_profile (id,display_name)
values ('d2000000-0000-0000-0000-000000000020','Concurrent Merge Source');
insert into public.teacher_learner (teacher_account_id,learner_profile_id,display_name)
select teacher.id,profiles.profile_id,profiles.display_name
from public.account as teacher
cross join (values
 ('d2000000-0000-0000-0000-000000000020'::uuid,'Merge Source'),
 ((select profile.id from public.learner_profile as profile join public.account as subject on subject.id=profile.account_id where subject.auth_user_id='d1000000-0000-0000-0000-000000000030'),'Merge Target')
) as profiles(profile_id,display_name)
where teacher.auth_user_id='d1000000-0000-0000-0000-000000000031';
insert into public.learner_group (id,owner_account_id,name)
select 'd7000000-0000-0000-0000-000000000001',account.id,'Concurrent Merge Group'
from public.account as account where account.auth_user_id='d1000000-0000-0000-0000-000000000031';
insert into public.course_learner_group (course_id,learner_group_id)
values ('d3000000-0000-0000-0000-000000000001','d7000000-0000-0000-0000-000000000001');
insert into public.course_learner (course_id,learner_profile_id)
select 'd3000000-0000-0000-0000-000000000001',profile_id
from (values
 ('d2000000-0000-0000-0000-000000000020'::uuid),
 ((select profile.id from public.learner_profile as profile join public.account as subject on subject.id=profile.account_id where subject.auth_user_id='d1000000-0000-0000-0000-000000000030'))
) profiles(profile_id);
insert into public.learner_group_member (learner_group_id,learner_profile_id)
select 'd7000000-0000-0000-0000-000000000001',profile_id
from (values
 ('d2000000-0000-0000-0000-000000000020'::uuid),
 ((select profile.id from public.learner_profile as profile join public.account as subject on subject.id=profile.account_id where subject.auth_user_id='d1000000-0000-0000-0000-000000000030'))
) profiles(profile_id);
insert into public.learning_record (id,learner_profile_id,lesson_run_id,source_course_id,source_lesson_id,occurred_at,was_present,needs_repeat,teacher_comment,course_title_at_time,lesson_title_at_time,subject_at_time,recorded_by_account_id,actual_duration_minutes_at_time)
select record_id,profile_id,'d3200000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001','d3100000-0000-0000-0000-000000000001',now(),was_present,false,comment,'Concurrent Merge Course','Concurrent Merge Lesson','Math',teacher.id,40
from public.account as teacher
cross join (values
 ('d4000000-0000-0000-0000-000000000001'::uuid,'d2000000-0000-0000-0000-000000000020'::uuid,false,'source detail'),
 ('d4000000-0000-0000-0000-000000000002'::uuid,(select profile.id from public.learner_profile as profile join public.account as subject on subject.id=profile.account_id where subject.auth_user_id='d1000000-0000-0000-0000-000000000030'),true,'target detail')
) records(record_id,profile_id,was_present,comment)
where teacher.auth_user_id='d1000000-0000-0000-0000-000000000031';
insert into public.learner_profile_merge (id,source_learner_profile_id,target_learner_profile_id,requested_by_account_id,subject_account_id,expires_at)
select 'd5000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000020',profile.id,teacher.id,subject.id,now()+interval '1 day'
from public.account as teacher
cross join public.account as subject
join public.learner_profile as profile on profile.account_id=subject.id
where teacher.auth_user_id='d1000000-0000-0000-0000-000000000031'
  and subject.auth_user_id='d1000000-0000-0000-0000-000000000030';
SQL
merge_fingerprint="$("${psql_base[@]}" -c "with configured as materialized (select set_config('request.jwt.claim.sub','d1000000-0000-0000-0000-000000000030',false)) select public.preview_learner_profile_merge('d5000000-0000-0000-0000-000000000001')->>'previewFingerprint' from configured;")"
merge_sql="with configured as materialized (select set_config('request.jwt.claim.sub','d1000000-0000-0000-0000-000000000030',false)) select public.confirm_learner_profile_merge('d5000000-0000-0000-0000-000000000001','$merge_fingerprint') from configured;"
run_pair_both_same "concurrent merge terminal idempotency" "$merge_sql" "$merge_sql"
assert_sql_true "concurrent merge deduplicated audience and retained conflict" "
  select operation.status='completed'
    and not exists (select 1 from public.learner_profile where id='d2000000-0000-0000-0000-000000000020')
    and (select count(*) from public.course_learner where course_id='d3000000-0000-0000-0000-000000000001')=1
    and (select count(*) from public.learner_group_member where learner_group_id='d7000000-0000-0000-0000-000000000001')=1
    and (select count(*) from public.learner_profile_merge_conflict where merge_operation_id=operation.id)=1
    and (select count(*) from public.learning_record where superseded_by_record_id is not null and learner_profile_id=operation.target_learner_profile_id)=1
  from public.learner_profile_merge as operation
  where operation.id='d5000000-0000-0000-0000-000000000001';
"

# Open/draft rows remain an explicit merge blocker after the concurrency path.
"${psql_base[@]}" <<'SQL'
insert into public.lesson_run (id,lesson_id,scheduled_at,planned_duration_minutes)
values ('d3200000-0000-0000-0000-000000000002','d3100000-0000-0000-0000-000000000001',now(),60);
insert into public.learner_profile (id,display_name)
values ('d2000000-0000-0000-0000-000000000021','Draft Merge Source');
insert into public.learning_record (id,learner_profile_id,lesson_run_id,recorded_by_account_id)
select 'd4000000-0000-0000-0000-000000000003','d2000000-0000-0000-0000-000000000021','d3200000-0000-0000-0000-000000000002',account.id
from public.account as account where account.auth_user_id='d1000000-0000-0000-0000-000000000031';
insert into public.learner_profile_merge (id,source_learner_profile_id,target_learner_profile_id,requested_by_account_id,subject_account_id,expires_at)
select 'd5000000-0000-0000-0000-000000000002','d2000000-0000-0000-0000-000000000021',profile.id,teacher.id,subject.id,now()+interval '1 day'
from public.account as teacher
cross join public.account as subject
join public.learner_profile as profile on profile.account_id=subject.id
where teacher.auth_user_id='d1000000-0000-0000-0000-000000000031'
  and subject.auth_user_id='d1000000-0000-0000-0000-000000000030';
SQL
assert_sql_true "open/draft merge is blocked" "
  with configured as materialized (
    select set_config('request.jwt.claim.sub','d1000000-0000-0000-0000-000000000030',false)
  )
  select not (public.preview_learner_profile_merge(
    'd5000000-0000-0000-0000-000000000002'
  )->>'canConfirm')::boolean from configured;
"

# Preview reads the operation, then waits on Profile locks.  Cancellation wins
# the operation while preview is blocked.  Once released, preview must re-read
# the cancelled terminal state and may never write ready/pending over it.
"${psql_base[@]}" <<'SQL'
insert into public.learner_profile (id,display_name)
values ('d2000000-0000-0000-0000-000000000022','Cancel Race Source');
insert into public.learner_profile_merge (
  id,source_learner_profile_id,target_learner_profile_id,
  requested_by_account_id,subject_account_id,expires_at
)
select
  'd5000000-0000-0000-0000-000000000003',
  'd2000000-0000-0000-0000-000000000022',
  profile.id,
  subject.id,
  subject.id,
  now()+interval '1 day'
from public.account as subject
join public.learner_profile as profile on profile.account_id=subject.id
where subject.auth_user_id='d1000000-0000-0000-0000-000000000030';
SQL

merge_cancel_sql="
  begin;
  set local application_name = 'identity_merge_cancel_race';
  select set_config(
    'request.jwt.claim.sub',
    'd1000000-0000-0000-0000-000000000030',
    true
  );
  select profile.id
  from public.learner_profile as profile
  where profile.id in (
    'd2000000-0000-0000-0000-000000000022',
    (
      select owned.id
      from public.learner_profile as owned
      join public.account as subject on subject.id=owned.account_id
      where subject.auth_user_id=
        'd1000000-0000-0000-0000-000000000030'
    )
  )
  order by profile.id
  for update of profile;
  select pg_sleep(2);
  select public.cancel_learner_profile_merge(
    'd5000000-0000-0000-0000-000000000003'
  );
  commit;
"
"${psql_base[@]}" -c "$merge_cancel_sql" \
  >"$task_tmp_dir/b.out" 2>&1 &
merge_cancel_pid=$!

merge_cancel_ready=""
for _attempt in $(seq 1 50); do
  merge_cancel_ready="$("${psql_base[@]}" -c "
    select exists (
      select 1 from pg_stat_activity
      where application_name='identity_merge_cancel_race'
        and state='active'
        and wait_event='PgSleep'
    );
  ")"
  if [[ "$merge_cancel_ready" == "t" ]]; then
    break
  fi
  sleep 0.1
done
if [[ "$merge_cancel_ready" != "t" ]]; then
  kill "$merge_cancel_pid" 2>/dev/null || true
  wait "$merge_cancel_pid" 2>/dev/null || true
  show_failure "preview/cancel race setup"
  echo "preview/cancel race could not observe the Profile-lock holder." >&2
  exit 1
fi

set +e
"${psql_base[@]}" -c "
  begin;
  set local application_name = 'identity_merge_preview_race';
  select set_config(
    'request.jwt.claim.sub',
    'd1000000-0000-0000-0000-000000000030',
    true
  );
  select public.preview_learner_profile_merge(
    'd5000000-0000-0000-0000-000000000003'
  );
  commit;
" >"$task_tmp_dir/a.out" 2>&1
merge_preview_rc=$?
wait "$merge_cancel_pid"
merge_cancel_rc=$?
set -e

if (( merge_preview_rc == 0 || merge_cancel_rc != 0 )) \
  || ! grep -Fq \
    "learner_profile_merge_not_available" "$task_tmp_dir/a.out"; then
  show_failure "preview/cancel terminal race"
  echo "preview/cancel race did not reject the stale preview; rc=($merge_preview_rc,$merge_cancel_rc)." >&2
  exit 1
fi
assert_sql_true "cancelled merge cannot be resurrected by preview" "
  select status='cancelled' and cancelled_at is not null
  from public.learner_profile_merge
  where id='d5000000-0000-0000-0000-000000000003';
"

# Observer reads and erasure overlap after the preview. The observer session
# reaches pg_sleep only after both RPCs appended their audit rows and acquired
# profile/grant SHARE locks. Erasure must wait for that transaction, then
# remove the grant and scrub every committed audit reference to the old UUID.
"${psql_base[@]}" <<'SQL'
insert into auth.users (
  id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data
) values
  ('d1000000-0000-0000-0000-000000000040','erase-subject@test.invalid',now(),'{"full_name":"Erase Subject"}','{}'),
  ('d1000000-0000-0000-0000-000000000041','erase-observer@test.invalid',now(),'{"full_name":"Erase Observer"}','{}');
insert into auth.sessions (
  id, user_id, created_at, updated_at, not_after
) values (
  'd1100000-0000-4000-8000-000000000040',
  'd1000000-0000-0000-0000-000000000040',
  clock_timestamp(), clock_timestamp(), null
);
insert into public.learner_observer_grant (
  id, learner_profile_id, subject_account_id, observer_account_id,
  relationship_label
)
select
  'd8000000-0000-0000-0000-000000000040', profile.id,
  subject.id, observer.id, 'Concurrency observer'
from public.account as subject
join public.learner_profile as profile on profile.account_id = subject.id
cross join public.account as observer
where subject.auth_user_id = 'd1000000-0000-0000-0000-000000000040'
  and observer.auth_user_id = 'd1000000-0000-0000-0000-000000000041';
SQL
erasure_old_profile="$("${psql_base[@]}" -c "
  select profile.id
  from public.learner_profile as profile
  join public.account as account on account.id = profile.account_id
  where account.auth_user_id = 'd1000000-0000-0000-0000-000000000040';
")"
erasure_fingerprint="$("${psql_base[@]}" -c "
  with configured as materialized (
    select set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', 'd1000000-0000-0000-0000-000000000040',
        'session_id', 'd1100000-0000-4000-8000-000000000040',
        'role', 'authenticated'
      )::text,
      false
    )
  )
  select public.preview_my_learning_data_erasure()
    ->> 'previewFingerprint'
  from configured;
")"

observer_erasure_sql="
  begin;
  set local application_name = 'identity_observer_erasure_race';
  select set_config(
    'request.jwt.claim.sub',
    'd1000000-0000-0000-0000-000000000041', true
  );
  select public.get_observed_learner_history(
    '$erasure_old_profile', null, 25
  );
  select public.get_observed_learner_progress('$erasure_old_profile');
  select pg_sleep(2);
  commit;
"
"${psql_base[@]}" -c "$observer_erasure_sql" \
  >"$task_tmp_dir/a.out" 2>&1 &
observer_erasure_pid=$!

observer_erasure_ready=false
for _ in {1..100}; do
  if [[ "$("${psql_base[@]}" -c "
    select exists (
      select 1 from pg_stat_activity
      where application_name = 'identity_observer_erasure_race'
        and wait_event = 'PgSleep'
    );
  ")" == "t" ]]; then
    observer_erasure_ready=true
    break
  fi
  sleep 0.05
done
if [[ "$observer_erasure_ready" != "true" ]]; then
  set +e
  wait "$observer_erasure_pid"
  set -e
  show_failure "observer read/erasure lock rendezvous"
  echo "Observer session never reached the lock rendezvous." >&2
  exit 1
fi

"${psql_base[@]}" -c "
  begin;
  set local application_name = 'identity_erasure_confirm_race';
  select public.confirm_my_learning_data_erasure(
    'd1000000-0000-0000-0000-000000000040',
    'd1100000-0000-4000-8000-000000000040',
    '$erasure_fingerprint'
  );
  commit;
" >"$task_tmp_dir/b.out" 2>&1 &
erasure_confirm_pid=$!

erasure_confirm_blocked=false
for _ in {1..100}; do
  if [[ "$("${psql_base[@]}" -c "
    select exists (
      select 1 from pg_stat_activity
      where application_name = 'identity_erasure_confirm_race'
        and wait_event_type = 'Lock'
    );
  ")" == "t" ]]; then
    erasure_confirm_blocked=true
    break
  fi
  sleep 0.05
done
if [[ "$erasure_confirm_blocked" != "true" ]]; then
  set +e
  wait "$observer_erasure_pid"
  wait "$erasure_confirm_pid"
  set -e
  show_failure "observer read/erasure overlap"
  echo "Erasure never waited on the observer's profile lock." >&2
  exit 1
fi

set +e
wait "$observer_erasure_pid"; observer_erasure_rc=$?
wait "$erasure_confirm_pid"; erasure_confirm_rc=$?
set -e
if (( observer_erasure_rc != 0 || erasure_confirm_rc != 0 )); then
  show_failure "observer read/erasure overlap"
  echo "Observer/erasure overlap failed; rc=($observer_erasure_rc,$erasure_confirm_rc)." >&2
  exit 1
fi
echo "observer read/erasure overlap: erasure lock wait observed; both transactions committed"

assert_sql_true "erasure scrubbed concurrent observer audit UUID" "
  select public.resolve_learner_profile_alias('$erasure_old_profile') is null
    and not exists (
      select 1 from public.learner_profile
      where id = '$erasure_old_profile'
    )
    and not exists (
      select 1 from public.learner_profile_alias
      where source_learner_profile_id = '$erasure_old_profile'
         or target_learner_profile_id = '$erasure_old_profile'
    )
    and not exists (
      select 1 from public.learner_identity_audit_event
      where learner_profile_id = '$erasure_old_profile'
         or related_learner_profile_id = '$erasure_old_profile'
         or related_entity_id = '$erasure_old_profile'
         or metadata::text like '%' || '$erasure_old_profile' || '%'
    )
    and (
      select count(*) = 2
        and bool_and(audit.learner_profile_id is null)
        and bool_and(audit.related_learner_profile_id is null)
        and bool_and(audit.related_entity_id is null)
      from public.learner_identity_audit_event as audit
      where audit.actor_account_id = public.account_id_for_auth_user(
        'd1000000-0000-0000-0000-000000000041'
      )
        and audit.event_type in (
          'learner_observer_history_read',
          'learner_observer_progress_read'
        )
    );
"

assert_sql_true "global exactly-one concurrency postflight" "
  select count(*) filter (where profile_count<>1)=0
  from (
    select account.id,count(profile.id) profile_count
    from public.account as account
    left join public.learner_profile as profile on profile.account_id=account.id
    where account.status in ('active','provisional')
    group by account.id
  ) checked;
"

echo "Learner identity true-concurrency acceptance passed on $db_name"
