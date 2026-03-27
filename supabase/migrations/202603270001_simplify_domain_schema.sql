-- Simplify domain model to MVP tables:
--   adult, adult_role, organization, student
-- Keep data by renaming legacy tables and remapping links where possible.

begin;

-- 1) Table renames (data-preserving)
alter table if exists public.adult_account rename to adult;
alter table if exists public.adult_role_membership rename to adult_role;
alter table if exists public.student_profile rename to student;

-- 2) Adult + organization naming cleanup
alter table if exists public.organization
  rename column owner_adult_account_id to owner_adult_id;

-- 3) adult_role naming cleanup (keep scope behavior)
alter table if exists public.adult_role
  rename column adult_account_id to adult_id;
alter table if exists public.adult_role
  rename column scope_organization_id to scope_id;

-- 4) student shape for MVP single responsible adult
alter table if exists public.student
  rename column created_in_scope_organization_id to created_in_scope_id;

alter table if exists public.student
  add column if not exists owner_adult_id uuid,
  add column if not exists owner_kind text,
  add column if not exists auth_user_id uuid unique;

-- 5) Recreate FKs/constraints with new names
alter table if exists public.organization drop constraint if exists organization_owner_adult_account_id_fkey;
alter table if exists public.organization
  add constraint organization_owner_adult_id_fkey
  foreign key (owner_adult_id) references public.adult(id) on delete restrict;

alter table if exists public.adult_role drop constraint if exists adult_role_membership_adult_account_id_fkey;
alter table if exists public.adult_role drop constraint if exists adult_role_membership_scope_organization_id_fkey;
alter table if exists public.adult_role
  add constraint adult_role_adult_id_fkey
  foreign key (adult_id) references public.adult(id) on delete cascade,
  add constraint adult_role_scope_id_fkey
  foreign key (scope_id) references public.organization(id) on delete cascade;

alter table if exists public.student drop constraint if exists student_profile_created_by_adult_id_fkey;
alter table if exists public.student drop constraint if exists student_profile_created_in_scope_organization_id_fkey;
alter table if exists public.student
  add constraint student_created_by_adult_id_fkey
  foreign key (created_by_adult_id) references public.adult(id) on delete restrict,
  add constraint student_created_in_scope_id_fkey
  foreign key (created_in_scope_id) references public.organization(id) on delete cascade,
  add constraint student_owner_adult_id_fkey
  foreign key (owner_adult_id) references public.adult(id) on delete restrict,
  add constraint student_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

-- 6) Map legacy guardian links to single owner_adult_id (MVP rule)
-- Priority: first active guardian; fallback: first link; final fallback: creator as teacher-owner.
with chosen_guardian as (
  select distinct on (sgl.student_id)
    sgl.student_id,
    sgl.adult_account_id as owner_adult_id
  from public.student_guardian_link sgl
  order by sgl.student_id,
    case when sgl.status = 'active' then 0 else 1 end,
    sgl.created_at asc
)
update public.student s
set owner_adult_id = cg.owner_adult_id,
    owner_kind = 'parent'
from chosen_guardian cg
where s.id = cg.student_id
  and s.owner_adult_id is null;

update public.student
set owner_adult_id = created_by_adult_id,
    owner_kind = 'teacher'
where owner_adult_id is null;

-- 7) Enforce new MVP invariant
alter table if exists public.student drop constraint if exists student_owner_kind_check;
alter table if exists public.student
  add constraint student_owner_kind_check
  check (owner_kind in ('parent', 'teacher'));

alter table if exists public.student drop constraint if exists student_profile_check;
alter table if exists public.student drop constraint if exists student_created_scope_valid;
alter table if exists public.student
  add constraint student_created_scope_valid
  check (
    (created_in_scope_type = 'personal' and created_in_scope_id is null)
    or
    (created_in_scope_type = 'organization' and created_in_scope_id is not null)
  );

alter table if exists public.adult_role drop constraint if exists adult_role_scope_valid;
alter table if exists public.adult_role
  add constraint adult_role_scope_valid
  check (
    (scope_type = 'personal' and scope_id is null)
    or
    (scope_type = 'organization' and scope_id is not null)
  );

-- Unique role assignment with simplified column names.
drop index if exists public.adult_role_membership_adult_account_id_role_scope_type_scope_organiza_key;
create unique index if not exists adult_role_unique_assignment
  on public.adult_role (adult_id, role, scope_type, scope_id);

-- Enforce exactly one responsible adult per student.
alter table if exists public.student
  alter column owner_adult_id set not null,
  alter column owner_kind set not null;

-- 8) Trigger rename cleanup for readability
-- PostgreSQL does not support `ALTER TRIGGER IF EXISTS`, so guard with catalog checks.
do $$
begin
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'adult'
      and t.tgname = 'trg_adult_account_updated_at'
  ) then
    execute 'alter trigger trg_adult_account_updated_at on public.adult rename to trg_adult_updated_at';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'student'
      and t.tgname = 'trg_student_profile_updated_at'
  ) then
    execute 'alter trigger trg_student_profile_updated_at on public.student rename to trg_student_updated_at';
  end if;
end
$$;

-- 9) RLS + helper function updates
create or replace function public.current_adult_id()
returns uuid
language sql
stable
as $$
  select a.id
  from public.adult a
  where a.auth_user_id = auth.uid()
  limit 1;
$$;

-- Backward-compat helper name kept to avoid breakage during rollout.
create or replace function public.current_adult_account_id()
returns uuid
language sql
stable
as $$
  select public.current_adult_id();
$$;

drop policy if exists adult_self_select on public.adult;
drop policy if exists adult_self_update on public.adult;
drop policy if exists role_membership_self_select on public.adult_role;
drop policy if exists student_profile_select_policy on public.student;
do $$
begin
  if to_regclass('public.student_guardian_link') is not null then
    execute 'drop policy if exists guardian_link_self_select on public.student_guardian_link';
  end if;
end
$$;

-- 10) Remove deprecated auth/storage tables from app domain
-- Supabase Auth (auth.users) is the source of truth for credentials.
drop table if exists public.student_credentials;
drop table if exists public.student_guardian_link;

create policy adult_self_select on public.adult
for select using (id = public.current_adult_id());

create policy adult_self_update on public.adult
for update using (id = public.current_adult_id())
with check (id = public.current_adult_id());

create policy adult_role_self_select on public.adult_role
for select using (adult_id = public.current_adult_id());

create policy student_select_policy on public.student
for select using (
  owner_adult_id = public.current_adult_id()
  or exists (
    select 1
    from public.adult_role ar
    where ar.adult_id = public.current_adult_id()
      and ar.role in ('teacher', 'org_teacher', 'org_owner')
      and (
        (student.created_in_scope_type = 'personal' and ar.scope_type = 'personal')
        or
        (student.created_in_scope_type = 'organization'
          and ar.scope_type = 'organization'
          and ar.scope_id = student.created_in_scope_id)
      )
  )
);

revoke all on public.student from anon;
revoke all on public.student from authenticated;

grant usage on schema public to anon, authenticated;
grant select, update on public.adult to authenticated;
grant select on public.organization to authenticated;
grant select on public.adult_role to authenticated;
grant select on public.student to authenticated;

commit;
