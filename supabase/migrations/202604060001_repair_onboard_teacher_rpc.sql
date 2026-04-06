begin;

create extension if not exists pgcrypto;

create table if not exists public.teacher (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  timezone text default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Школа',
  slug text not null unique,
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

create table if not exists public.class_teacher (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public."class"(id) on delete cascade,
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, teacher_id)
);

alter table public.teacher add column if not exists user_id uuid;
alter table public.teacher add column if not exists full_name text;
alter table public.teacher add column if not exists updated_at timestamptz not null default now();

alter table public.school add column if not exists name text;
alter table public.school add column if not exists slug text;

alter table public."class" add column if not exists school_id uuid;
alter table public."class" add column if not exists name text;

alter table public.school_teacher add column if not exists school_id uuid;
alter table public.school_teacher add column if not exists teacher_id uuid;
alter table public.school_teacher add column if not exists role text;

alter table public.class_teacher add column if not exists class_id uuid;
alter table public.class_teacher add column if not exists teacher_id uuid;

create unique index if not exists teacher_user_id_unique_idx
  on public.teacher (user_id);

create unique index if not exists school_teacher_school_teacher_unique_idx
  on public.school_teacher (school_id, teacher_id);

create unique index if not exists class_teacher_class_teacher_unique_idx
  on public.class_teacher (class_id, teacher_id);

create unique index if not exists class_school_name_unique_idx
  on public."class" (school_id, lower(name));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_teacher_school_id_fkey'
      and conrelid = 'public.school_teacher'::regclass
  ) then
    alter table public.school_teacher
      add constraint school_teacher_school_id_fkey
      foreign key (school_id) references public.school(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_teacher_teacher_id_fkey'
      and conrelid = 'public.school_teacher'::regclass
  ) then
    alter table public.school_teacher
      add constraint school_teacher_teacher_id_fkey
      foreign key (teacher_id) references public.teacher(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_teacher_class_id_fkey'
      and conrelid = 'public.class_teacher'::regclass
  ) then
    alter table public.class_teacher
      add constraint class_teacher_class_id_fkey
      foreign key (class_id) references public."class"(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_teacher_teacher_id_fkey'
      and conrelid = 'public.class_teacher'::regclass
  ) then
    alter table public.class_teacher
      add constraint class_teacher_teacher_id_fkey
      foreign key (teacher_id) references public.teacher(id) on delete cascade;
  end if;
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

grant execute on function public.onboard_teacher(uuid, text) to authenticated;

commit;
