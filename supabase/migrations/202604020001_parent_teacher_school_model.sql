begin;

create extension if not exists pgcrypto;

-- Core tables for the explicit school-centered model.
create table if not exists public.parent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  timezone text default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  timezone text default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_teacher (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  role text not null check (role in ('owner', 'teacher')),
  created_at timestamptz not null default now(),
  unique (school_id, teacher_id)
);

create table if not exists public."class" (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists class_school_name_unique_idx
  on public."class" (school_id, lower(name));

create table if not exists public.class_teacher (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public."class"(id) on delete cascade,
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, teacher_id)
);

create table if not exists public.class_student (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public."class"(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

-- Student table migration to explicit model.
alter table if exists public.student add column if not exists user_id uuid;
alter table if exists public.student add column if not exists login text;
alter table if exists public.student add column if not exists parent_id uuid;
alter table if exists public.student add column if not exists internal_auth_email text;

-- Backfill student.user_id from legacy auth_user_id when present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student' and column_name = 'auth_user_id'
  ) then
    execute 'update public.student set user_id = auth_user_id where user_id is null and auth_user_id is not null';
  end if;
end
$$;

-- Backfill student.login and internal auth email from legacy columns.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student' and column_name = 'login_identifier'
  ) then
    execute 'update public.student set login = login_identifier where login is null and login_identifier is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student' and column_name = 'auth_login_email'
  ) then
    execute 'update public.student set internal_auth_email = auth_login_email where internal_auth_email is null and auth_login_email is not null';
  end if;
end
$$;

-- Parent and teacher backfill from legacy adult/adult_role/student relations.
insert into public.parent (user_id, full_name, timezone, created_at, updated_at)
select distinct a.auth_user_id, a.full_name, coalesce(a.timezone, 'Europe/Moscow'), coalesce(a.created_at, now()), coalesce(a.updated_at, now())
from public.adult a
left join public.adult_role ar on ar.adult_id = a.id
left join public.student s on s.owner_adult_id = a.id and s.owner_kind = 'parent'
where a.auth_user_id is not null
  and (
    ar.role::text = 'parent'
    or s.id is not null
  )
on conflict (user_id) do update
set full_name = excluded.full_name,
    timezone = excluded.timezone,
    updated_at = greatest(public.parent.updated_at, excluded.updated_at);

insert into public.teacher (user_id, full_name, timezone, created_at, updated_at)
select distinct a.auth_user_id, a.full_name, coalesce(a.timezone, 'Europe/Moscow'), coalesce(a.created_at, now()), coalesce(a.updated_at, now())
from public.adult a
left join public.adult_role ar on ar.adult_id = a.id
left join public.student s on s.created_by_adult_id = a.id
where a.auth_user_id is not null
  and (
    ar.role::text in ('teacher', 'org_teacher', 'org_owner', 'school_teacher', 'school_owner')
    or s.id is not null
  )
on conflict (user_id) do update
set full_name = excluded.full_name,
    timezone = excluded.timezone,
    updated_at = greatest(public.teacher.updated_at, excluded.updated_at);

-- School cleanup from legacy organization/school columns.
alter table if exists public.school
  alter column name set not null,
  alter column slug set not null;

alter table if exists public.school drop column if exists owner_adult_id;
alter table if exists public.school drop column if exists seat_limit;
alter table if exists public.school drop column if exists is_active;

-- school_teacher backfill from organization/school-scoped memberships.
insert into public.school_teacher (school_id, teacher_id, role, created_at)
select distinct
  ar.school_id,
  t.id,
  case when ar.role::text in ('org_owner', 'school_owner') then 'owner' else 'teacher' end,
  coalesce(ar.created_at, now())
from public.adult_role ar
join public.adult a on a.id = ar.adult_id
join public.teacher t on t.user_id = a.auth_user_id
where ar.school_id is not null
  and ar.role::text in ('org_owner', 'org_teacher', 'school_owner', 'school_teacher')
on conflict (school_id, teacher_id) do update
set role = case
  when public.school_teacher.role = 'owner' or excluded.role = 'owner' then 'owner'
  else 'teacher'
end;

-- Parent relation on student via legacy owner_adult_id where known parent mapping exists.
update public.student s
set parent_id = p.id
from public.adult a
join public.parent p on p.user_id = a.auth_user_id
where s.parent_id is null
  and s.owner_adult_id = a.id
  and s.owner_kind = 'parent';

alter table if exists public.student
  add constraint student_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table if exists public.student
  add constraint student_parent_id_fkey
  foreign key (parent_id) references public.parent(id) on delete set null;

create unique index if not exists student_login_unique_ci
  on public.student (lower(login));

-- Ensure each school has at least one default class.
create temporary table tmp_default_class (
  school_id uuid primary key,
  class_id uuid not null
) on commit drop;

insert into public."class" (school_id, name, created_at, updated_at)
select s.id, 'Основной класс', now(), now()
from public.school s
where not exists (
  select 1 from public."class" c where c.school_id = s.id
);

insert into tmp_default_class (school_id, class_id)
select c.school_id, c.id
from (
  select c.*, row_number() over (partition by c.school_id order by c.created_at, c.id) as rn
  from public."class" c
) c
where c.rn = 1;

-- Backfill class_teacher from school_teacher to keep teacher visibility.
insert into public.class_teacher (class_id, teacher_id, created_at)
select dc.class_id, st.teacher_id, st.created_at
from public.school_teacher st
join tmp_default_class dc on dc.school_id = st.school_id
on conflict (class_id, teacher_id) do nothing;

-- Create generated schools/classes for teachers that still have no school.
do $$
declare
  rec record;
  v_school_id uuid;
  v_class_id uuid;
  base_slug text;
  slug_candidate text;
  i integer;
begin
  for rec in
    select t.id as teacher_id, t.full_name
    from public.teacher t
    where not exists (
      select 1 from public.school_teacher st where st.teacher_id = t.id
    )
  loop
    base_slug := lower(regexp_replace(coalesce(nullif(rec.full_name, ''), 'teacher') || '-' || left(rec.teacher_id::text, 8), '[^a-z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then
      base_slug := 'school-' || left(rec.teacher_id::text, 8);
    end if;

    slug_candidate := base_slug;
    i := 1;
    while exists (select 1 from public.school s where s.slug = slug_candidate) loop
      i := i + 1;
      slug_candidate := base_slug || '-' || i::text;
    end loop;

    insert into public.school (name, slug)
    values (coalesce(nullif(rec.full_name, ''), 'Преподаватель') || ' — школа', slug_candidate)
    returning id into v_school_id;

    insert into public.school_teacher (school_id, teacher_id, role)
    values (v_school_id, rec.teacher_id, 'owner');

    insert into public."class" (school_id, name)
    values (v_school_id, 'Основной класс')
    returning id into v_class_id;

    insert into public.class_teacher (class_id, teacher_id)
    values (v_class_id, rec.teacher_id);
  end loop;
end
$$;

-- Backfill class_student from reliable school context only.
insert into public.class_student (class_id, student_id, created_at)
select distinct dc.class_id, s.id, coalesce(s.created_at, now())
from public.student s
join tmp_default_class dc on dc.school_id = s.school_id
where s.school_id is not null
on conflict (class_id, student_id) do nothing;

-- Legacy teachers with personal ownership context: place student into that teacher's generated/owned default class.
insert into public.class_student (class_id, student_id, created_at)
select distinct dc.class_id, s.id, coalesce(s.created_at, now())
from public.student s
join public.adult a on a.id = s.created_by_adult_id
join public.teacher t on t.user_id = a.auth_user_id
join public.school_teacher st on st.teacher_id = t.id and st.role = 'owner'
join tmp_default_class dc on dc.school_id = st.school_id
where s.school_id is null
on conflict (class_id, student_id) do nothing;

-- Drop old policies/helpers and rebuild RLS in the new model.
drop policy if exists adult_self_select on public.adult;
drop policy if exists adult_self_update on public.adult;
drop policy if exists adult_role_self_select on public.adult_role;
drop policy if exists student_select_policy on public.student;
drop policy if exists school_select_policy on public.school;

drop function if exists public.current_adult_account_id();
drop function if exists public.current_adult_id();

create or replace function public.current_teacher_id()
returns uuid
language sql
stable
as $$
  select t.id from public.teacher t where t.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_parent_id()
returns uuid
language sql
stable
as $$
  select p.id from public.parent p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
as $$
  select s.id from public.student s where s.user_id = auth.uid() limit 1;
$$;

alter table public.parent enable row level security;
alter table public.teacher enable row level security;
alter table public.school enable row level security;
alter table public."class" enable row level security;
alter table public.school_teacher enable row level security;
alter table public.class_teacher enable row level security;
alter table public.class_student enable row level security;
alter table public.student enable row level security;

create policy parent_self_select on public.parent
for select using (id = public.current_parent_id());
create policy parent_self_update on public.parent
for update using (id = public.current_parent_id()) with check (id = public.current_parent_id());

create policy teacher_self_select on public.teacher
for select using (id = public.current_teacher_id());
create policy teacher_self_update on public.teacher
for update using (id = public.current_teacher_id()) with check (id = public.current_teacher_id());

create policy student_self_parent_teacher_select on public.student
for select using (
  user_id = auth.uid()
  or parent_id = public.current_parent_id()
  or exists (
    select 1
    from public.class_student cs
    join public.class_teacher ct on ct.class_id = cs.class_id
    where cs.student_id = student.id
      and ct.teacher_id = public.current_teacher_id()
  )
);

create policy student_self_update on public.student
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy school_teacher_membership_select on public.school
for select using (
  exists (
    select 1
    from public.school_teacher st
    where st.school_id = school.id
      and st.teacher_id = public.current_teacher_id()
  )
);

create policy class_teacher_or_student_select on public."class"
for select using (
  exists (
    select 1 from public.class_teacher ct
    where ct.class_id = "class".id
      and ct.teacher_id = public.current_teacher_id()
  )
  or exists (
    select 1 from public.class_student cs
    where cs.class_id = "class".id
      and cs.student_id = public.current_student_id()
  )
);

create policy school_teacher_self_select on public.school_teacher
for select using (teacher_id = public.current_teacher_id());

create policy class_teacher_self_or_student_select on public.class_teacher
for select using (
  teacher_id = public.current_teacher_id()
  or exists (
    select 1 from public.class_student cs
    where cs.class_id = class_teacher.class_id
      and cs.student_id = public.current_student_id()
  )
);

create policy class_student_related_select on public.class_student
for select using (
  student_id = public.current_student_id()
  or exists (
    select 1
    from public.student s
    where s.id = class_student.student_id
      and s.parent_id = public.current_parent_id()
  )
  or exists (
    select 1
    from public.class_teacher ct
    where ct.class_id = class_student.class_id
      and ct.teacher_id = public.current_teacher_id()
  )
);

-- Updated_at triggers.
drop trigger if exists trg_parent_updated_at on public.parent;
create trigger trg_parent_updated_at
before update on public.parent
for each row execute function public.set_updated_at();

drop trigger if exists trg_teacher_updated_at on public.teacher;
create trigger trg_teacher_updated_at
before update on public.teacher
for each row execute function public.set_updated_at();

drop trigger if exists trg_school_updated_at on public.school;
create trigger trg_school_updated_at
before update on public.school
for each row execute function public.set_updated_at();

drop trigger if exists trg_class_updated_at on public."class";
create trigger trg_class_updated_at
before update on public."class"
for each row execute function public.set_updated_at();

drop trigger if exists trg_student_updated_at on public.student;
create trigger trg_student_updated_at
before update on public.student
for each row execute function public.set_updated_at();

-- Cleanup old student columns/constraints from old model.
alter table if exists public.student drop constraint if exists student_owner_adult_id_fkey;
alter table if exists public.student drop constraint if exists student_created_by_adult_id_fkey;
alter table if exists public.student drop constraint if exists student_created_in_scope_id_fkey;
alter table if exists public.student drop constraint if exists student_owner_kind_check;
alter table if exists public.student drop constraint if exists student_created_scope_valid;

alter table if exists public.student drop column if exists auth_user_id;
alter table if exists public.student drop column if exists login_identifier;
alter table if exists public.student drop column if exists auth_login_email;
alter table if exists public.student drop column if exists owner_adult_id;
alter table if exists public.student drop column if exists owner_kind;
alter table if exists public.student drop column if exists created_by_adult_id;
alter table if exists public.student drop column if exists created_in_scope_type;
alter table if exists public.student drop column if exists created_in_scope_id;
alter table if exists public.student drop column if exists school_id;

alter table if exists public.student alter column login set not null;

-- Onboarding RPC helpers for app integration.
create or replace function public.onboard_parent(p_user_id uuid, p_full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_id uuid;
begin
  insert into public.parent (user_id, full_name)
  values (p_user_id, p_full_name)
  on conflict (user_id) do update
    set full_name = coalesce(excluded.full_name, public.parent.full_name),
        updated_at = now()
  returning id into v_parent_id;

  return v_parent_id;
end
$$;

create or replace function public.onboard_teacher(p_user_id uuid, p_full_name text default null)
returns table (teacher_id uuid, school_id uuid, class_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_school_id uuid;
  v_class_id uuid;
  base_slug text;
  slug_candidate text;
  i integer;
begin
  insert into public.teacher (user_id, full_name)
  values (p_user_id, p_full_name)
  on conflict (user_id) do update
    set full_name = coalesce(excluded.full_name, public.teacher.full_name),
        updated_at = now()
  returning id into v_teacher_id;

  select st.school_id into v_school_id
  from public.school_teacher st
  where st.teacher_id = v_teacher_id
  order by case when st.role = 'owner' then 0 else 1 end, st.created_at
  limit 1;

  if v_school_id is null then
    base_slug := lower(regexp_replace(coalesce(nullif(p_full_name, ''), 'teacher') || '-' || left(v_teacher_id::text, 8), '[^a-z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then
      base_slug := 'school-' || left(v_teacher_id::text, 8);
    end if;

    slug_candidate := base_slug;
    i := 1;
    while exists (select 1 from public.school s where s.slug = slug_candidate) loop
      i := i + 1;
      slug_candidate := base_slug || '-' || i::text;
    end loop;

    insert into public.school (name, slug)
    values (coalesce(nullif(p_full_name, ''), 'Преподаватель') || ' — школа', slug_candidate)
    returning id into v_school_id;

    insert into public.school_teacher (school_id, teacher_id, role)
    values (v_school_id, v_teacher_id, 'owner')
    on conflict (school_id, teacher_id) do update set role = 'owner';
  end if;

  select c.id into v_class_id
  from public."class" c
  where c.school_id = v_school_id
  order by c.created_at asc, c.id asc
  limit 1;

  if v_class_id is null then
    insert into public."class" (school_id, name)
    values (v_school_id, 'Основной класс')
    returning id into v_class_id;
  end if;

  insert into public.class_teacher (class_id, teacher_id)
  values (v_class_id, v_teacher_id)
  on conflict (class_id, teacher_id) do nothing;

  return query select v_teacher_id, v_school_id, v_class_id;
end
$$;

revoke all on public.adult from authenticated, anon;
revoke all on public.adult_role from authenticated, anon;

grant usage on schema public to anon, authenticated;
grant select, update on public.parent to authenticated;
grant select, update on public.teacher to authenticated;
grant select on public.school to authenticated;
grant select on public.school_teacher to authenticated;
grant select on public."class" to authenticated;
grant select on public.class_teacher to authenticated;
grant select on public.class_student to authenticated;
grant select, update on public.student to authenticated;
grant execute on function public.onboard_parent(uuid, text) to authenticated;
grant execute on function public.onboard_teacher(uuid, text) to authenticated;

-- Remove legacy tables from active domain model.
drop table if exists public.adult_role;
drop table if exists public.adult;

drop type if exists public.role_code;

commit;
