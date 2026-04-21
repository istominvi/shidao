begin;

alter table if exists public.school
  add column if not exists kind text not null default 'personal',
  add column if not exists owner_teacher_id uuid null references public.teacher(id) on delete set null,
  add column if not exists teacher_limit integer not null default 1,
  add column if not exists plan_code text not null default 'demo',
  add column if not exists subscription_status text not null default 'active';

alter table if exists public.school
  drop constraint if exists school_kind_check;
alter table if exists public.school
  add constraint school_kind_check check (kind in ('personal', 'organization'));

alter table if exists public.school
  drop constraint if exists school_teacher_limit_positive_check;
alter table if exists public.school
  add constraint school_teacher_limit_positive_check check (teacher_limit > 0);

update public.school s
set owner_teacher_id = st.teacher_id
from (
  select distinct on (school_id) school_id, teacher_id
  from public.school_teacher
  where role = 'owner'
  order by school_id, created_at asc
) st
where s.id = st.school_id
  and s.owner_teacher_id is null;

with membership_count as (
  select school_id, count(*)::integer as member_count,
    bool_or(role = 'teacher') as has_non_owner
  from public.school_teacher
  group by school_id
)
update public.school s
set
  kind = case
    when mc.member_count > 1 or mc.has_non_owner then 'organization'
    else 'personal'
  end,
  teacher_limit = case
    when mc.member_count > 1 or mc.has_non_owner then greatest(coalesce(s.teacher_limit, 1), 5)
    else 1
  end
from membership_count mc
where s.id = mc.school_id;

update public.school
set kind = 'personal', teacher_limit = greatest(coalesce(teacher_limit, 1), 1)
where kind not in ('personal', 'organization');

commit;
