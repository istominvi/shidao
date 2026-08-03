begin;

-- ShiDao V2 teacher course-builder vertical slice.
--
-- This migration intentionally coexists with the archived V1 application
-- tables. It adds the first V2-owned document model without resetting public,
-- changing Auth configuration, or exposing an external MCP endpoint.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Account bootstrap
-- -----------------------------------------------------------------------------

create table public.account (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  locale text not null default 'ru',
  timezone text not null default 'Europe/Moscow',
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.account (auth_user_id, display_name)
select
  users.id,
  coalesce(
    nullif(btrim((select teacher.full_name from public.teacher where teacher.user_id = users.id limit 1)), ''),
    nullif(btrim((select parent.full_name from public.parent where parent.user_id = users.id limit 1)), ''),
    nullif(btrim((
      select concat_ws(' ', student.first_name, student.last_name)
      from public.student
      where student.user_id = users.id
      limit 1
    )), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Пользователь'
  )
from auth.users as users
on conflict (auth_user_id) do nothing;

create or replace function public.handle_auth_user_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account (auth_user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Пользователь'
    )
  )
  on conflict (auth_user_id) do nothing;

  return new;
end
$$;

revoke all on function public.handle_auth_user_account()
from public, anon, authenticated;

drop trigger if exists trg_auth_user_create_account on auth.users;
create trigger trg_auth_user_create_account
after insert on auth.users
for each row execute function public.handle_auth_user_account();

-- -----------------------------------------------------------------------------
-- Course document model
-- -----------------------------------------------------------------------------

create table public.course (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.account(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  subject text null,
  goal text null,
  level text null,
  audience_description text null,
  target_lesson_count integer null check (target_lesson_count is null or target_lesson_count > 0),
  teacher_preferences text null,
  audience_type text not null default 'none' check (audience_type = 'none'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  assembled_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.course(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null check (btrim(title) <> ''),
  summary text null,
  estimated_duration_minutes integer null check (
    estimated_duration_minutes is null or estimated_duration_minutes > 0
  ),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_course_position_unique
    unique (course_id, position) deferrable initially deferred
);

create table public.lesson_step (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null check (btrim(title) <> ''),
  teacher_content jsonb not null default '{}'::jsonb check (
    jsonb_typeof(teacher_content) = 'object'
  ),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_step_lesson_position_unique
    unique (lesson_id, position) deferrable initially deferred
);

create table public.lesson_step_component (
  id uuid primary key default gen_random_uuid(),
  lesson_step_id uuid not null references public.lesson_step(id) on delete cascade,
  position integer not null check (position > 0),
  type_key text not null check (btrim(type_key) <> ''),
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  placement_config jsonb not null default '{}'::jsonb check (
    jsonb_typeof(placement_config) = 'object'
  ),
  visibility text not null default 'learner_visible' check (
    visibility in ('staff_only', 'learner_visible', 'guardian_visible')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_step_component_step_position_unique
    unique (lesson_step_id, position) deferrable initially deferred
);

-- type_key deliberately remains TEXT. The code-first component registry owns
-- the supported keys and validates payload + placement_config before writes.

-- -----------------------------------------------------------------------------
-- Private course attachments
-- -----------------------------------------------------------------------------

create table public.stored_file (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.account(id) on delete cascade,
  storage_bucket text not null default 'course-assets' check (storage_bucket = 'course-assets'),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (btrim(mime_type) <> ''),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  checksum_sha256 text null check (
    checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stored_file_owner_path_check check (
    split_part(storage_path, '/', 1) = owner_account_id::text
  ),
  constraint stored_file_ready_checksum_check check (
    status = 'pending' or checksum_sha256 is not null
  )
);

create table public.course_attachment (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.course(id) on delete cascade,
  stored_file_id uuid not null references public.stored_file(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, stored_file_id)
);

create index course_owner_updated_at_idx on public.course (owner_account_id, updated_at desc);
create index lesson_course_position_idx on public.lesson (course_id, position);
create index lesson_step_lesson_position_idx on public.lesson_step (lesson_id, position);
create index lesson_step_component_step_position_idx
  on public.lesson_step_component (lesson_step_id, position);
create index lesson_step_component_type_key_idx on public.lesson_step_component (type_key);
create index stored_file_owner_created_at_idx
  on public.stored_file (owner_account_id, created_at desc);
create index course_attachment_file_idx on public.course_attachment (stored_file_id);

drop trigger if exists trg_account_updated_at on public.account;
create trigger trg_account_updated_at
before update on public.account
for each row execute function public.set_updated_at();

drop trigger if exists trg_course_updated_at on public.course;
create trigger trg_course_updated_at
before update on public.course
for each row execute function public.set_updated_at();

drop trigger if exists trg_lesson_updated_at on public.lesson;
create trigger trg_lesson_updated_at
before update on public.lesson
for each row execute function public.set_updated_at();

drop trigger if exists trg_lesson_step_updated_at on public.lesson_step;
create trigger trg_lesson_step_updated_at
before update on public.lesson_step
for each row execute function public.set_updated_at();

drop trigger if exists trg_lesson_step_component_updated_at on public.lesson_step_component;
create trigger trg_lesson_step_component_updated_at
before update on public.lesson_step_component
for each row execute function public.set_updated_at();

drop trigger if exists trg_stored_file_updated_at on public.stored_file;
create trigger trg_stored_file_updated_at
before update on public.stored_file
for each row execute function public.set_updated_at();

drop trigger if exists trg_course_attachment_updated_at on public.course_attachment;
create trigger trg_course_attachment_updated_at
before update on public.course_attachment
for each row execute function public.set_updated_at();

-- Keep every ordered document list dense after deletes. Deferrable uniqueness
-- allows the sibling shift to happen inside the same DELETE transaction.
create or replace function public.compact_course_lesson_positions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.lesson
  set position = position - 1
  where course_id = old.course_id
    and position > old.position;
  return old;
end
$$;

create or replace function public.compact_lesson_step_positions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.lesson_step
  set position = position - 1
  where lesson_id = old.lesson_id
    and position > old.position;
  return old;
end
$$;

create or replace function public.compact_step_component_positions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.lesson_step_component
  set position = position - 1
  where lesson_step_id = old.lesson_step_id
    and position > old.position;
  return old;
end
$$;

revoke all on function public.compact_course_lesson_positions()
from public, anon, authenticated;
revoke all on function public.compact_lesson_step_positions()
from public, anon, authenticated;
revoke all on function public.compact_step_component_positions()
from public, anon, authenticated;

drop trigger if exists trg_lesson_compact_positions on public.lesson;
create trigger trg_lesson_compact_positions
after delete on public.lesson
for each row execute function public.compact_course_lesson_positions();

drop trigger if exists trg_lesson_step_compact_positions on public.lesson_step;
create trigger trg_lesson_step_compact_positions
after delete on public.lesson_step
for each row execute function public.compact_lesson_step_positions();

drop trigger if exists trg_component_compact_positions on public.lesson_step_component;
create trigger trg_component_compact_positions
after delete on public.lesson_step_component
for each row execute function public.compact_step_component_positions();

-- -----------------------------------------------------------------------------
-- Tenant resolution + row-level security
-- -----------------------------------------------------------------------------

alter table public.account enable row level security;
alter table public.course enable row level security;
alter table public.lesson enable row level security;
alter table public.lesson_step enable row level security;
alter table public.lesson_step_component enable row level security;
alter table public.stored_file enable row level security;
alter table public.course_attachment enable row level security;

create policy account_self_select on public.account
for select to authenticated
using (auth_user_id = (select auth.uid()));

create or replace function public.current_account_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select account.id
  from public.account
  where account.auth_user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.current_account_id() from public, anon;
grant execute on function public.current_account_id() to authenticated;

-- Course Builder keeps the existing app-session revocation cutoff without
-- falling back to the legacy service-role access-policy reader. The caller can
-- only observe the cutoff bound to its own auth.uid().
create or replace function public.current_session_invalid_before()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select security.sessions_invalid_before
  from public.user_security as security
  where security.user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.current_session_invalid_before()
from public, anon;
grant execute on function public.current_session_invalid_before()
to authenticated;

create policy course_owner_all on public.course
for all to authenticated
using (owner_account_id = (select public.current_account_id()))
with check (owner_account_id = (select public.current_account_id()));

create policy lesson_course_owner_all on public.lesson
for all to authenticated
using (
  exists (
    select 1
    from public.course
    where course.id = lesson.course_id
      and course.owner_account_id = (select public.current_account_id())
  )
)
with check (
  exists (
    select 1
    from public.course
    where course.id = lesson.course_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

create policy lesson_step_course_owner_all on public.lesson_step
for all to authenticated
using (
  exists (
    select 1
    from public.lesson
    join public.course on course.id = lesson.course_id
    where lesson.id = lesson_step.lesson_id
      and course.owner_account_id = (select public.current_account_id())
  )
)
with check (
  exists (
    select 1
    from public.lesson
    join public.course on course.id = lesson.course_id
    where lesson.id = lesson_step.lesson_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

create policy lesson_step_component_course_owner_all on public.lesson_step_component
for all to authenticated
using (
  exists (
    select 1
    from public.lesson_step
    join public.lesson on lesson.id = lesson_step.lesson_id
    join public.course on course.id = lesson.course_id
    where lesson_step.id = lesson_step_component.lesson_step_id
      and course.owner_account_id = (select public.current_account_id())
  )
)
with check (
  exists (
    select 1
    from public.lesson_step
    join public.lesson on lesson.id = lesson_step.lesson_id
    join public.course on course.id = lesson.course_id
    where lesson_step.id = lesson_step_component.lesson_step_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

create policy stored_file_owner_all on public.stored_file
for all to authenticated
using (owner_account_id = (select public.current_account_id()))
with check (owner_account_id = (select public.current_account_id()));

create policy course_attachment_owner_all on public.course_attachment
for all to authenticated
using (
  exists (
    select 1
    from public.course
    where course.id = course_attachment.course_id
      and course.owner_account_id = (select public.current_account_id())
  )
  and exists (
    select 1
    from public.stored_file
    where stored_file.id = course_attachment.stored_file_id
      and stored_file.owner_account_id = (select public.current_account_id())
  )
)
with check (
  exists (
    select 1
    from public.course
    where course.id = course_attachment.course_id
      and course.owner_account_id = (select public.current_account_id())
  )
  and exists (
    select 1
    from public.stored_file
    where stored_file.id = course_attachment.stored_file_id
      and stored_file.owner_account_id = (select public.current_account_id())
  )
);

revoke all on table
  public.account,
  public.course,
  public.lesson,
  public.lesson_step,
  public.lesson_step_component,
  public.stored_file,
  public.course_attachment
from anon, authenticated;

grant select on table public.account to authenticated;

grant select, insert, update, delete on table
  public.course,
  public.lesson,
  public.lesson_step,
  public.lesson_step_component,
  public.stored_file,
  public.course_attachment
to authenticated;

-- -----------------------------------------------------------------------------
-- Atomic deterministic draft assembly. The application service validates the
-- code-first registry plan before it reaches this persistence boundary. The
-- function only makes the already-validated Lesson/Step/components durable in
-- one transaction, with caller RLS still active.
-- -----------------------------------------------------------------------------

create or replace function public.assemble_course_draft(
  p_course_id uuid,
  p_lesson_title text,
  p_lesson_summary text,
  p_step_title text,
  p_teacher_instructions text,
  p_learner_instruction text,
  p_components jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assembled_at timestamptz;
  v_lesson_id uuid;
  v_step_id uuid;
  v_component_id uuid;
  v_component jsonb;
  v_position integer := 0;
  v_lesson_ids uuid[] := '{}'::uuid[];
  v_step_ids uuid[] := '{}'::uuid[];
  v_component_ids uuid[] := '{}'::uuid[];
begin
  if p_components is null or jsonb_typeof(p_components) <> 'array' then
    raise exception 'course_components_must_be_array' using errcode = '22023';
  end if;

  select course.assembled_at
  into v_assembled_at
  from public.course
  where course.id = p_course_id
  for update;

  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  if v_assembled_at is not null then
    select coalesce(array_agg(lesson.id order by lesson.position), '{}'::uuid[])
    into v_lesson_ids
    from public.lesson
    where lesson.course_id = p_course_id;

    select coalesce(array_agg(step.id order by lesson.position, step.position), '{}'::uuid[])
    into v_step_ids
    from public.lesson_step as step
    join public.lesson on lesson.id = step.lesson_id
    where lesson.course_id = p_course_id;

    select coalesce(
      array_agg(component.id order by lesson.position, step.position, component.position),
      '{}'::uuid[]
    )
    into v_component_ids
    from public.lesson_step_component as component
    join public.lesson_step as step on step.id = component.lesson_step_id
    join public.lesson on lesson.id = step.lesson_id
    where lesson.course_id = p_course_id;

    return jsonb_build_object(
      'courseId', p_course_id,
      'lessonIds', to_jsonb(v_lesson_ids),
      'stepIds', to_jsonb(v_step_ids),
      'componentIds', to_jsonb(v_component_ids),
      'alreadyAssembled', true
    );
  end if;

  if exists (
    select 1 from public.lesson where lesson.course_id = p_course_id
  ) then
    raise exception 'course_contains_manual_content' using errcode = '23505';
  end if;

  insert into public.lesson (course_id, position, title, summary)
  values (p_course_id, 1, p_lesson_title, p_lesson_summary)
  returning id into v_lesson_id;

  insert into public.lesson_step (
    lesson_id,
    position,
    title,
    teacher_content,
    settings
  )
  values (
    v_lesson_id,
    1,
    p_step_title,
    jsonb_build_object(
      'teacherInstructions', coalesce(p_teacher_instructions, '')
    ),
    jsonb_build_object(
      'learnerInstruction', coalesce(p_learner_instruction, '')
    )
  )
  returning id into v_step_id;

  for v_component in
    select component.value
    from jsonb_array_elements(p_components) as component(value)
  loop
    v_position := v_position + 1;
    insert into public.lesson_step_component (
      lesson_step_id,
      position,
      type_key,
      schema_version,
      payload,
      placement_config,
      visibility
    )
    values (
      v_step_id,
      v_position,
      v_component ->> 'typeKey',
      (v_component ->> 'schemaVersion')::integer,
      v_component -> 'payload',
      v_component -> 'placement',
      'learner_visible'
    )
    returning id into v_component_id;
    v_component_ids := array_append(v_component_ids, v_component_id);
  end loop;

  update public.course
  set assembled_at = now()
  where id = p_course_id;

  return jsonb_build_object(
    'courseId', p_course_id,
    'lessonIds', jsonb_build_array(v_lesson_id),
    'stepIds', jsonb_build_array(v_step_id),
    'componentIds', to_jsonb(v_component_ids),
    'alreadyAssembled', false
  );
end
$$;

revoke all on function public.assemble_course_draft(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon;
grant execute on function public.assemble_course_draft(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

-- -----------------------------------------------------------------------------
-- Atomic component reorder. SECURITY INVOKER keeps the table RLS policies in
-- force, so a caller cannot discover or reorder another account's component.
-- -----------------------------------------------------------------------------

create or replace function public.reorder_lesson_step_component(
  p_component_id uuid,
  p_new_position integer
)
returns table (component_id uuid, "position" integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lesson_step_id uuid;
  v_old_position integer;
  v_component_count integer;
begin
  if p_new_position is null or p_new_position < 1 then
    raise exception 'component_position_out_of_range' using errcode = '22023';
  end if;

  select component.lesson_step_id, component.position
  into v_lesson_step_id, v_old_position
  from public.lesson_step_component as component
  where component.id = p_component_id
  for update;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  -- Serialize reorders inside one step before shifting the deferrable sequence.
  perform 1
  from public.lesson_step_component as component
  where component.lesson_step_id = v_lesson_step_id
  for update;

  select count(*)::integer
  into v_component_count
  from public.lesson_step_component as component
  where component.lesson_step_id = v_lesson_step_id;

  if p_new_position > v_component_count then
    raise exception 'component_position_out_of_range' using errcode = '22023';
  end if;

  if p_new_position < v_old_position then
    update public.lesson_step_component as component
    set position = component.position + 1
    where component.lesson_step_id = v_lesson_step_id
      and component.position >= p_new_position
      and component.position < v_old_position;
  elsif p_new_position > v_old_position then
    update public.lesson_step_component as component
    set position = component.position - 1
    where component.lesson_step_id = v_lesson_step_id
      and component.position > v_old_position
      and component.position <= p_new_position;
  end if;

  update public.lesson_step_component
  set position = p_new_position
  where id = p_component_id;

  return query
  select component.id, component.position
  from public.lesson_step_component as component
  where component.lesson_step_id = v_lesson_step_id
  order by component.position;
end
$$;

revoke all on function public.reorder_lesson_step_component(uuid, integer)
from public, anon;
grant execute on function public.reorder_lesson_step_component(uuid, integer)
to authenticated;

-- -----------------------------------------------------------------------------
-- Private Storage bucket. Object names must start with the owning Account UUID:
--   <account-id>/<opaque-object-id>
-- -----------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'course-assets',
  'course-assets',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown'
  ]::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists course_assets_owner_select on storage.objects;
create policy course_assets_owner_select on storage.objects
for select to authenticated
using (
  bucket_id = 'course-assets'
  and (storage.foldername(name))[1] = (select public.current_account_id())::text
);

drop policy if exists course_assets_owner_insert on storage.objects;
create policy course_assets_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'course-assets'
  and (storage.foldername(name))[1] = (select public.current_account_id())::text
);

drop policy if exists course_assets_owner_update on storage.objects;
create policy course_assets_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'course-assets'
  and (storage.foldername(name))[1] = (select public.current_account_id())::text
)
with check (
  bucket_id = 'course-assets'
  and (storage.foldername(name))[1] = (select public.current_account_id())::text
);

drop policy if exists course_assets_owner_delete on storage.objects;
create policy course_assets_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'course-assets'
  and (storage.foldername(name))[1] = (select public.current_account_id())::text
);

commit;
