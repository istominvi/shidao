begin;

-- 1) Parent read-only visibility for class/school context.
drop policy if exists class_parent_context_select on public."class";
create policy class_parent_context_select on public."class"
for select using (
  exists (
    select 1
    from public.class_student cs
    join public.student s on s.id = cs.student_id
    where cs.class_id = "class".id
      and s.parent_id = public.current_parent_id()
  )
);

drop policy if exists school_parent_context_select on public.school;
create policy school_parent_context_select on public.school
for select using (
  exists (
    select 1
    from public.class_student cs
    join public.student s on s.id = cs.student_id
    join public."class" c on c.id = cs.class_id
    where c.school_id = school.id
      and s.parent_id = public.current_parent_id()
  )
);

-- 2) Backfill patch for legacy students that should be in teacher default classes.
--    Recompute default classes from current data (no temp snapshot dependence), idempotent insert.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student' and column_name = 'created_by_adult_id'
  )
  and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'adult'
  ) then
    execute $sql$
      with default_class as (
        select c.school_id, c.id as class_id
        from (
          select c.*,
                 row_number() over (partition by c.school_id order by c.created_at asc, c.id asc) as rn
          from public."class" c
        ) c
        where c.rn = 1
      )
      insert into public.class_student (class_id, student_id, created_at)
      select distinct dc.class_id, s.id, coalesce(s.created_at, now())
      from public.student s
      join public.adult a on a.id = s.created_by_adult_id
      join public.teacher t on t.user_id = a.auth_user_id
      join public.school_teacher st on st.teacher_id = t.id and st.role = 'owner'
      join default_class dc on dc.school_id = st.school_id
      where not exists (
        select 1 from public.class_student cs where cs.student_id = s.id
      )
      on conflict (class_id, student_id) do nothing
    $sql$;
  end if;
end
$$;

-- 3) Canonical student internal auth email consistency.
update public.student
set internal_auth_email = lower(login) || '@students.shidao.internal'
where internal_auth_email is distinct from (lower(login) || '@students.shidao.internal');

create unique index if not exists student_internal_auth_email_unique_ci
  on public.student (lower(internal_auth_email));

-- 4) Performance indexes for query paths.
create index if not exists student_parent_id_idx on public.student (parent_id);
create index if not exists class_student_student_id_idx on public.class_student (student_id);
create index if not exists class_teacher_teacher_id_idx on public.class_teacher (teacher_id);
create index if not exists school_teacher_teacher_id_idx on public.school_teacher (teacher_id);

commit;
