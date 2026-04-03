begin;

create extension if not exists pgcrypto;

create table if not exists public.user_preference (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_active_profile text null check (last_active_profile in ('parent', 'teacher')),
  last_selected_school_id uuid null references public.school(id) on delete set null,
  theme text null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_preference is 'Persistent user UI preferences and routing hints.';
comment on column public.user_preference.last_active_profile is 'Last active adult cabinet profile.';
comment on column public.user_preference.last_selected_school_id is 'Last selected school for future multi-school UX.';

create table if not exists public.user_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text null,
  pin_failed_attempts integer not null default 0,
  pin_locked_until timestamptz null,
  pin_created_at timestamptz null,
  pin_updated_at timestamptz null,
  last_pin_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_security is 'Security settings: hashed PIN and lock state.';

create index if not exists user_preference_last_active_profile_idx on public.user_preference(last_active_profile) where last_active_profile is not null;
create index if not exists user_preference_last_selected_school_idx on public.user_preference(last_selected_school_id) where last_selected_school_id is not null;
create index if not exists user_security_pin_locked_until_idx on public.user_security(pin_locked_until) where pin_locked_until is not null;

create trigger trg_user_preference_updated_at
before update on public.user_preference
for each row execute function public.set_updated_at();

create trigger trg_user_security_updated_at
before update on public.user_security
for each row execute function public.set_updated_at();

create or replace function public.ensure_user_preference(p_user_id uuid)
returns public.user_preference
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_preference;
begin
  insert into public.user_preference (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.user_preference up where up.user_id = p_user_id;
  return v_row;
end
$$;

create or replace function public.set_last_active_profile(p_user_id uuid, p_profile text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_preference(p_user_id);

  update public.user_preference
  set last_active_profile = p_profile,
      updated_at = now()
  where user_id = p_user_id;
end
$$;

create or replace function public.get_last_active_profile(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select up.last_active_profile
  from public.user_preference up
  where up.user_id = p_user_id;
$$;

create or replace function public.set_last_selected_school(p_user_id uuid, p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_preference(p_user_id);

  update public.user_preference
  set last_selected_school_id = p_school_id,
      updated_at = now()
  where user_id = p_user_id;
end
$$;

create or replace function public.upsert_user_theme(p_user_id uuid, p_theme text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_preference(p_user_id);

  update public.user_preference
  set theme = p_theme,
      updated_at = now()
  where user_id = p_user_id;
end
$$;

create or replace function public.merge_user_settings(p_user_id uuid, p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_preference(p_user_id);

  update public.user_preference
  set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_settings, '{}'::jsonb),
      updated_at = now()
  where user_id = p_user_id;
end
$$;

create or replace function public.ensure_user_security(p_user_id uuid)
returns public.user_security
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_security;
begin
  insert into public.user_security (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.user_security us where us.user_id = p_user_id;
  return v_row;
end
$$;

create or replace function public.set_user_pin(p_user_id uuid, p_raw_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_security(p_user_id);

  update public.user_security
  set pin_hash = crypt(p_raw_pin, gen_salt('bf')),
      pin_failed_attempts = 0,
      pin_locked_until = null,
      pin_created_at = coalesce(pin_created_at, now()),
      pin_updated_at = now(),
      updated_at = now()
  where user_id = p_user_id;
end
$$;

create or replace function public.reset_pin_attempts(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_security(p_user_id);

  update public.user_security
  set pin_failed_attempts = 0,
      pin_locked_until = null,
      updated_at = now()
  where user_id = p_user_id;
end
$$;

create or replace function public.clear_user_pin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_security(p_user_id);

  update public.user_security
  set pin_hash = null,
      pin_failed_attempts = 0,
      pin_locked_until = null,
      pin_updated_at = now(),
      updated_at = now()
  where user_id = p_user_id;
end
$$;

create or replace function public.verify_user_pin(p_user_id uuid, p_raw_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sec public.user_security;
  v_ok boolean := false;
  v_max_attempts constant integer := 5;
  v_lock_minutes constant integer := 15;
begin
  select * into v_sec from public.ensure_user_security(p_user_id);

  if v_sec.pin_hash is null then
    return false;
  end if;

  if v_sec.pin_locked_until is not null and v_sec.pin_locked_until > now() then
    return false;
  end if;

  v_ok := crypt(p_raw_pin, v_sec.pin_hash) = v_sec.pin_hash;

  if v_ok then
    update public.user_security
    set pin_failed_attempts = 0,
        pin_locked_until = null,
        last_pin_login_at = now(),
        updated_at = now()
    where user_id = p_user_id;
    return true;
  end if;

  update public.user_security
  set pin_failed_attempts = pin_failed_attempts + 1,
      pin_locked_until = case
        when pin_failed_attempts + 1 >= v_max_attempts then now() + make_interval(mins => v_lock_minutes)
        else null
      end,
      updated_at = now()
  where user_id = p_user_id;

  return false;
end
$$;

grant select, update on public.user_preference to authenticated;
grant select, update on public.user_security to authenticated;
grant execute on function public.ensure_user_preference(uuid) to authenticated;
grant execute on function public.set_last_active_profile(uuid, text) to authenticated;
grant execute on function public.get_last_active_profile(uuid) to authenticated;
grant execute on function public.set_last_selected_school(uuid, uuid) to authenticated;
grant execute on function public.upsert_user_theme(uuid, text) to authenticated;
grant execute on function public.merge_user_settings(uuid, jsonb) to authenticated;
grant execute on function public.ensure_user_security(uuid) to authenticated;
grant execute on function public.set_user_pin(uuid, text) to authenticated;
grant execute on function public.verify_user_pin(uuid, text) to authenticated;
grant execute on function public.clear_user_pin(uuid) to authenticated;
grant execute on function public.reset_pin_attempts(uuid) to authenticated;

commit;
