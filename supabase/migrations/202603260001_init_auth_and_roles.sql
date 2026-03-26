-- ShiDao baseline schema for Demo + MVP foundation
-- Aligned with docs/tz.md and docs/autorization.md

create extension if not exists pgcrypto;

-- Enums
create type public.role_code as enum ('parent', 'teacher', 'org_owner', 'org_teacher');
create type public.scope_type as enum ('personal', 'organization');
create type public.guardian_status as enum ('invited', 'active', 'revoked');
create type public.guardian_relation as enum ('mother', 'father', 'guardian', 'other');

-- Adult account (application-level profile linked with Supabase Auth)
create table if not exists public.adult_account (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  full_name text,
  email text,
  phone text,
  timezone text default 'Europe/Moscow',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists adult_account_email_unique
  on public.adult_account (lower(email))
  where email is not null;

create unique index if not exists adult_account_phone_unique
  on public.adult_account (phone)
  where phone is not null;

-- Organization for corporate tariff
create table if not exists public.organization (
  id uuid primary key default gen_random_uuid(),
  owner_adult_account_id uuid not null references public.adult_account(id) on delete restrict,
  name text not null,
  slug text unique not null,
  seat_limit integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Adult roles inside personal/org scopes
create table if not exists public.adult_role_membership (
  id uuid primary key default gen_random_uuid(),
  adult_account_id uuid not null references public.adult_account(id) on delete cascade,
  role role_code not null,
  scope_type scope_type not null,
  scope_organization_id uuid references public.organization(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (adult_account_id, role, scope_type, scope_organization_id)
);

alter table public.adult_role_membership
  add constraint adult_role_scope_valid check (
    (scope_type = 'personal' and scope_organization_id is null)
    or
    (scope_type = 'organization' and scope_organization_id is not null)
  );

-- Student profile and credentials
create table if not exists public.student_profile (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  birth_date date,
  status text not null default 'active',
  created_by_adult_id uuid not null references public.adult_account(id) on delete restrict,
  created_in_scope_type scope_type not null,
  created_in_scope_organization_id uuid references public.organization(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (created_in_scope_type = 'personal' and created_in_scope_organization_id is null)
    or
    (created_in_scope_type = 'organization' and created_in_scope_organization_id is not null)
  )
);

create table if not exists public.student_credentials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.student_profile(id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_guardian_link (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profile(id) on delete cascade,
  adult_account_id uuid not null references public.adult_account(id) on delete cascade,
  relation guardian_relation not null default 'other',
  status guardian_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (student_id, adult_account_id)
);

-- Generic update trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_adult_account_updated_at
before update on public.adult_account
for each row execute function public.set_updated_at();

create trigger trg_organization_updated_at
before update on public.organization
for each row execute function public.set_updated_at();

create trigger trg_student_profile_updated_at
before update on public.student_profile
for each row execute function public.set_updated_at();

create trigger trg_student_credentials_updated_at
before update on public.student_credentials
for each row execute function public.set_updated_at();

-- RLS
alter table public.adult_account enable row level security;
alter table public.organization enable row level security;
alter table public.adult_role_membership enable row level security;
alter table public.student_profile enable row level security;
alter table public.student_credentials enable row level security;
alter table public.student_guardian_link enable row level security;

-- Helper to resolve current adult account from auth.uid()
create or replace function public.current_adult_account_id()
returns uuid
language sql
stable
as $$
  select aa.id
  from public.adult_account aa
  where aa.auth_user_id = auth.uid()
  limit 1;
$$;

-- Adults can view/update themselves
create policy adult_self_select on public.adult_account
for select using (id = public.current_adult_account_id());

create policy adult_self_update on public.adult_account
for update using (id = public.current_adult_account_id())
with check (id = public.current_adult_account_id());

-- Role memberships: view own
create policy role_membership_self_select on public.adult_role_membership
for select using (adult_account_id = public.current_adult_account_id());

-- Student visibility: teacher in same scope OR linked guardian
create policy student_profile_select_policy on public.student_profile
for select using (
  exists (
    select 1
    from public.student_guardian_link sgl
    where sgl.student_id = student_profile.id
      and sgl.adult_account_id = public.current_adult_account_id()
      and sgl.status = 'active'
  )
  or exists (
    select 1
    from public.adult_role_membership arm
    where arm.adult_account_id = public.current_adult_account_id()
      and arm.role in ('teacher', 'org_teacher', 'org_owner')
      and (
        (student_profile.created_in_scope_type = 'personal' and arm.scope_type = 'personal')
        or
        (student_profile.created_in_scope_type = 'organization'
          and arm.scope_type = 'organization'
          and arm.scope_organization_id = student_profile.created_in_scope_organization_id)
      )
  )
);

-- Guardian links: adults can view links for their own account
create policy guardian_link_self_select on public.student_guardian_link
for select using (adult_account_id = public.current_adult_account_id());

-- Credentials are hidden from regular reads by default
revoke all on public.student_credentials from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, update on public.adult_account to authenticated;
grant select on public.organization to authenticated;
grant select on public.adult_role_membership to authenticated;
grant select on public.student_profile to authenticated;
grant select on public.student_guardian_link to authenticated;
