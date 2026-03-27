begin;

-- Adult onboarding state: remember current active role.
alter table if exists public.adult
  add column if not exists current_role public.role_code;

alter table if exists public.adult
  drop constraint if exists adult_current_role_check;

alter table if exists public.adult
  add constraint adult_current_role_check
  check (current_role is null or current_role in ('parent', 'teacher'));

-- Student unified sign-in mapping.
-- login_identifier: what student types in the unified sign-in field.
-- auth_login_email: email stored in Supabase Auth and used for signInWithPassword.
alter table if exists public.student
  add column if not exists login_identifier text,
  add column if not exists auth_login_email text;

create unique index if not exists student_login_identifier_unique
  on public.student (lower(login_identifier))
  where login_identifier is not null;

create unique index if not exists student_auth_login_email_unique
  on public.student (lower(auth_login_email))
  where auth_login_email is not null;

commit;
