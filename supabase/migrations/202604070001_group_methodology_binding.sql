begin;

alter table public.class
  add column if not exists methodology_id uuid null references public.methodology(id) on delete set null;

create index if not exists class_methodology_id_idx on public.class (methodology_id);

-- Safe backfill: if all scheduled lessons of a class point to one methodology,
-- bind class.methodology_id to it. Ambiguous classes stay null intentionally.
with class_methodology_candidates as (
  select
    sl.class_id,
    min(ml.methodology_id) as methodology_id,
    count(distinct ml.methodology_id) as methodology_count
  from public.scheduled_lesson sl
  join public.methodology_lesson ml on ml.id = sl.methodology_lesson_id
  group by sl.class_id
)
update public.class c
set methodology_id = candidates.methodology_id
from class_methodology_candidates candidates
where c.id = candidates.class_id
  and c.methodology_id is null
  and candidates.methodology_count = 1;

commit;
