begin;

create or replace function public.enforce_class_methodology_invariants()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.methodology_id is null then
      raise exception 'class.methodology_id is required when creating a group';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.methodology_id is distinct from old.methodology_id then
    raise exception 'class.methodology_id is immutable after group creation';
  end if;

  return new;
end
$$;

drop trigger if exists class_methodology_invariants_tg on public.class;
create trigger class_methodology_invariants_tg
before insert or update of methodology_id on public.class
for each row
execute function public.enforce_class_methodology_invariants();

commit;
