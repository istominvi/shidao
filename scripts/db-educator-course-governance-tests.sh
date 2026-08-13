#!/usr/bin/env bash
set -euo pipefail

# Transactional acceptance harness for educator-course governance/progress.
# Point it only at an isolated, fully upgraded clone. All fixtures roll back.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (isolated upgraded test database)." >&2
  exit 2
fi

db_name="$(psql "$DATABASE_URL" -X -Atqc 'select current_database()')"
if [[ ! "$db_name" =~ (test|tmp|ci|clone) ]] \
  && [[ "${ALLOW_EDUCATOR_COURSE_DB_TESTS:-}" != "yes" ]]; then
  echo "Refusing mutation harness for database '$db_name'. Use a test/clone DB." >&2
  exit 2
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
set constraints all deferred;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_value, false) then
    raise exception 'educator_governance_acceptance_failed: %', p_message;
  end if;
end
$$;

create function pg_temp.build_course_snapshot(p_course_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'course', jsonb_build_object(
      'title', course.title,
      'subject', course.subject,
      'goal', course.goal,
      'level', course.level,
      'audienceDescription', course.audience_description,
      'targetLessonCount', course.target_lesson_count
    ),
    'lessons', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ref', lesson.id,
          'position', lesson.position,
          'title', lesson.title,
          'summary', lesson.summary,
          'estimatedDurationMinutes', lesson.estimated_duration_minutes,
          'components', '[]'::jsonb,
          'slides', '[]'::jsonb
        ) order by lesson.position
      )
      from public.lesson as lesson
      where lesson.course_id = course.id
    ), '[]'::jsonb),
    'materials', '[]'::jsonb
  )
  from public.course as course
  where course.id = p_course_id;
$$;

select pg_temp.assert_true(
  to_regprocedure(
    'public.set_my_course_publication_lesson_progress(uuid,uuid,uuid,boolean)'
  ) is not null,
  'E2 governance migration is not applied'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_proc as procedure
    where procedure.oid = to_regprocedure(
        'public.guard_educator_course_content_mutation()'
      )
      and not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']
      and position(
        'educator_course_author_can_mutate'
        in pg_get_functiondef(procedure.oid)
      ) = 0
      and position(
        'account.can_author_educator_courses'
        in pg_get_functiondef(procedure.oid)
      ) > 0
      and position(
        'course.learning_audience = ''children'''
        in pg_get_functiondef(procedure.oid)
      ) > 0
      and position(
        'account.status = ''active'''
        in pg_get_functiondef(procedure.oid)
      ) > 0
  ),
  'educator content guard SECURITY INVOKER fix is not applied'
);

select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.educator_course_author_can_mutate(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.educator_course_author_can_mutate(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.guard_educator_course_content_mutation()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.guard_educator_course_content_mutation()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.guard_educator_course_content_mutation()',
    'EXECUTE'
  ),
  'educator content guard fix opened a browser or service RPC ACL'
);

set local session_replication_role = replica;
insert into auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data
)
values (
  'e2000000-0000-4000-8000-000000000001',
  'educator-governance@test.invalid',
  clock_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data
)
values (
  'e2000000-0000-4000-8000-000000000002',
  'other-educator-governance@test.invalid',
  clock_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.account (
  id,
  auth_user_id,
  display_name,
  status,
  can_author_educator_courses
)
values (
  'e2000000-0000-4000-8000-000000000011',
  'e2000000-0000-4000-8000-000000000001',
  'Educator Governance Test',
  'active',
  true
);

insert into public.account (
  id,
  auth_user_id,
  display_name,
  status,
  can_author_educator_courses
)
values (
  'e2000000-0000-4000-8000-000000000012',
  'e2000000-0000-4000-8000-000000000002',
  'Other Educator Governance Test',
  'active',
  true
);
set local session_replication_role = origin;

insert into public.course (
  id,
  owner_account_id,
  title,
  subject,
  goal,
  level,
  audience_description,
  target_lesson_count,
  learning_audience
)
values (
  'e2000000-0000-4000-8000-000000000021',
  'e2000000-0000-4000-8000-000000000011',
  'Одобренный курс',
  'Китайский язык',
  'Approved goal',
  'Педагоги',
  'Преподаватели китайского',
  2,
  'educators'
);

insert into public.lesson (
  id,
  course_id,
  position,
  title,
  summary,
  estimated_duration_minutes
)
values (
  'e2000000-0000-4000-8000-000000000061',
  'e2000000-0000-4000-8000-000000000021',
  1,
  'Урок 1',
  '',
  30
), (
  'e2000000-0000-4000-8000-000000000062',
  'e2000000-0000-4000-8000-000000000021',
  2,
  'Урок 2',
  '',
  30
);

insert into public.lesson_component (
  id,
  lesson_id,
  position,
  type_key,
  schema_version,
  payload,
  placement_config
)
values (
  'e2000000-0000-4000-8000-000000000071',
  'e2000000-0000-4000-8000-000000000061',
  1,
  'rich_text',
  1,
  '{"title":"Черновик","format":"markdown"}'::jsonb,
  '{}'::jsonb
);

insert into public.course_attestation (
  course_id,
  version,
  title,
  description,
  passing_score_percent,
  questions
)
values (
  'e2000000-0000-4000-8000-000000000021',
  1,
  'Аттестация',
  'Проверка курса',
  100,
  '[{"id":"q1","prompt":"Ответ?","options":[{"id":"a","label":"Да"},{"id":"b","label":"Нет"}],"correctOptionId":"a","explanation":"Верно"}]'::jsonb
);

do $$
declare
  v_snapshot jsonb := pg_temp.build_course_snapshot(
    'e2000000-0000-4000-8000-000000000021'
  );
  v_attestation jsonb := jsonb_build_object(
    'version', 1,
    'title', 'Аттестация',
    'description', 'Проверка курса',
    'passingScorePercent', 100,
    'questions', '[{"id":"q1","prompt":"Ответ?","options":[{"id":"a","label":"Да"},{"id":"b","label":"Нет"}],"correctOptionId":"a","explanation":"Верно"}]'::jsonb
  );
  v_result jsonb;
begin
  v_result := public.publish_course_revision_with_attestation_admin(
    'e2000000-0000-4000-8000-000000000011',
    'e2000000-0000-4000-8000-000000000021',
    'e2000000-0000-4000-8000-000000000041',
    'e2000000-0000-4000-8000-000000000051',
    repeat('a', 64),
    v_snapshot,
    '[]'::jsonb,
    true,
    'educators',
    v_attestation
  );

  perform pg_temp.assert_true(
    v_result @> jsonb_build_object(
      'reviewStatus', 'pending',
      'reviewRevisionId', 'e2000000-0000-4000-8000-000000000051',
      'approvedRevisionId', null
    ),
    'first-time educator wrapper did not create pending review'
  );

  -- A byte-identical retry may carry a fresh proposed UUID, but must reuse the
  -- exact immutable pending revision and never create a second row.
  v_result := public.publish_course_revision_with_attestation_admin(
    'e2000000-0000-4000-8000-000000000011',
    'e2000000-0000-4000-8000-000000000021',
    'e2000000-0000-4000-8000-000000000041',
    'e2000000-0000-4000-8000-000000000059',
    repeat('a', 64),
    v_snapshot,
    '[]'::jsonb,
    true,
    'educators',
    v_attestation
  );

  perform pg_temp.assert_true(
    v_result ->> 'currentRevisionId' =
      'e2000000-0000-4000-8000-000000000051'
    and (
      select count(*) = 1
      from public.course_publication_revision as revision
      where revision.publication_id =
        'e2000000-0000-4000-8000-000000000041'
    ),
    'idempotent wrapper retry created another revision'
  );
end
$$;

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_publication as publication
    join public.course_publication_revision as revision
      on revision.publication_id = publication.id
     and revision.id = publication.current_revision_id
    join public.educator_course_revision_review as review
      on review.publication_id = publication.id
     and review.revision_id = revision.id
    where publication.id = 'e2000000-0000-4000-8000-000000000041'
      and publication.learning_audience = 'educators'
      and publication.is_shidao
      and publication.status = 'published'
      and publication.approved_revision_id is null
      and revision.license_code = 'shidao_official_learning_v1'
      and review.status = 'pending'
  ),
  'first-time wrapper did not persist official immutable pending revision'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from jsonb_array_elements(
      public.list_course_publication_catalog_v2_admin(
        'e2000000-0000-4000-8000-000000000011',
        '',
        'educators',
        '',
        '',
        0,
        20
      ) -> 'courses'
    ) as course(value)
    where course.value ->> 'id' =
      'e2000000-0000-4000-8000-000000000041'
  ),
  'initial pending educator revision leaked into catalog'
);

select public.approve_educator_course_revision_admin(
  'e2000000-0000-4000-8000-000000000041',
  'e2000000-0000-4000-8000-000000000051',
  null
);

select set_config(
  'request.jwt.claim.sub',
  'e2000000-0000-4000-8000-000000000001',
  true
);

set local role authenticated;
update public.lesson_component
set payload = '{"title":"Сохранённый текст","format":"markdown"}'::jsonb
where id = 'e2000000-0000-4000-8000-000000000071';

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_component as component
    where component.id = 'e2000000-0000-4000-8000-000000000071'
      and component.payload ->> 'title' = 'Сохранённый текст'
  ),
  'authenticated educator could not save a Text component'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'e2000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

with changed as (
  update public.lesson_component
  set payload = '{"title":"Чужое изменение","format":"markdown"}'::jsonb
  where id = 'e2000000-0000-4000-8000-000000000071'
  returning 1
)
select pg_temp.assert_true(
  (select count(*) = 0 from changed),
  'authenticated educator mutated another Account component'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'e2000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (select count(*) from public.account) = 1
  and exists (
    select 1
    from public.account as account
    where account.id = 'e2000000-0000-4000-8000-000000000011'
  )
  and not exists (
    select 1
    from public.account as account
    where account.id = 'e2000000-0000-4000-8000-000000000012'
      and account.can_author_educator_courses
  ),
  'authenticated can read another Account capability'
);
reset role;

select pg_temp.assert_true(
  (select count(*) from public.course_publication_self_enrollment) = 0,
  'fixture unexpectedly has enrollment'
);

select pg_temp.assert_true(
  public.get_my_course_publication_progress(
    'e2000000-0000-4000-8000-000000000041'
  ) @> '{"completedLessonCount":0,"totalLessonCount":2,"percent":0,"complete":false,"lastOpenedLessonRef":null}'::jsonb,
  'initial read-only progress projection is wrong'
);

select pg_temp.assert_true(
  (select count(*) from public.course_publication_self_enrollment) = 0,
  'progress GET mutated enrollment state'
);

do $$
begin
  begin
    perform public.get_my_course_publication_attestation(
      'e2000000-0000-4000-8000-000000000041'
    );
    raise exception 'attestation_get_was_not_locked' using errcode = 'XX000';
  exception when sqlstate '55000' then
    if sqlerrm <> 'course_attestation_lessons_incomplete' then raise; end if;
  end;
end
$$;

select pg_temp.assert_true(
  public.set_my_course_publication_lesson_progress(
    'e2000000-0000-4000-8000-000000000041',
    'e2000000-0000-4000-8000-000000000051',
    'e2000000-0000-4000-8000-000000000061',
    true
  ) @> '{"completedLessonCount":1,"totalLessonCount":2,"percent":50,"complete":false,"lastOpenedLessonRef":"e2000000-0000-4000-8000-000000000061"}'::jsonb,
  'first lesson completion projection is wrong'
);

select pg_temp.assert_true(
  public.set_my_course_publication_lesson_progress(
    'e2000000-0000-4000-8000-000000000041',
    'e2000000-0000-4000-8000-000000000051',
    'e2000000-0000-4000-8000-000000000062',
    false
  ) @> '{"completedLessonCount":1,"percent":50,"complete":false,"lastOpenedLessonRef":"e2000000-0000-4000-8000-000000000062"}'::jsonb,
  'open-only update did not move resume pointer'
);

select pg_temp.assert_true(
  public.set_my_course_publication_lesson_progress(
    'e2000000-0000-4000-8000-000000000041',
    'e2000000-0000-4000-8000-000000000051',
    'e2000000-0000-4000-8000-000000000062',
    true
  ) @> '{"completedLessonCount":2,"totalLessonCount":2,"percent":100,"complete":true}'::jsonb,
  'full completion projection is wrong'
);

select pg_temp.assert_true(
  (public.get_my_course_publication_attestation(
    'e2000000-0000-4000-8000-000000000041'
  ) ->> 'revisionId') = 'e2000000-0000-4000-8000-000000000051',
  'attestation is not bound to approved revision'
);

select pg_temp.assert_true(
  (public.submit_my_course_publication_attestation(
    'e2000000-0000-4000-8000-000000000041',
    'e2000000-0000-4000-8000-000000000051',
    '{"q1":"a"}'::jsonb
  ) ->> 'certified')::boolean,
  'completed learner did not receive attestation award'
);

do $$
begin
  begin
    perform public.assert_course_publication_copy_eligible_admin(
      'e2000000-0000-4000-8000-000000000011',
      'e2000000-0000-4000-8000-000000000041'
    );
    raise exception 'educator_copy_was_not_blocked' using errcode = 'XX000';
  exception when sqlstate '42501' then
    if sqlerrm <> 'educator_course_copy_forbidden' then raise; end if;
  end;
end
$$;

do $$
begin
  begin
    insert into public.course_learner (course_id, learner_profile_id)
    values (
      'e2000000-0000-4000-8000-000000000021',
      'e2000000-0000-4000-8000-000000000099'
    );
    raise exception 'educator_roster_was_not_blocked' using errcode = 'XX000';
  exception when sqlstate '23514' then
    if sqlerrm <> 'educator_course_roster_forbidden' then raise; end if;
  end;
end
$$;

do $$
begin
  begin
    insert into public.lesson_run (
      lesson_id,
      scheduled_at,
      planned_duration_minutes
    )
    values (
      'e2000000-0000-4000-8000-000000000061',
      clock_timestamp(),
      45
    );
    raise exception 'educator_lesson_run_was_not_blocked' using errcode = 'XX000';
  exception when sqlstate '23514' then
    if sqlerrm <> 'educator_course_lesson_run_forbidden' then raise; end if;
  end;
end
$$;

update public.course
set title = 'Кандидат на проверке'
where id = 'e2000000-0000-4000-8000-000000000021';

do $$
declare
  v_snapshot jsonb := pg_temp.build_course_snapshot(
    'e2000000-0000-4000-8000-000000000021'
  );
  v_attestation jsonb := jsonb_build_object(
    'version', 1,
    'title', 'Аттестация',
    'description', 'Проверка курса',
    'passingScorePercent', 100,
    'questions', '[{"id":"q1","prompt":"Ответ?","options":[{"id":"a","label":"Да"},{"id":"b","label":"Нет"}],"correctOptionId":"a","explanation":"Верно"}]'::jsonb
  );
  v_result jsonb;
begin
  v_result := public.publish_course_revision_with_attestation_admin(
    'e2000000-0000-4000-8000-000000000011',
    'e2000000-0000-4000-8000-000000000021',
    'e2000000-0000-4000-8000-000000000041',
    'e2000000-0000-4000-8000-000000000052',
    repeat('b', 64),
    v_snapshot,
    '[]'::jsonb,
    true,
    'educators',
    v_attestation
  );

  perform pg_temp.assert_true(
    v_result @> jsonb_build_object(
      'reviewStatus', 'pending',
      'reviewRevisionId', 'e2000000-0000-4000-8000-000000000052',
      'approvedRevisionId', 'e2000000-0000-4000-8000-000000000051'
    )
    and exists (
      select 1
      from public.course_publication_revision as revision
      where revision.id = 'e2000000-0000-4000-8000-000000000052'
        and revision.license_code = 'shidao_official_learning_v1'
    ),
    'second wrapper did not persist official pending candidate'
  );

  begin
    perform public.publish_course_revision_with_attestation_admin(
      'e2000000-0000-4000-8000-000000000011',
      'e2000000-0000-4000-8000-000000000021',
      'e2000000-0000-4000-8000-000000000041',
      'e2000000-0000-4000-8000-000000000053',
      repeat('c', 64),
      v_snapshot,
      '[]'::jsonb,
      true,
      'educators',
      v_attestation
    );
    raise exception 'second_pending_revision_was_accepted'
      using errcode = 'XX000';
  exception when sqlstate '55000' then
    if sqlerrm <> 'educator_course_review_already_pending' then raise; end if;
  end;
end
$$;

select pg_temp.assert_true(
  (
    public.list_course_publication_catalog_v2_admin(
      'e2000000-0000-4000-8000-000000000011',
      '',
      'educators',
      '',
      '',
      0,
      20
    ) -> 'courses' -> 0 ->> 'title'
  ) = 'Одобренный курс'
  and (
    public.list_course_publication_catalog_v2_admin(
      'e2000000-0000-4000-8000-000000000011',
      '',
      'educators',
      '',
      '',
      0,
      20
    ) -> 'courses' -> 0 ->> 'publishedAt'
  )::timestamptz = (
    select revision.published_at
    from public.course_publication_revision as revision
    where revision.id = 'e2000000-0000-4000-8000-000000000051'
  ),
  'pending candidate leaked into approved catalog projection/order date'
);

select public.unpublish_course_publication_admin(
  'e2000000-0000-4000-8000-000000000011',
  'e2000000-0000-4000-8000-000000000021'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_publication as publication
    join public.educator_course_revision_review as review
      on review.revision_id = publication.current_revision_id
    where publication.id = 'e2000000-0000-4000-8000-000000000041'
      and publication.current_revision_id =
        'e2000000-0000-4000-8000-000000000052'
      and publication.approved_revision_id =
        'e2000000-0000-4000-8000-000000000051'
      and publication.status = 'published'
      and review.status = 'rejected'
      and review.review_feedback = 'withdrawn_by_author'
  ),
  'withdraw did not preserve approved listing and rejected candidate audit'
);

do $$
begin
  begin
    perform public.approve_educator_course_revision_admin(
      'e2000000-0000-4000-8000-000000000041',
      'e2000000-0000-4000-8000-000000000052',
      null
    );
    raise exception 'withdrawn_revision_was_approved' using errcode = 'XX000';
  exception when sqlstate '55000' then
    if sqlerrm <> 'educator_course_review_not_pending' then raise; end if;
  end;
end
$$;

update public.account
set can_author_educator_courses = false
where id = 'e2000000-0000-4000-8000-000000000011';

set local role authenticated;
do $$
begin
  begin
    update public.lesson_component
    set payload = '{"title":"Запрещённое сохранение","format":"markdown"}'::jsonb
    where id = 'e2000000-0000-4000-8000-000000000071';
    raise exception 'revoked_author_edited_component' using errcode = 'XX000';
  exception when sqlstate '42501' then
    if sqlerrm <> 'educator_course_authoring_not_allowed' then raise; end if;
  end;
end
$$;
reset role;

do $$
begin
  begin
    update public.course
    set title = 'Forbidden edit'
    where id = 'e2000000-0000-4000-8000-000000000021';
    raise exception 'revoked_author_edited_content' using errcode = 'XX000';
  exception when sqlstate '42501' then
    if sqlerrm <> 'educator_course_authoring_not_allowed' then raise; end if;
  end;
end
$$;

-- Safe cleanup stays available after capability revocation.
select public.unpublish_course_publication_admin(
  'e2000000-0000-4000-8000-000000000011',
  'e2000000-0000-4000-8000-000000000021'
);
select pg_temp.assert_true(
  public.archive_course('e2000000-0000-4000-8000-000000000021') = 'archived',
  'revoked author could not archive after unpublish'
);

select pg_temp.assert_true(
  not has_column_privilege(
    'authenticated',
    'public.account',
    'can_author_educator_courses',
    'UPDATE'
  ),
  'authenticated can mutate educator author capability'
);

rollback;
SQL

echo "Educator course governance DB acceptance passed."
