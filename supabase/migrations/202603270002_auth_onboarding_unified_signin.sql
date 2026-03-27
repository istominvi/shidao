begin;

-- Adult onboarding state: remember current active role.
-- Use a guarded DO block instead of ADD COLUMN IF NOT EXISTS for compatibility.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'adult'
      and column_name = 'current_role'
  ) then
    alter table public."adult"
      add column "current_role" text;
  end if;
end
$$;

alter table if exists public."adult"
  drop constraint if exists adult_current_role_check;

alter table if exists public."adult"
  add constraint adult_current_role_check
  check ("current_role" is null or "current_role" in ('parent', 'teacher'));

-- Student unified sign-in mapping.
-- login_identifier: what student types in the unified sign-in field.
-- auth_login_email: email stored in Supabase Auth and used for signInWithPassword.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student'
      and column_name = 'login_identifier'
  ) then
    alter table public.student
      add column login_identifier text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student'
      and column_name = 'auth_login_email'
  ) then
    alter table public.student
      add column auth_login_email text;
  end if;
end
$$;

create unique index if not exists student_login_identifier_unique
  on public.student (lower(login_identifier))
  where login_identifier is not null;

create unique index if not exists student_auth_login_email_unique
  on public.student (lower(auth_login_email))
  where auth_login_email is not null;

commit;
