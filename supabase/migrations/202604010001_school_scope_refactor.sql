begin;

-- Drop policies that depend on old scope columns before schema changes.
drop policy if exists student_select_policy on public.student;
drop policy if exists organization_select_policy on public.organization;
drop policy if exists school_select_policy on public.school;

-- 1) Rename organization -> school.
do $$
begin
  if to_regclass('public.organization') is not null
     and to_regclass('public.school') is null then
    execute 'alter table public.organization rename to school';
  end if;
end
$$;

-- 2) Keep trigger names aligned with the new table name.
do $$
begin
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'school'
      and t.tgname = 'trg_organization_updated_at'
  ) then
    execute 'alter trigger trg_organization_updated_at on public.school rename to trg_school_updated_at';
  end if;
end
$$;

-- 3) adult_role: scope_id -> school_id, remove scope_type, update role enum.
alter table if exists public.adult_role
  add column if not exists school_id uuid;

update public.adult_role
set school_id = scope_id
where school_id is null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'adult_role'
      and column_name = 'scope_id'
  );

alter table if exists public.adult_role
  drop constraint if exists adult_role_scope_id_fkey;

alter table if exists public.adult_role
  drop constraint if exists adult_role_scope_valid;

alter table if exists public.adult_role
  drop column if exists scope_type;

alter table if exists public.adult_role
  drop column if exists scope_id;

-- Migrate enum values safely via a new enum type and cast.
do $$
begin
  if exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'role_code'
  ) and not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'role_code_v2'
  ) then
    create type public.role_code_v2 as enum ('parent', 'teacher', 'school_owner', 'school_teacher');
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'adult_role'
      and column_name = 'role'
      and udt_name = 'role_code'
  ) then
    alter table public.adult_role
      alter column role type public.role_code_v2
      using (
        case role::text
          when 'org_owner' then 'school_owner'
          when 'org_teacher' then 'school_teacher'
          else role::text
        end
      )::public.role_code_v2;

    drop type if exists public.role_code;
    alter type public.role_code_v2 rename to role_code;
  end if;
end
$$;

alter table if exists public.adult_role
  add constraint adult_role_school_id_fkey
  foreign key (school_id) references public.school(id) on delete cascade;

alter table if exists public.adult_role
  add constraint adult_role_school_context_valid
  check (
    (role in ('parent', 'teacher') and school_id is null)
    or
    (role in ('school_owner', 'school_teacher') and school_id is not null)
  );

drop index if exists public.adult_role_unique_assignment;
drop index if exists public.adult_role_personal_role_unique;
drop index if exists public.adult_role_school_role_unique;

create unique index adult_role_personal_role_unique
  on public.adult_role (adult_id, role)
  where school_id is null;

create unique index adult_role_school_role_unique
  on public.adult_role (adult_id, role, school_id)
  where school_id is not null;

-- 4) student: created_in_scope_* -> school_id.
alter table if exists public.student
  add column if not exists school_id uuid;

update public.student
set school_id = created_in_scope_id
where school_id is null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student'
      and column_name = 'created_in_scope_id'
  );

alter table if exists public.student
  drop constraint if exists student_created_in_scope_id_fkey;

alter table if exists public.student
  drop constraint if exists student_created_scope_valid;

alter table if exists public.student
  drop column if exists created_in_scope_type;

alter table if exists public.student
  drop column if exists created_in_scope_id;

alter table if exists public.student
  add constraint student_school_id_fkey
  foreign key (school_id) references public.school(id) on delete cascade;

-- 5) RLS policies for the new school context model.
create policy student_select_policy on public.student
for select using (
  owner_adult_id = public.current_adult_id()
  or exists (
    select 1
    from public.adult_role ar
    where ar.adult_id = public.current_adult_id()
      and (
        (ar.role = 'teacher' and ar.school_id is null and student.school_id is null)
        or
        (ar.role in ('school_teacher', 'school_owner') and ar.school_id = student.school_id)
      )
  )
);

-- 6) Rename policy + grants to school.
create policy school_select_policy on public.school
for select using (
  owner_adult_id = public.current_adult_id()
  or exists (
    select 1
    from public.adult_role ar
    where ar.adult_id = public.current_adult_id()
      and ar.role in ('school_teacher', 'school_owner')
      and ar.school_id = school.id
  )
);

do $$
begin
  if to_regclass('public.organization') is not null then
    execute 'revoke all on public.organization from authenticated';
  end if;
end
$$;
grant select on public.school to authenticated;

-- 7) Remove obsolete scope enum when it is no longer referenced.
drop type if exists public.scope_type;

commit;
