-- Per-user app-session revocation.
--
-- The app authenticates via a stateless, encrypted `shidao_session` cookie that
-- carries an issued-at (`iat`) timestamp. This migration adds a per-user cutoff:
-- any session whose `iat` is older than `sessions_invalid_before` is treated as
-- revoked on the next request. This enables "log out everywhere" and forced
-- revocation on password reset / account compromise, complementing the existing
-- global APP_SESSION_VERSION kill-switch.

alter table public.user_security
  add column if not exists sessions_invalid_before timestamptz;

comment on column public.user_security.sessions_invalid_before is
  'App sessions whose issued-at (iat) precedes this instant are treated as revoked. Null = no revocation.';

-- Bumps the per-user revocation cutoff. Never moves the cutoff backward.
-- Returns the effective cutoff. Callable only with elevated (service-role) access
-- via SECURITY DEFINER, matching the other user_security RPCs.
create or replace function public.revoke_user_sessions(
  p_user_id uuid,
  p_cutoff timestamptz default now()
) returns timestamptz
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_cutoff timestamptz;
begin
  perform public.ensure_user_security(p_user_id);

  update public.user_security
  set sessions_invalid_before =
        greatest(coalesce(sessions_invalid_before, p_cutoff), p_cutoff),
      updated_at = now()
  where user_id = p_user_id
  returning sessions_invalid_before into v_cutoff;

  return v_cutoff;
end
$function$;
