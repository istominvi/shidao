begin;

-- -----------------------------------------------------------------------------
-- Guard the exact ShiDao Course/Lesson/Component/Slide baseline this forward
-- migration extends. Publication is a second immutable representation of the
-- same user-visible Course, never a return of Lesson Step or Methodology.
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_component') is null
    or to_regclass('public.lesson_student_slide') is null
    or to_regclass('public.stored_file') is null
    or to_regclass('public.course_attachment') is null
  then
    raise exception
      'shidao_schema_sanity_failed: canonical Course publication dependencies are missing';
  end if;

  if to_regclass('public.lesson_step') is not null
    or to_regclass('public.lesson_step_component') is not null
  then
    raise exception
      'shidao_schema_sanity_failed: Lesson Step storage must stay absent';
  end if;
end
$$;

alter table public.course
  add column publication_content_updated_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- Stable listing + immutable revision/asset snapshot. These are deliberately
-- service-only tables. Browser users consume DTOs through authenticated app
-- routes; no direct Data API policy or grant is introduced.
-- -----------------------------------------------------------------------------

create table public.course_publication (
  id uuid primary key,
  source_course_id uuid null
    references public.course(id) on delete set null,
  owner_account_id uuid not null
    references public.account(id) on delete cascade,
  publisher_display_name text not null check (
    btrim(publisher_display_name) <> ''
    and char_length(publisher_display_name) <= 160
  ),
  is_shidao boolean not null default false,
  title text not null check (
    btrim(title) <> '' and char_length(title) <= 160
  ),
  subject text not null check (char_length(subject) <= 160),
  goal text not null check (char_length(goal) <= 1200),
  level text not null check (char_length(level) <= 240),
  audience_description text not null check (
    char_length(audience_description) <= 1200
  ),
  target_lesson_count integer not null check (target_lesson_count > 0),
  lesson_count integer not null check (lesson_count > 0),
  material_count integer not null check (
    material_count >= 0 and material_count <= 24
  ),
  status text not null check (status in ('published', 'unpublished')),
  current_revision_id uuid not null,
  source_content_updated_at timestamptz not null,
  published_at timestamptz not null default now(),
  unpublished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_publication_status_shape_check check (
    (status = 'published' and unpublished_at is null)
    or (status = 'unpublished' and unpublished_at is not null)
  )
);

create table public.course_publication_revision (
  id uuid primary key,
  publication_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  source_course_updated_at timestamptz not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object'
    and snapshot ->> 'schemaVersion' = '1'
    and jsonb_typeof(snapshot -> 'course') = 'object'
    and jsonb_typeof(snapshot -> 'lessons') = 'array'
    and jsonb_typeof(snapshot -> 'materials') = 'array'
    and octet_length(snapshot::text) <= 16777216
  ),
  rights_confirmed_at timestamptz not null,
  license_code text not null default 'shidao_catalog_reuse_v1' check (
    license_code = 'shidao_catalog_reuse_v1'
  ),
  published_at timestamptz not null default now(),
  constraint course_publication_revision_publication_fkey
    foreign key (publication_id)
    references public.course_publication(id)
    on delete cascade
    deferrable initially deferred,
  constraint course_publication_revision_number_unique
    unique (publication_id, revision_number),
  constraint course_publication_revision_publication_id_unique
    unique (publication_id, id)
);

alter table public.course_publication
  add constraint course_publication_current_revision_fkey
  foreign key (id, current_revision_id)
  references public.course_publication_revision(publication_id, id)
  deferrable initially deferred;

create table public.course_publication_asset (
  id uuid not null,
  revision_id uuid not null
    references public.course_publication_revision(id) on delete cascade,
  source_stored_file_id uuid null
    references public.stored_file(id) on delete set null,
  storage_bucket text not null default 'course-publication-assets' check (
    storage_bucket = 'course-publication-assets'
  ),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (btrim(mime_type) <> ''),
  size_bytes bigint not null check (
    size_bytes > 0 and size_bytes <= 10485760
  ),
  checksum_sha256 text not null check (
    checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz not null default now(),
  constraint course_publication_asset_pkey
    primary key (revision_id, id),
  constraint course_publication_asset_revision_source_unique
    unique (revision_id, source_stored_file_id)
);

create table public.course_publication_origin (
  course_id uuid primary key
    references public.course(id) on delete cascade,
  publication_id uuid not null,
  revision_id uuid not null,
  created_at timestamptz not null default now(),
  constraint course_publication_origin_publication_fkey
    foreign key (publication_id)
    references public.course_publication(id)
    on delete cascade,
  constraint course_publication_origin_revision_fkey
    foreign key (publication_id, revision_id)
    references public.course_publication_revision(publication_id, id)
    on delete cascade
);

create index course_publication_owner_updated_at_idx
  on public.course_publication (owner_account_id, updated_at desc, id);

create unique index course_publication_source_course_unique
  on public.course_publication (source_course_id)
  where source_course_id is not null;

create index course_publication_catalog_idx
  on public.course_publication (
    is_shidao desc,
    published_at desc,
    id desc
  )
  where status = 'published';

create index course_publication_catalog_subject_idx
  on public.course_publication (
    lower(btrim(subject)),
    is_shidao desc,
    published_at desc,
    id desc
  )
  where status = 'published';

create index course_publication_catalog_level_idx
  on public.course_publication (
    lower(btrim(level)),
    is_shidao desc,
    published_at desc,
    id desc
  )
  where status = 'published';

create index course_publication_revision_published_at_idx
  on public.course_publication_revision (
    publication_id,
    published_at desc,
    id
  );

create index course_publication_asset_source_file_idx
  on public.course_publication_asset (source_stored_file_id)
  where source_stored_file_id is not null;

create index course_publication_origin_revision_idx
  on public.course_publication_origin (revision_id, course_id);

alter table public.course_publication enable row level security;
alter table public.course_publication_revision enable row level security;
alter table public.course_publication_asset enable row level security;
alter table public.course_publication_origin enable row level security;

revoke all on table public.course_publication
from public, anon, authenticated;
revoke all on table public.course_publication_revision
from public, anon, authenticated;
revoke all on table public.course_publication_asset
from public, anon, authenticated;
revoke all on table public.course_publication_origin
from public, anon, authenticated;

grant all on table public.course_publication to postgres, service_role;
grant all on table public.course_publication_revision to postgres, service_role;
grant all on table public.course_publication_asset to postgres, service_role;
grant all on table public.course_publication_origin to postgres, service_role;

-- Account suspension/deactivation is an atomic publication lifecycle boundary.
-- Returning an Account to active never republishes catalog content implicitly.
create function public.unpublish_course_publications_for_inactive_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status <> 'active' then
    update public.course_publication as publication
    set status = 'unpublished',
        unpublished_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where publication.owner_account_id = new.id
      and publication.status = 'published';
  end if;

  return new;
end
$$;

revoke all on function
public.unpublish_course_publications_for_inactive_account()
from public, anon, authenticated, service_role;
grant execute on function
public.unpublish_course_publications_for_inactive_account()
to postgres;

create trigger trg_account_unpublish_course_publications
after update of status on public.account
for each row
when (old.status = 'active' and new.status <> 'active')
execute function public.unpublish_course_publications_for_inactive_account();

create function public.reject_course_publication_immutable_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'course_publication_asset'
    and (to_jsonb(old) -> 'source_stored_file_id') <> 'null'::jsonb
    and (to_jsonb(new) -> 'source_stored_file_id') = 'null'::jsonb
    and (to_jsonb(new) - 'source_stored_file_id')
      = (to_jsonb(old) - 'source_stored_file_id')
  then
    -- ON DELETE SET NULL preserves an immutable publication blob while
    -- recording that its live-source provenance row has been removed.
    return new;
  end if;

  raise exception 'course_publication_immutable_row'
    using errcode = '55000';
end
$$;

revoke all on function public.reject_course_publication_immutable_update()
from public, anon, authenticated, service_role;
grant execute on function public.reject_course_publication_immutable_update()
to postgres;

create trigger trg_course_publication_revision_immutable
before update on public.course_publication_revision
for each row execute function public.reject_course_publication_immutable_update();

create trigger trg_course_publication_asset_immutable
before update on public.course_publication_asset
for each row execute function public.reject_course_publication_immutable_update();

create trigger trg_course_publication_origin_immutable
before update on public.course_publication_origin
for each row execute function public.reject_course_publication_immutable_update();

create function public.enforce_course_publication_revision_asset_limits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset_count integer;
  v_total_bytes bigint;
begin
  select count(*)::integer, coalesce(sum(asset.size_bytes), 0)
  into v_asset_count, v_total_bytes
  from public.course_publication_asset as asset
  where asset.revision_id = new.revision_id;

  if v_asset_count > 24 or v_total_bytes > 125829120 then
    raise exception 'course_publication_revision_asset_limit_exceeded'
      using errcode = '54000';
  end if;

  return new;
end
$$;

revoke all on function public.enforce_course_publication_revision_asset_limits()
from public, anon, authenticated, service_role;
grant execute on function public.enforce_course_publication_revision_asset_limits()
to postgres;

create trigger trg_course_publication_asset_limits
after insert on public.course_publication_asset
for each row execute function public.enforce_course_publication_revision_asset_limits();

-- Five binary GiB per Account across every immutable revision. Both supported
-- publish calls and any privileged direct insert serialize on the Account row.
create function public.enforce_course_publication_account_storage_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_account_id uuid;
  v_existing_snapshot_bytes bigint;
  v_existing_asset_bytes bigint;
  v_candidate_bytes bigint;
begin
  if tg_table_name = 'course_publication_revision' then
    select publication.owner_account_id
    into v_owner_account_id
    from public.course_publication as publication
    where publication.id = new.publication_id;

    v_candidate_bytes := octet_length(new.snapshot::text)::bigint;
  elsif tg_table_name = 'course_publication_asset' then
    select publication.owner_account_id
    into v_owner_account_id
    from public.course_publication_revision as revision
    join public.course_publication as publication
      on publication.id = revision.publication_id
    where revision.id = new.revision_id;

    v_candidate_bytes := new.size_bytes;
  else
    raise exception 'course_publication_quota_table_not_supported'
      using errcode = '55000';
  end if;

  if v_owner_account_id is null or v_candidate_bytes is null then
    raise exception 'course_publication_quota_owner_not_found'
      using errcode = '23503';
  end if;

  perform 1
  from public.account as account
  where account.id = v_owner_account_id
  for update;

  if not found then
    raise exception 'course_publication_quota_owner_not_found'
      using errcode = '23503';
  end if;

  select coalesce(
    sum(octet_length(revision.snapshot::text)::bigint),
    0
  )
  into v_existing_snapshot_bytes
  from public.course_publication_revision as revision
  join public.course_publication as publication
    on publication.id = revision.publication_id
  where publication.owner_account_id = v_owner_account_id;

  select coalesce(sum(asset.size_bytes), 0)
  into v_existing_asset_bytes
  from public.course_publication_asset as asset
  join public.course_publication_revision as revision
    on revision.id = asset.revision_id
  join public.course_publication as publication
    on publication.id = revision.publication_id
  where publication.owner_account_id = v_owner_account_id;

  if v_existing_snapshot_bytes
      + v_existing_asset_bytes
      + v_candidate_bytes > 5368709120
  then
    raise exception 'course_publication_account_quota_exceeded'
      using errcode = 'P0001';
  end if;

  return new;
end
$$;

revoke all on function
public.enforce_course_publication_account_storage_quota()
from public, anon, authenticated, service_role;
grant execute on function
public.enforce_course_publication_account_storage_quota()
to postgres;

create trigger trg_course_publication_revision_account_storage_quota
before insert on public.course_publication_revision
for each row execute function
public.enforce_course_publication_account_storage_quota();

create trigger trg_course_publication_asset_account_storage_quota
before insert on public.course_publication_asset
for each row execute function
public.enforce_course_publication_account_storage_quota();

-- -----------------------------------------------------------------------------
-- Private publication object storage. There are intentionally no user policies:
-- a server-side adapter copies bytes, then the closed admin RPC verifies and
-- records the immutable manifest.
-- -----------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'course-publication-assets',
  'course-publication-assets',
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

-- No storage.objects policy is created for course-publication-assets.

-- -----------------------------------------------------------------------------
-- Course authoring descendants participate in the source Course revision.
-- Child/material mutation moves publication_content_updated_at independently
-- from generic Course activity. Publication acknowledgement is stored on the
-- mutable listing; immutable revisions retain their own audit timestamp.
-- -----------------------------------------------------------------------------

create function public.set_course_publication_content_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.publication_content_updated_at := clock_timestamp();
    return new;
  end if;

  if pg_trigger_depth() > 1 then
    return new;
  end if;

  new.publication_content_updated_at := old.publication_content_updated_at;

  if new.title is distinct from old.title
    or new.subject is distinct from old.subject
    or new.goal is distinct from old.goal
    or new.level is distinct from old.level
    or new.audience_description is distinct from old.audience_description
    or new.target_lesson_count is distinct from old.target_lesson_count
  then
    new.publication_content_updated_at := clock_timestamp();
  end if;

  return new;
end
$$;

revoke all on function public.set_course_publication_content_updated_at()
from public, anon, authenticated, service_role;
grant execute on function public.set_course_publication_content_updated_at()
to postgres;

create trigger trg_course_publication_content_insert_clock
before insert on public.course
for each row execute function public.set_course_publication_content_updated_at();

create trigger trg_course_publication_content_update_clock
before update on public.course
for each row execute function public.set_course_publication_content_updated_at();

create function public.touch_course_from_authoring_child()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_course_id uuid;
  v_new_course_id uuid;
begin
  if tg_table_name = 'lesson' then
    if tg_op <> 'INSERT' then
      v_old_course_id := old.course_id;
    end if;
    if tg_op <> 'DELETE' then
      v_new_course_id := new.course_id;
    end if;
  elsif tg_table_name in ('lesson_component', 'lesson_student_slide') then
    if tg_op <> 'INSERT' then
      select lesson.course_id
      into v_old_course_id
      from public.lesson as lesson
      where lesson.id = old.lesson_id;
    end if;
    if tg_op <> 'DELETE' then
      select lesson.course_id
      into v_new_course_id
      from public.lesson as lesson
      where lesson.id = new.lesson_id;
    end if;
  elsif tg_table_name = 'course_attachment' then
    if tg_op <> 'INSERT' then
      v_old_course_id := old.course_id;
    end if;
    if tg_op <> 'DELETE' then
      v_new_course_id := new.course_id;
    end if;
  else
    raise exception 'course_authoring_touch_table_not_supported'
      using errcode = '55000';
  end if;

  update public.course as course
  set updated_at = clock_timestamp(),
      publication_content_updated_at = clock_timestamp()
  where course.id in (v_old_course_id, v_new_course_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

revoke all on function public.touch_course_from_authoring_child()
from public, anon, authenticated, service_role;
grant execute on function public.touch_course_from_authoring_child()
to postgres;

create function public.touch_courses_from_stored_file()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.course as course
  set updated_at = clock_timestamp(),
      publication_content_updated_at = clock_timestamp()
  where exists (
    select 1
    from public.course_attachment as attachment
    where attachment.course_id = course.id
      and attachment.stored_file_id = new.id
  );

  return new;
end
$$;

revoke all on function public.touch_courses_from_stored_file()
from public, anon, authenticated, service_role;
grant execute on function public.touch_courses_from_stored_file()
to postgres;

create trigger trg_lesson_touch_course
after insert or update or delete on public.lesson
for each row execute function public.touch_course_from_authoring_child();

create trigger trg_lesson_component_touch_course
after insert or update or delete on public.lesson_component
for each row execute function public.touch_course_from_authoring_child();

create trigger trg_lesson_student_slide_touch_course
after insert or update or delete on public.lesson_student_slide
for each row execute function public.touch_course_from_authoring_child();

create trigger trg_course_attachment_touch_course
after insert or update or delete on public.course_attachment
for each row execute function public.touch_course_from_authoring_child();

create trigger trg_stored_file_touch_courses
after update of
  owner_account_id,
  storage_bucket,
  storage_path,
  original_filename,
  mime_type,
  size_bytes,
  checksum_sha256,
  status,
  metadata
on public.stored_file
for each row execute function public.touch_courses_from_stored_file();

-- -----------------------------------------------------------------------------
-- Registry-aware publication asset remap. Publication snapshot payloads use
-- publicationAssetId in storedFileId slots; cloned Courses receive new owner
-- StoredFile IDs. Non-asset component payloads remain byte-for-byte JSONB.
-- -----------------------------------------------------------------------------

create function public.remap_course_publication_component_assets(
  p_type_key text,
  p_payload jsonb,
  p_asset_id_map jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_source_id text;
  v_target_id text;
  v_slides jsonb;
begin
  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or p_asset_id_map is null
    or jsonb_typeof(p_asset_id_map) <> 'object'
  then
    raise exception 'course_publication_asset_remap_invalid'
      using errcode = '22023';
  end if;

  if p_type_key in ('image', 'file') then
    v_source_id := p_payload ->> 'storedFileId';
    if v_source_id is null or v_source_id = '' then
      return p_payload;
    end if;

    v_target_id := p_asset_id_map ->> v_source_id;
    if v_target_id is null then
      raise exception 'course_publication_asset_map_incomplete'
        using errcode = '22023';
    end if;

    return jsonb_set(
      p_payload,
      '{storedFileId}',
      to_jsonb(v_target_id),
      false
    );
  end if;

  if p_type_key = 'slideshow' then
    if jsonb_typeof(p_payload -> 'slides') <> 'array' then
      raise exception 'course_publication_slideshow_payload_invalid'
        using errcode = '22023';
    end if;

    select coalesce(
      jsonb_agg(
        slide.value || jsonb_build_object(
          'storedFileId',
          case
            when jsonb_typeof(slide.value -> 'storedFileId') = 'null'
              then 'null'::jsonb
            else to_jsonb(
              coalesce(
                p_asset_id_map ->> (slide.value ->> 'storedFileId'),
                '__missing__'
              )
            )
          end
        )
        order by slide.ordinality
      ),
      '[]'::jsonb
    )
    into v_slides
    from jsonb_array_elements(p_payload -> 'slides')
      with ordinality as slide(value, ordinality);

    if v_slides @> '[{"storedFileId":"__missing__"}]'::jsonb then
      raise exception 'course_publication_asset_map_incomplete'
        using errcode = '22023';
    end if;

    return jsonb_set(p_payload, '{slides}', v_slides, false);
  end if;

  return p_payload;
end
$$;

revoke all on function public.remap_course_publication_component_assets(
  text,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.remap_course_publication_component_assets(
  text,
  jsonb,
  jsonb
) to postgres, service_role;

create function public.course_publication_snapshot_payloads_match(
  p_source_course_id uuid,
  p_snapshot jsonb,
  p_asset_id_map jsonb
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (
    select 1
    from public.lesson_component as source_component
    join public.lesson as source_lesson
      on source_lesson.id = source_component.lesson_id
    left join lateral (
      select submitted_component.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'components'
      ) as submitted_component(value)
      where (submitted_lesson.value ->> 'position')::integer
          = source_lesson.position
        and (submitted_component.value ->> 'position')::integer
          = source_component.position
      limit 1
    ) as submitted on true
    where source_lesson.course_id = p_source_course_id
      and (
        submitted.value is null
        or public.remap_course_publication_component_assets(
          source_component.type_key,
          source_component.payload,
          p_asset_id_map
        ) is distinct from submitted.value -> 'payload'
      )
  )
$$;

revoke all on function public.course_publication_snapshot_payloads_match(
  uuid,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.course_publication_snapshot_payloads_match(
  uuid,
  jsonb,
  jsonb
) to postgres, service_role;

create function public.course_publication_asset_extension(p_mime_type text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case p_mime_type
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    when 'image/gif' then 'gif'
    when 'application/pdf' then 'pdf'
    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      then 'docx'
    when 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      then 'pptx'
    when 'text/plain' then 'txt'
    when 'text/markdown' then 'md'
    else null
  end
$$;

revoke all on function public.course_publication_asset_extension(text)
from public, anon, authenticated, service_role;
grant execute on function public.course_publication_asset_extension(text)
to postgres, service_role;

-- -----------------------------------------------------------------------------
-- Publish/update one immutable revision. The server copies publication asset
-- bytes first; this transaction proves that every manifest row is an attached,
-- ready source file and that the destination object uses the derived path.
-- -----------------------------------------------------------------------------

create function public.publish_course_revision_admin(
  p_actor_account_id uuid,
  p_source_course_id uuid,
  p_publication_id uuid,
  p_revision_id uuid,
  p_content_sha256 text,
  p_snapshot jsonb,
  p_asset_manifest jsonb,
  p_rights_confirmed boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_course public.course%rowtype;
  v_publisher_display_name text;
  v_publication public.course_publication%rowtype;
  v_revision public.course_publication_revision%rowtype;
  v_revision_number integer;
  v_lesson_count integer;
  v_component_count integer;
  v_slide_count integer;
  v_asset_count integer;
  v_asset_total_bytes bigint;
  v_existing_snapshot_bytes bigint;
  v_existing_asset_bytes bigint;
  v_candidate_storage_bytes bigint;
  v_asset_id_map jsonb;
  v_snapshot_course jsonb;
begin
  if p_actor_account_id is null
    or p_source_course_id is null
    or p_publication_id is null
    or p_revision_id is null
    or p_content_sha256 is null
    or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_rights_confirmed is distinct from true
    or p_snapshot is null
    or jsonb_typeof(p_snapshot) <> 'object'
    or p_asset_manifest is null
    or jsonb_typeof(p_asset_manifest) <> 'array'
  then
    raise exception 'course_publication_publish_invalid'
      using errcode = '22023';
  end if;

  if (p_snapshot - array['schemaVersion', 'course', 'lessons', 'materials'])
      <> '{}'::jsonb
    or not (p_snapshot ?& array['schemaVersion', 'course', 'lessons', 'materials'])
    or p_snapshot ->> 'schemaVersion' <> '1'
    or jsonb_typeof(p_snapshot -> 'course') <> 'object'
    or jsonb_typeof(p_snapshot -> 'lessons') <> 'array'
    or jsonb_typeof(p_snapshot -> 'materials') <> 'array'
  then
    raise exception 'course_publication_snapshot_shape_invalid'
      using errcode = '22023';
  end if;

  select course.*
  into v_course
  from public.course as course
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
  for update;

  if not found then
    raise exception 'course_publication_source_not_found'
      using errcode = 'P0002';
  end if;

  select account.display_name
  into v_publisher_display_name
  from public.account as account
  where account.id = p_actor_account_id
    and account.status = 'active'
  for update;

  if not found then
    raise exception 'course_publication_actor_not_active'
      using errcode = '42501';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.source_course_id = p_source_course_id
  for update;

  if found and v_publication.id <> p_publication_id then
    raise exception 'course_publication_id_conflict'
      using errcode = '23505';
  end if;

  if v_publication.id is not null then
    select revision.*
    into strict v_revision
    from public.course_publication_revision as revision
    where revision.id = v_publication.current_revision_id;
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.course_id = p_source_course_id
  order by lesson.id
  for update;

  perform 1
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  where lesson.course_id = p_source_course_id
  order by component.id
  for update of component;

  perform 1
  from public.lesson_student_slide as slide
  join public.lesson as lesson on lesson.id = slide.lesson_id
  where lesson.course_id = p_source_course_id
  order by slide.id
  for update of slide;

  perform 1
  from public.course_attachment as attachment
  where attachment.course_id = p_source_course_id
  order by attachment.id
  for update;

  perform 1
  from public.stored_file as stored_file
  join public.course_attachment as attachment
    on attachment.stored_file_id = stored_file.id
  where attachment.course_id = p_source_course_id
  order by stored_file.id
  for share of stored_file;

  v_snapshot_course := p_snapshot -> 'course';

  if (v_snapshot_course - array[
      'title',
      'subject',
      'goal',
      'level',
      'audienceDescription',
      'targetLessonCount'
    ]) <> '{}'::jsonb
    or not (v_snapshot_course ?& array[
      'title',
      'subject',
      'goal',
      'level',
      'audienceDescription',
      'targetLessonCount'
    ])
    or v_snapshot_course ->> 'title' is distinct from v_course.title
    or coalesce(v_snapshot_course ->> 'subject', '')
      is distinct from coalesce(v_course.subject, '')
    or coalesce(v_snapshot_course ->> 'goal', '')
      is distinct from coalesce(v_course.goal, '')
    or coalesce(v_snapshot_course ->> 'level', '')
      is distinct from coalesce(v_course.level, '')
    or coalesce(v_snapshot_course ->> 'audienceDescription', '')
      is distinct from coalesce(v_course.audience_description, '')
    or coalesce(v_snapshot_course -> 'targetLessonCount', 'null'::jsonb)
      is distinct from coalesce(to_jsonb(v_course.target_lesson_count), 'null'::jsonb)
  then
    raise exception 'course_publication_course_snapshot_mismatch'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into v_lesson_count
  from public.lesson as lesson
  where lesson.course_id = p_source_course_id;

  if v_lesson_count < 1
    or jsonb_array_length(p_snapshot -> 'lessons') <> v_lesson_count
  then
    raise exception 'course_publication_requires_lessons'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted(value)
    where jsonb_typeof(submitted.value) <> 'object'
      or (submitted.value - array[
        'ref',
        'position',
        'title',
        'summary',
        'estimatedDurationMinutes',
        'components',
        'slides'
      ]) <> '{}'::jsonb
      or not (submitted.value ?& array[
        'ref',
        'position',
        'title',
        'summary',
        'estimatedDurationMinutes',
        'components',
        'slides'
      ])
      or jsonb_typeof(submitted.value -> 'components') <> 'array'
      or jsonb_typeof(submitted.value -> 'slides') <> 'array'
  ) then
    raise exception 'course_publication_lesson_snapshot_invalid'
      using errcode = '22023';
  end if;

  if (
    select count(distinct (submitted.value ->> 'ref')::uuid)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted(value)
  ) <> v_lesson_count
  or exists (
    select 1
    from public.lesson as lesson
    left join lateral (
      select submitted.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted(value)
      where (submitted.value ->> 'position')::integer = lesson.position
      limit 1
    ) as submitted on true
    where lesson.course_id = p_source_course_id
      and (
        submitted.value is null
        or (submitted.value ->> 'position')::integer <> lesson.position
        or submitted.value ->> 'title' is distinct from lesson.title
        or coalesce(submitted.value ->> 'summary', '')
          is distinct from coalesce(lesson.summary, '')
        or coalesce(
          submitted.value -> 'estimatedDurationMinutes',
          'null'::jsonb
        ) is distinct from coalesce(
          to_jsonb(lesson.estimated_duration_minutes),
          'null'::jsonb
        )
      )
  ) then
    raise exception 'course_publication_lesson_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'components'
    ) as submitted_component(value)
    where jsonb_typeof(submitted_component.value) <> 'object'
      or (submitted_component.value - array[
        'ref',
        'position',
        'typeKey',
        'schemaVersion',
        'payload',
        'placement',
        'visibility',
        'studentSlideRef'
      ]) <> '{}'::jsonb
      or not (submitted_component.value ?& array[
        'ref',
        'position',
        'typeKey',
        'schemaVersion',
        'payload',
        'placement',
        'visibility',
        'studentSlideRef'
      ])
      or jsonb_typeof(submitted_component.value -> 'payload') <> 'object'
      or jsonb_typeof(submitted_component.value -> 'placement') <> 'object'
  ) then
    raise exception 'course_publication_component_snapshot_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_component_count
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  where lesson.course_id = p_source_course_id;

  if (
    select count(*)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'components'
    ) as submitted_component(value)
  ) <> v_component_count
  or (
    select count(distinct (submitted_component.value ->> 'ref')::uuid)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'components'
    ) as submitted_component(value)
  ) <> v_component_count
  or exists (
    select 1
    from public.lesson_component as component
    join public.lesson as lesson on lesson.id = component.lesson_id
    left join lateral (
      select submitted_component.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'components'
      ) as submitted_component(value)
      where (submitted_lesson.value ->> 'position')::integer = lesson.position
        and (submitted_component.value ->> 'position')::integer
          = component.position
      limit 1
    ) as submitted on true
    left join public.lesson_student_slide as source_slide
      on source_slide.id = component.student_slide_id
    left join lateral (
      select submitted_slide.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'slides'
      ) as submitted_slide(value)
      where source_slide.id is not null
        and (submitted_lesson.value ->> 'position')::integer = lesson.position
        and (submitted_slide.value ->> 'position')::integer
          = source_slide.position
      limit 1
    ) as submitted_slide on true
    where lesson.course_id = p_source_course_id
      and (
        submitted.value is null
        or (submitted.value ->> 'position')::integer <> component.position
        or submitted.value ->> 'typeKey' is distinct from component.type_key
        or (submitted.value ->> 'schemaVersion')::integer
          <> component.schema_version
        or submitted.value -> 'placement'
          is distinct from component.placement_config
        or submitted.value ->> 'visibility'
          is distinct from component.visibility
        or coalesce(submitted.value ->> 'studentSlideRef', '')
          is distinct from coalesce(
            submitted_slide.value ->> 'ref',
            ''
          )
        or (
          component.type_key not in ('image', 'slideshow', 'file')
          and submitted.value -> 'payload' is distinct from component.payload
        )
      )
  ) then
    raise exception 'course_publication_component_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'slides'
    ) as submitted_slide(value)
    where jsonb_typeof(submitted_slide.value) <> 'object'
      or (submitted_slide.value - array['ref', 'position']) <> '{}'::jsonb
      or not (submitted_slide.value ?& array['ref', 'position'])
  ) then
    raise exception 'course_publication_slide_snapshot_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_slide_count
  from public.lesson_student_slide as slide
  join public.lesson as lesson on lesson.id = slide.lesson_id
  where lesson.course_id = p_source_course_id;

  if (
    select count(*)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'slides'
    ) as submitted_slide(value)
  ) <> v_slide_count
  or (
    select count(distinct (submitted_slide.value ->> 'ref')::uuid)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'slides'
    ) as submitted_slide(value)
  ) <> v_slide_count
  or exists (
    select 1
    from public.lesson_student_slide as slide
    join public.lesson as lesson on lesson.id = slide.lesson_id
    left join lateral (
      select submitted_slide.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'slides'
      ) as submitted_slide(value)
      where (submitted_lesson.value ->> 'position')::integer = lesson.position
        and (submitted_slide.value ->> 'position')::integer = slide.position
      limit 1
    ) as submitted on true
    where lesson.course_id = p_source_course_id
      and (
        submitted.value is null
        or (submitted.value ->> 'position')::integer <> slide.position
      )
  ) then
    raise exception 'course_publication_slide_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if (
    select count(*) <> count(distinct authored.ref)
    from (
      select (submitted_lesson.value ->> 'ref')::uuid as ref
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      union all
      select (submitted_component.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'components'
      ) as submitted_component(value)
      union all
      select (submitted_slide.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'slides'
      ) as submitted_slide(value)
    ) as authored(ref)
  ) then
    raise exception 'course_publication_authored_refs_not_unique'
      using errcode = '22023';
  end if;

  -- Republish the immutable current revision without requiring a second set of
  -- copied objects. Equality of both the caller hash and canonical snapshot is
  -- required so a forged hash cannot select stale catalog content.
  if v_publication.id is not null
    and v_revision.content_sha256 = p_content_sha256
    and v_revision.snapshot = p_snapshot
  then
    v_asset_count := jsonb_array_length(p_snapshot -> 'materials');

    if jsonb_array_length(p_asset_manifest) <> 0
      or v_asset_count > 24
      or exists (
        select 1
        from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
        where jsonb_typeof(material.value) <> 'object'
          or (material.value - array[
            'ref',
            'originalFilename',
            'mimeType',
            'sizeBytes',
            'checksumSha256'
          ]) <> '{}'::jsonb
          or not (material.value ?& array[
            'ref',
            'originalFilename',
            'mimeType',
            'sizeBytes',
            'checksumSha256'
          ])
      )
    then
      raise exception 'course_publication_idempotent_assets_invalid'
        using errcode = '22023';
    end if;

    -- A byte-equal snapshot is acknowledged only if the live Course still has
    -- exactly the attachment set and ready StoredFile metadata captured by the
    -- immutable revision. This closes the service-read -> RPC detach race.
    if (
      select count(*)
      from public.course_publication_asset as asset
      where asset.revision_id = v_revision.id
    ) <> v_asset_count
    or (
      select count(*)
      from public.course_attachment as attachment
      where attachment.course_id = p_source_course_id
    ) <> v_asset_count
    or (
      select count(distinct (material.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
    ) <> v_asset_count
    or exists (
      select 1
      from public.course_publication_asset as asset
      left join public.course_attachment as attachment
        on attachment.course_id = p_source_course_id
        and attachment.stored_file_id = asset.source_stored_file_id
      left join public.stored_file as stored_file
        on stored_file.id = asset.source_stored_file_id
      left join lateral (
        select material.value
        from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
        where (material.value ->> 'ref')::uuid = asset.id
        limit 1
      ) as material on true
      where asset.revision_id = v_revision.id
        and (
          asset.source_stored_file_id is null
          or attachment.id is null
          or stored_file.id is null
          or stored_file.owner_account_id <> p_actor_account_id
          or stored_file.status <> 'ready'
          or stored_file.original_filename
            is distinct from asset.original_filename
          or stored_file.mime_type is distinct from asset.mime_type
          or stored_file.size_bytes is distinct from asset.size_bytes
          or stored_file.checksum_sha256
            is distinct from asset.checksum_sha256
          or material.value is null
          or material.value ->> 'originalFilename'
            is distinct from asset.original_filename
          or material.value ->> 'mimeType' is distinct from asset.mime_type
          or (material.value ->> 'sizeBytes')::bigint
            is distinct from asset.size_bytes
          or material.value ->> 'checksumSha256'
            is distinct from asset.checksum_sha256
          or not exists (
            select 1
            from storage.objects as object
            where object.bucket_id = asset.storage_bucket
              and object.name = asset.storage_path
          )
        )
    )
    then
      raise exception 'course_publication_idempotent_assets_mismatch'
        using errcode = '23514';
    end if;

    select coalesce(
      jsonb_object_agg(
        asset.source_stored_file_id::text,
        to_jsonb(asset.id::text)
      ) filter (where asset.source_stored_file_id is not null),
      '{}'::jsonb
    )
    into v_asset_id_map
    from public.course_publication_asset as asset
    where asset.revision_id = v_revision.id;

    if not public.course_publication_snapshot_payloads_match(
      p_source_course_id,
      p_snapshot,
      v_asset_id_map
    ) then
      raise exception 'course_publication_component_payload_mismatch'
        using errcode = '23514';
    end if;

    update public.course_publication as publication
    set title = v_snapshot_course ->> 'title',
        subject = v_snapshot_course ->> 'subject',
        goal = v_snapshot_course ->> 'goal',
        level = v_snapshot_course ->> 'level',
        audience_description = v_snapshot_course ->> 'audienceDescription',
        target_lesson_count =
          (v_snapshot_course ->> 'targetLessonCount')::integer,
        lesson_count = v_lesson_count,
        material_count = jsonb_array_length(p_snapshot -> 'materials'),
        source_content_updated_at =
          v_course.publication_content_updated_at,
        status = 'published',
        unpublished_at = null,
        updated_at = clock_timestamp()
    where publication.id = v_publication.id
    returning publication.* into v_publication;

    return jsonb_build_object(
      'publicationId', v_publication.id,
      'sourceCourseId', v_publication.source_course_id,
      'status', v_publication.status,
      'currentRevisionId', v_revision.id,
      'publishedAt', v_publication.published_at,
      'updatedAt', v_publication.updated_at,
      'sourceCourseUpdatedAt', v_revision.source_course_updated_at,
      'sourceContentUpdatedAt', v_publication.source_content_updated_at,
      'contentSha256', v_revision.content_sha256
    );
  end if;

  if v_publication.id is not null
    and v_revision.content_sha256 = p_content_sha256
  then
    raise exception 'course_publication_current_hash_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
    where jsonb_typeof(material.value) <> 'object'
      or (material.value - array[
        'ref',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256'
      ]) <> '{}'::jsonb
      or not (material.value ?& array[
        'ref',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256'
      ])
  ) or exists (
    select 1
    from jsonb_array_elements(p_asset_manifest) as asset(value)
    where jsonb_typeof(asset.value) <> 'object'
      or (asset.value - array[
        'publicationAssetId',
        'sourceStoredFileId',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256',
        'storageBucket',
        'storagePath'
      ]) <> '{}'::jsonb
      or not (asset.value ?& array[
        'publicationAssetId',
        'sourceStoredFileId',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256',
        'storageBucket',
        'storagePath'
      ])
  ) then
    raise exception 'course_publication_asset_manifest_shape_invalid'
      using errcode = '22023';
  end if;

  v_asset_count := jsonb_array_length(p_asset_manifest);
  if v_asset_count > 24
    or jsonb_array_length(p_snapshot -> 'materials') <> v_asset_count
    or (
      select count(*)
      from public.course_attachment as attachment
      where attachment.course_id = p_source_course_id
    ) <> v_asset_count
  then
    raise exception 'course_publication_asset_limit_exceeded'
      using errcode = '54000';
  end if;

  select coalesce(sum(asset."sizeBytes"), 0)
  into v_asset_total_bytes
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "sourceStoredFileId" uuid,
    "originalFilename" text,
    "mimeType" text,
    "sizeBytes" bigint,
    "checksumSha256" text,
    "storageBucket" text,
    "storagePath" text
  );

  if v_asset_total_bytes > 125829120
    or (
      select count(distinct asset."publicationAssetId")
      from jsonb_to_recordset(p_asset_manifest) as asset(
        "publicationAssetId" uuid,
        "sourceStoredFileId" uuid
      )
    ) <> v_asset_count
    or (
      select count(distinct asset."sourceStoredFileId")
      from jsonb_to_recordset(p_asset_manifest) as asset(
        "publicationAssetId" uuid,
        "sourceStoredFileId" uuid
      )
    ) <> v_asset_count
  then
    raise exception 'course_publication_asset_manifest_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_asset_manifest) as asset(
      "publicationAssetId" uuid,
      "sourceStoredFileId" uuid,
      "originalFilename" text,
      "mimeType" text,
      "sizeBytes" bigint,
      "checksumSha256" text,
      "storageBucket" text,
      "storagePath" text
    )
    left join public.course_attachment as attachment
      on attachment.course_id = p_source_course_id
      and attachment.stored_file_id = asset."sourceStoredFileId"
    left join public.stored_file as stored_file
      on stored_file.id = asset."sourceStoredFileId"
    left join lateral (
      select material.value
      from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
      where (material.value ->> 'ref')::uuid = asset."publicationAssetId"
      limit 1
    ) as material on true
    where attachment.id is null
      or stored_file.id is null
      or stored_file.owner_account_id <> p_actor_account_id
      or stored_file.status <> 'ready'
      or stored_file.original_filename is distinct from asset."originalFilename"
      or stored_file.mime_type is distinct from asset."mimeType"
      or stored_file.size_bytes is distinct from asset."sizeBytes"
      or stored_file.checksum_sha256 is distinct from asset."checksumSha256"
      or asset."sizeBytes" <= 0
      or asset."sizeBytes" > 10485760
      or asset."checksumSha256" !~ '^[0-9a-f]{64}$'
      or asset."storageBucket" <> 'course-publication-assets'
      or asset."storagePath" <> concat(
        p_publication_id::text,
        '/revisions/',
        p_revision_id::text,
        '/assets/',
        asset."publicationAssetId"::text
      )
      or material.value is null
      or material.value ->> 'originalFilename'
        is distinct from asset."originalFilename"
      or material.value ->> 'mimeType' is distinct from asset."mimeType"
      or (material.value ->> 'sizeBytes')::bigint
        is distinct from asset."sizeBytes"
      or material.value ->> 'checksumSha256'
        is distinct from asset."checksumSha256"
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = 'course-publication-assets'
          and object.name = asset."storagePath"
      )
  ) then
    raise exception 'course_publication_asset_manifest_mismatch'
      using errcode = '23514';
  end if;

  if (
    select count(distinct (material.value ->> 'ref')::uuid)
    from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
  ) <> v_asset_count
  or (
    select count(*) <> count(distinct all_ref.ref)
    from (
      select (submitted_lesson.value ->> 'ref')::uuid as ref
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      union all
      select (submitted_component.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'components'
      ) as submitted_component(value)
      union all
      select (submitted_slide.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'slides'
      ) as submitted_slide(value)
      union all
      select (material.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
    ) as all_ref(ref)
  )
  then
    raise exception 'course_publication_material_manifest_not_exact'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_object_agg(
      asset."sourceStoredFileId"::text,
      to_jsonb(asset."publicationAssetId"::text)
    ),
    '{}'::jsonb
  )
  into v_asset_id_map
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "sourceStoredFileId" uuid
  );

  if not public.course_publication_snapshot_payloads_match(
    p_source_course_id,
    p_snapshot,
    v_asset_id_map
  ) then
    raise exception 'course_publication_component_payload_mismatch'
      using errcode = '23514';
  end if;

  -- The Account row was locked above, so concurrent publications for this
  -- owner cannot both observe the same remaining quota. This branch is only
  -- reached for a new immutable revision; idempotent republish returned before
  -- it and consumes no additional quota.
  v_candidate_storage_bytes :=
    octet_length(p_snapshot::text)::bigint + v_asset_total_bytes;

  select coalesce(
    sum(octet_length(revision.snapshot::text)::bigint),
    0
  )
  into v_existing_snapshot_bytes
  from public.course_publication_revision as revision
  join public.course_publication as publication
    on publication.id = revision.publication_id
  where publication.owner_account_id = p_actor_account_id;

  select coalesce(sum(asset.size_bytes), 0)
  into v_existing_asset_bytes
  from public.course_publication_asset as asset
  join public.course_publication_revision as revision
    on revision.id = asset.revision_id
  join public.course_publication as publication
    on publication.id = revision.publication_id
  where publication.owner_account_id = p_actor_account_id;

  if v_existing_snapshot_bytes
      + v_existing_asset_bytes
      + v_candidate_storage_bytes > 5368709120
  then
    raise exception 'course_publication_account_quota_exceeded'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.course_publication_revision as revision
    where revision.id = p_revision_id
  ) then
    raise exception 'course_publication_revision_id_conflict'
      using errcode = '23505';
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
  into v_revision_number
  from public.course_publication_revision as revision
  where revision.publication_id = p_publication_id;

  if v_publication.id is null then
    insert into public.course_publication (
      id,
      source_course_id,
      owner_account_id,
      publisher_display_name,
      is_shidao,
      title,
      subject,
      goal,
      level,
      audience_description,
      target_lesson_count,
      lesson_count,
      material_count,
      status,
      current_revision_id,
      source_content_updated_at,
      published_at,
      unpublished_at,
      created_at,
      updated_at
    )
    values (
      p_publication_id,
      p_source_course_id,
      p_actor_account_id,
      v_publisher_display_name,
      false,
      v_snapshot_course ->> 'title',
      v_snapshot_course ->> 'subject',
      v_snapshot_course ->> 'goal',
      v_snapshot_course ->> 'level',
      v_snapshot_course ->> 'audienceDescription',
      (v_snapshot_course ->> 'targetLessonCount')::integer,
      v_lesson_count,
      v_asset_count,
      'published',
      p_revision_id,
      v_course.publication_content_updated_at,
      clock_timestamp(),
      null,
      clock_timestamp(),
      clock_timestamp()
    )
    returning * into v_publication;
  end if;

  insert into public.course_publication_revision (
    id,
    publication_id,
    revision_number,
    source_course_updated_at,
    content_sha256,
    snapshot,
    rights_confirmed_at,
    license_code,
    published_at
  )
  values (
    p_revision_id,
    p_publication_id,
    v_revision_number,
    v_course.publication_content_updated_at,
    p_content_sha256,
    p_snapshot,
    clock_timestamp(),
    'shidao_catalog_reuse_v1',
    clock_timestamp()
  )
  returning * into v_revision;

  insert into public.course_publication_asset (
    id,
    revision_id,
    source_stored_file_id,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    checksum_sha256
  )
  select
    asset."publicationAssetId",
    p_revision_id,
    asset."sourceStoredFileId",
    asset."storageBucket",
    asset."storagePath",
    asset."originalFilename",
    asset."mimeType",
    asset."sizeBytes",
    asset."checksumSha256"
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "sourceStoredFileId" uuid,
    "originalFilename" text,
    "mimeType" text,
    "sizeBytes" bigint,
    "checksumSha256" text,
    "storageBucket" text,
    "storagePath" text
  );

  update public.course_publication as publication
  set title = v_snapshot_course ->> 'title',
      subject = v_snapshot_course ->> 'subject',
      goal = v_snapshot_course ->> 'goal',
      level = v_snapshot_course ->> 'level',
      audience_description = v_snapshot_course ->> 'audienceDescription',
      target_lesson_count =
        (v_snapshot_course ->> 'targetLessonCount')::integer,
      lesson_count = v_lesson_count,
      material_count = v_asset_count,
      current_revision_id = p_revision_id,
      source_content_updated_at = v_course.publication_content_updated_at,
      status = 'published',
      unpublished_at = null,
      updated_at = clock_timestamp()
  where publication.id = p_publication_id
    and publication.owner_account_id = p_actor_account_id
  returning publication.* into v_publication;

  if not found then
    raise exception 'course_publication_update_conflict'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'publicationId', v_publication.id,
    'sourceCourseId', v_publication.source_course_id,
    'status', v_publication.status,
    'currentRevisionId', v_revision.id,
    'publishedAt', v_publication.published_at,
    'updatedAt', v_publication.updated_at,
    'sourceCourseUpdatedAt', v_revision.source_course_updated_at,
    'sourceContentUpdatedAt', v_publication.source_content_updated_at,
    'contentSha256', v_revision.content_sha256
  );
end
$$;

revoke all on function public.publish_course_revision_admin(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  boolean
) from public, anon, authenticated, service_role;
grant execute on function public.publish_course_revision_admin(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  boolean
) to postgres, service_role;

create function public.unpublish_course_publication_admin(
  p_actor_account_id uuid,
  p_source_course_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_publication public.course_publication%rowtype;
  v_revision public.course_publication_revision%rowtype;
begin
  if p_actor_account_id is null or p_source_course_id is null then
    raise exception 'course_publication_unpublish_invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.course as course
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
  for update;

  if not found then
    raise exception 'course_publication_source_not_found'
      using errcode = 'P0002';
  end if;

  update public.course_publication as publication
  set status = 'unpublished',
      unpublished_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where publication.source_course_id = p_source_course_id
    and publication.owner_account_id = p_actor_account_id
  returning publication.* into v_publication;

  if not found then
    raise exception 'course_publication_not_found'
      using errcode = 'P0002';
  end if;

  select revision.*
  into strict v_revision
  from public.course_publication_revision as revision
  where revision.id = v_publication.current_revision_id;

  return jsonb_build_object(
    'publicationId', v_publication.id,
    'sourceCourseId', v_publication.source_course_id,
    'status', v_publication.status,
    'currentRevisionId', v_revision.id,
    'publishedAt', v_publication.published_at,
    'updatedAt', v_publication.updated_at,
    'sourceCourseUpdatedAt', v_revision.source_course_updated_at,
    'sourceContentUpdatedAt', v_publication.source_content_updated_at,
    'contentSha256', v_revision.content_sha256
  );
end
$$;

revoke all on function public.unpublish_course_publication_admin(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.unpublish_course_publication_admin(uuid, uuid)
to postgres, service_role;

-- -----------------------------------------------------------------------------
-- Compact authenticated catalog list. The immutable revision snapshot is never
-- transported for list/filter/facet queries; detail fetch remains separate.
-- -----------------------------------------------------------------------------

create function public.list_course_publication_catalog_admin(
  p_actor_account_id uuid,
  p_q text,
  p_subject text,
  p_level text,
  p_offset integer,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_actor_account_id is null
    or p_q is null
    or char_length(btrim(p_q)) > 160
    or p_subject is null
    or char_length(btrim(p_subject)) > 160
    or p_level is null
    or char_length(btrim(p_level)) > 240
    or p_offset is null
    or p_offset < 0
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
  then
    raise exception 'course_publication_catalog_query_invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.account as account
  where account.id = p_actor_account_id
    and account.status = 'active';

  if not found then
    raise exception 'course_publication_catalog_actor_not_active'
      using errcode = '42501';
  end if;

  with filtered as (
    select publication.*
    from public.course_publication as publication
    join public.account as owner_account
      on owner_account.id = publication.owner_account_id
    where publication.status = 'published'
      and owner_account.status = 'active'
      and (
        btrim(p_q) = ''
        or position(
          lower(btrim(p_q)) in lower(concat_ws(
            ' ',
            publication.title,
            publication.subject,
            publication.goal,
            publication.level,
            publication.audience_description,
            publication.publisher_display_name
          ))
        ) > 0
      )
      and (
        btrim(p_subject) = ''
        or lower(btrim(publication.subject)) = lower(btrim(p_subject))
      )
      and (
        btrim(p_level) = ''
        or lower(btrim(publication.level)) = lower(btrim(p_level))
      )
  ),
  page_plus_one as materialized (
    select publication.*
    from filtered as publication
    order by
      publication.is_shidao desc,
      publication.published_at desc,
      publication.id desc
    offset p_offset
    limit p_limit + 1
  ),
  page_rows as (
    select publication.*
    from page_plus_one as publication
    order by
      publication.is_shidao desc,
      publication.published_at desc,
      publication.id desc
    limit p_limit
  ),
  subject_values_all as (
    select min(btrim(publication.subject)) as value
    from public.course_publication as publication
    join public.account as owner_account
      on owner_account.id = publication.owner_account_id
    where publication.status = 'published'
      and owner_account.status = 'active'
      and btrim(publication.subject) <> ''
    group by lower(btrim(publication.subject))
  ),
  subject_values as materialized (
    select value
    from subject_values_all
    order by
      case
        when btrim(p_subject) <> ''
          and lower(value) = lower(btrim(p_subject))
          then 0
        else 1
      end,
      lower(value),
      value
    limit 100
  ),
  level_values_all as (
    select min(btrim(publication.level)) as value
    from public.course_publication as publication
    join public.account as owner_account
      on owner_account.id = publication.owner_account_id
    where publication.status = 'published'
      and owner_account.status = 'active'
      and btrim(publication.level) <> ''
    group by lower(btrim(publication.level))
  ),
  level_values as materialized (
    select value
    from level_values_all
    order by
      case
        when btrim(p_level) <> ''
          and lower(value) = lower(btrim(p_level))
          then 0
        else 1
      end,
      lower(value),
      value
    limit 100
  )
  select jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'publicationId', publication.id,
          'sourceCourseId', case
            when publication.owner_account_id = p_actor_account_id
              then publication.source_course_id
            else null
          end,
          'title', publication.title,
          'subject', publication.subject,
          'goal', publication.goal,
          'level', publication.level,
          'audienceDescription', publication.audience_description,
          'targetLessonCount', publication.target_lesson_count,
          'lessonCount', publication.lesson_count,
          'materialCount', publication.material_count,
          'publishedAt', publication.published_at,
          'author', jsonb_build_object(
            'displayName', publication.publisher_display_name,
            'isShiDao', publication.is_shidao,
            'isCurrentUser',
              publication.owner_account_id = p_actor_account_id
          )
        )
        order by
          publication.is_shidao desc,
          publication.published_at desc,
          publication.id desc
      )
      from page_rows as publication
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'subjects', coalesce((
        select jsonb_agg(value order by lower(value), value)
        from subject_values
      ), '[]'::jsonb),
      'levels', coalesce((
        select jsonb_agg(value order by lower(value), value)
        from level_values
      ), '[]'::jsonb)
    ),
    'nextOffset', case
      when (select count(*) from page_plus_one) > p_limit
        then p_offset + p_limit
      else null
    end
  )
  into v_result;

  return v_result;
end
$$;

revoke all on function public.list_course_publication_catalog_admin(
  uuid,
  text,
  text,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;
grant execute on function public.list_course_publication_catalog_admin(
  uuid,
  text,
  text,
  text,
  integer,
  integer
) to postgres, service_role;

-- -----------------------------------------------------------------------------
-- Install the current published revision as a new independent working Course.
-- The server copies immutable publication objects to owner-scoped course-assets
-- paths first; this transaction verifies an exact graph ID map and file set.
-- -----------------------------------------------------------------------------

create function public.clone_course_publication_admin(
  p_actor_account_id uuid,
  p_publication_id uuid,
  p_target_course_id uuid,
  p_target_title text,
  p_id_map jsonb,
  p_asset_manifest jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_publication public.course_publication%rowtype;
  v_revision public.course_publication_revision%rowtype;
  v_catalog_owner_account_id uuid;
  v_lesson_count integer;
  v_component_count integer;
  v_slide_count integer;
  v_asset_count integer;
  v_asset_total_bytes bigint;
  v_asset_id_map jsonb;
begin
  if p_actor_account_id is null
    or p_publication_id is null
    or p_target_course_id is null
    or (
      p_target_title is not null
      and (
        btrim(p_target_title) = ''
        or char_length(btrim(p_target_title)) > 160
      )
    )
    or p_id_map is null
    or jsonb_typeof(p_id_map) <> 'object'
    or p_asset_manifest is null
    or jsonb_typeof(p_asset_manifest) <> 'array'
  then
    raise exception 'course_publication_clone_invalid'
      using errcode = '22023';
  end if;

  select publication.owner_account_id
  into v_catalog_owner_account_id
  from public.course_publication as publication
  where publication.id = p_publication_id;

  if not found then
    raise exception 'course_publication_not_published'
      using errcode = 'P0002';
  end if;

  -- Lock actor and catalog owner in one deterministic order. Account status
  -- transitions therefore serialize with cloning without cross-owner deadlocks.
  perform 1
  from public.account as account
  where account.id in (p_actor_account_id, v_catalog_owner_account_id)
  order by account.id
  for share;

  perform 1
  from public.account as account
  where account.id = p_actor_account_id
    and account.status = 'active';

  if not found then
    raise exception 'course_publication_clone_actor_not_active'
      using errcode = '42501';
  end if;

  perform 1
  from public.account as account
  where account.id = v_catalog_owner_account_id
    and account.status = 'active';

  if not found then
    raise exception 'course_publication_not_published'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.course as course
    where course.id = p_target_course_id
  ) then
    raise exception 'course_publication_clone_course_id_conflict'
      using errcode = '23505';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.id = p_publication_id
    and publication.status = 'published'
    and publication.owner_account_id = v_catalog_owner_account_id
  for share;

  if not found then
    raise exception 'course_publication_not_published'
      using errcode = 'P0002';
  end if;

  select revision.*
  into strict v_revision
  from public.course_publication_revision as revision
  where revision.publication_id = v_publication.id
    and revision.id = v_publication.current_revision_id
  for share;

  if (p_id_map - array['lessons', 'components', 'slides']) <> '{}'::jsonb
    or jsonb_typeof(p_id_map -> 'lessons') <> 'array'
    or jsonb_typeof(p_id_map -> 'components') <> 'array'
    or jsonb_typeof(p_id_map -> 'slides') <> 'array'
  then
    raise exception 'course_publication_clone_id_map_shape_invalid'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'components') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) then
    raise exception 'course_publication_clone_id_map_shape_invalid'
      using errcode = '22023';
  end if;

  v_lesson_count := jsonb_array_length(v_revision.snapshot -> 'lessons');

  select count(*)::integer
  into v_component_count
  from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
  cross join lateral jsonb_array_elements(
    lesson.value -> 'components'
  ) as component(value);

  select count(*)::integer
  into v_slide_count
  from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
  cross join lateral jsonb_array_elements(
    lesson.value -> 'slides'
  ) as slide(value);

  if jsonb_array_length(p_id_map -> 'lessons') <> v_lesson_count
    or jsonb_array_length(p_id_map -> 'components') <> v_component_count
    or jsonb_array_length(p_id_map -> 'slides') <> v_slide_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    ) <> v_lesson_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    ) <> v_lesson_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
    ) <> v_component_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
    ) <> v_component_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    ) <> v_slide_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    ) <> v_slide_count
  then
    raise exception 'course_publication_clone_id_map_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
    where not exists (
      select 1
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
      where item.value ->> 'ref' = lesson.value ->> 'ref'
    )
  ) or exists (
    select 1
    from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
    cross join lateral jsonb_array_elements(
      lesson.value -> 'components'
    ) as component(value)
    where not exists (
      select 1
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
      where item.value ->> 'ref' = component.value ->> 'ref'
    )
  ) or exists (
    select 1
    from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
    cross join lateral jsonb_array_elements(
      lesson.value -> 'slides'
    ) as slide(value)
    where not exists (
      select 1
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
      where item.value ->> 'ref' = slide.value ->> 'ref'
    )
  ) then
    raise exception 'course_publication_clone_id_map_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    join public.lesson as lesson
      on lesson.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'components') as item(value)
    join public.lesson_component as component
      on component.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    join public.lesson_student_slide as slide
      on slide.id = (item.value ->> 'id')::uuid
  ) then
    raise exception 'course_publication_clone_target_id_conflict'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_asset_manifest) as asset(value)
    where jsonb_typeof(asset.value) <> 'object'
      or (asset.value - array[
        'publicationAssetId',
        'targetStoredFileId',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256',
        'storageBucket',
        'storagePath'
      ]) <> '{}'::jsonb
      or not (asset.value ?& array[
        'publicationAssetId',
        'targetStoredFileId',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256',
        'storageBucket',
        'storagePath'
      ])
  ) then
    raise exception 'course_publication_clone_asset_manifest_shape_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer, coalesce(sum(asset.size_bytes), 0)
  into v_asset_count, v_asset_total_bytes
  from public.course_publication_asset as asset
  where asset.revision_id = v_revision.id;

  if v_asset_count > 24
    or v_asset_total_bytes > 125829120
    or jsonb_array_length(p_asset_manifest) <> v_asset_count
    or (
      select count(distinct asset."publicationAssetId")
      from jsonb_to_recordset(p_asset_manifest) as asset(
        "publicationAssetId" uuid,
        "targetStoredFileId" uuid
      )
    ) <> v_asset_count
    or (
      select count(distinct asset."targetStoredFileId")
      from jsonb_to_recordset(p_asset_manifest) as asset(
        "publicationAssetId" uuid,
        "targetStoredFileId" uuid
      )
    ) <> v_asset_count
  then
    raise exception 'course_publication_clone_asset_manifest_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_asset_manifest) as submitted(
      "publicationAssetId" uuid,
      "targetStoredFileId" uuid,
      "originalFilename" text,
      "mimeType" text,
      "sizeBytes" bigint,
      "checksumSha256" text,
      "storageBucket" text,
      "storagePath" text
    )
    left join public.course_publication_asset as asset
      on asset.revision_id = v_revision.id
      and asset.id = submitted."publicationAssetId"
    left join public.stored_file as existing_file
      on existing_file.id = submitted."targetStoredFileId"
    where asset.id is null
      or existing_file.id is not null
      or submitted."originalFilename" is distinct from asset.original_filename
      or submitted."mimeType" is distinct from asset.mime_type
      or submitted."sizeBytes" is distinct from asset.size_bytes
      or submitted."checksumSha256" is distinct from asset.checksum_sha256
      or submitted."storageBucket" <> 'course-assets'
      or public.course_publication_asset_extension(submitted."mimeType") is null
      or submitted."storagePath" <> concat(
        p_actor_account_id::text,
        '/courses/',
        p_target_course_id::text,
        '/assets/',
        submitted."targetStoredFileId"::text,
        '/',
        submitted."targetStoredFileId"::text,
        '.',
        public.course_publication_asset_extension(submitted."mimeType")
      )
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = 'course-assets'
          and object.name = submitted."storagePath"
      )
  ) then
    raise exception 'course_publication_clone_asset_manifest_mismatch'
      using errcode = '23514';
  end if;

  select coalesce(
    jsonb_object_agg(
      asset."publicationAssetId"::text,
      to_jsonb(asset."targetStoredFileId"::text)
    ),
    '{}'::jsonb
  )
  into v_asset_id_map
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "targetStoredFileId" uuid
  );

  insert into public.course (
    id,
    owner_account_id,
    title,
    subject,
    goal,
    level,
    audience_description,
    target_lesson_count,
    teacher_preferences,
    audience_type,
    settings,
    assembled_at,
    archived_at,
    created_at,
    updated_at
  )
  values (
    p_target_course_id,
    p_actor_account_id,
    coalesce(
      btrim(p_target_title),
      v_revision.snapshot -> 'course' ->> 'title'
    ),
    v_revision.snapshot -> 'course' ->> 'subject',
    v_revision.snapshot -> 'course' ->> 'goal',
    v_revision.snapshot -> 'course' ->> 'level',
    v_revision.snapshot -> 'course' ->> 'audienceDescription',
    (v_revision.snapshot -> 'course' ->> 'targetLessonCount')::integer,
    '',
    'none',
    '{}'::jsonb,
    clock_timestamp(),
    null,
    clock_timestamp(),
    clock_timestamp()
  );

  insert into public.stored_file (
    id,
    owner_account_id,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    checksum_sha256,
    status,
    metadata,
    created_at,
    updated_at
  )
  select
    asset."targetStoredFileId",
    p_actor_account_id,
    'course-assets',
    asset."storagePath",
    asset."originalFilename",
    asset."mimeType",
    asset."sizeBytes",
    asset."checksumSha256",
    'ready',
    jsonb_build_object(
      'coursePublicationId', p_publication_id,
      'coursePublicationRevisionId', v_revision.id,
      'coursePublicationAssetId', asset."publicationAssetId"
    ),
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "targetStoredFileId" uuid,
    "originalFilename" text,
    "mimeType" text,
    "sizeBytes" bigint,
    "checksumSha256" text,
    "storageBucket" text,
    "storagePath" text
  );

  insert into public.course_attachment (
    course_id,
    stored_file_id,
    created_at,
    updated_at
  )
  select
    p_target_course_id,
    asset."targetStoredFileId",
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "targetStoredFileId" uuid
  );

  insert into public.lesson (
    id,
    course_id,
    position,
    title,
    summary,
    estimated_duration_minutes,
    settings,
    created_at,
    updated_at
  )
  select
    lesson_map.id,
    p_target_course_id,
    submitted.position,
    submitted.title,
    submitted.summary,
    submitted."estimatedDurationMinutes",
    '{}'::jsonb,
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(v_revision.snapshot -> 'lessons') as submitted(
    ref uuid,
    position integer,
    title text,
    summary text,
    "estimatedDurationMinutes" integer,
    components jsonb,
    slides jsonb
  )
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = submitted.ref;

  insert into public.lesson_student_slide (
    id,
    lesson_id,
    position,
    created_at,
    updated_at
  )
  select
    slide_map.id,
    lesson_map.id,
    submitted_slide.position,
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(v_revision.snapshot -> 'lessons') as submitted_lesson(
    ref uuid,
    components jsonb,
    slides jsonb
  )
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = submitted_lesson.ref
  cross join lateral jsonb_to_recordset(submitted_lesson.slides)
    as submitted_slide(ref uuid, position integer)
  join jsonb_to_recordset(p_id_map -> 'slides') as slide_map(
    ref uuid,
    id uuid
  ) on slide_map.ref = submitted_slide.ref;

  insert into public.lesson_component (
    id,
    lesson_id,
    position,
    type_key,
    schema_version,
    payload,
    placement_config,
    visibility,
    student_slide_id,
    created_at,
    updated_at
  )
  select
    component_map.id,
    lesson_map.id,
    submitted_component.position,
    submitted_component."typeKey",
    submitted_component."schemaVersion",
    public.remap_course_publication_component_assets(
      submitted_component."typeKey",
      submitted_component.payload,
      v_asset_id_map
    ),
    submitted_component.placement,
    submitted_component.visibility,
    case
      when submitted_component.visibility = 'learner_visible'
        then slide_map.id
      else null
    end,
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(v_revision.snapshot -> 'lessons') as submitted_lesson(
    ref uuid,
    components jsonb,
    slides jsonb
  )
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = submitted_lesson.ref
  cross join lateral jsonb_to_recordset(submitted_lesson.components)
    as submitted_component(
      ref uuid,
      position integer,
      "typeKey" text,
      "schemaVersion" integer,
      payload jsonb,
      placement jsonb,
      visibility text,
      "studentSlideRef" uuid
    )
  join jsonb_to_recordset(p_id_map -> 'components') as component_map(
    ref uuid,
    id uuid
  ) on component_map.ref = submitted_component.ref
  left join jsonb_to_recordset(p_id_map -> 'slides') as slide_map(
    ref uuid,
    id uuid
  ) on slide_map.ref = submitted_component."studentSlideRef";

  insert into public.course_publication_origin (
    course_id,
    publication_id,
    revision_id,
    created_at
  )
  values (
    p_target_course_id,
    p_publication_id,
    v_revision.id,
    clock_timestamp()
  );

  return jsonb_build_object('courseId', p_target_course_id);
end
$$;

revoke all on function public.clone_course_publication_admin(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.clone_course_publication_admin(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb
) to postgres, service_role;

-- -----------------------------------------------------------------------------
-- Same-owner duplicate. Unlike a catalog clone, it keeps the complete authored
-- working graph and teacher preferences and safely reuses owner StoredFiles.
-- Audience assignments, runs/history and publication provenance are excluded.
-- -----------------------------------------------------------------------------

create function public.duplicate_course_admin(
  p_actor_account_id uuid,
  p_source_course_id uuid,
  p_target_course_id uuid,
  p_target_title text,
  p_id_map jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source_course public.course%rowtype;
  v_lesson_count integer;
  v_component_count integer;
  v_slide_count integer;
begin
  if p_actor_account_id is null
    or p_source_course_id is null
    or p_target_course_id is null
    or (
      p_target_title is not null
      and (
        btrim(p_target_title) = ''
        or char_length(btrim(p_target_title)) > 160
      )
    )
    or p_id_map is null
    or jsonb_typeof(p_id_map) <> 'object'
  then
    raise exception 'course_duplicate_invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.account as account
  where account.id = p_actor_account_id
    and account.status = 'active'
  for update;

  if not found then
    raise exception 'course_duplicate_actor_not_active'
      using errcode = '42501';
  end if;

  select course.*
  into v_source_course
  from public.course as course
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
  for update;

  if not found then
    raise exception 'course_duplicate_source_not_found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.course as course
    where course.id = p_target_course_id
  ) then
    raise exception 'course_duplicate_target_id_conflict'
      using errcode = '23505';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.course_id = p_source_course_id
  order by lesson.id
  for update;

  perform 1
  from public.lesson_student_slide as slide
  join public.lesson as lesson on lesson.id = slide.lesson_id
  where lesson.course_id = p_source_course_id
  order by slide.id
  for update of slide;

  perform 1
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  where lesson.course_id = p_source_course_id
  order by component.id
  for update of component;

  perform 1
  from public.course_attachment as attachment
  where attachment.course_id = p_source_course_id
  order by attachment.id
  for update;

  if exists (
    select 1
    from public.course_attachment as attachment
    join public.stored_file as stored_file
      on stored_file.id = attachment.stored_file_id
    where attachment.course_id = p_source_course_id
      and stored_file.owner_account_id <> p_actor_account_id
  ) then
    raise exception 'course_duplicate_attachment_owner_mismatch'
      using errcode = '42501';
  end if;

  if (p_id_map - array['lessons', 'components', 'slides']) <> '{}'::jsonb
    or jsonb_typeof(p_id_map -> 'lessons') <> 'array'
    or jsonb_typeof(p_id_map -> 'components') <> 'array'
    or jsonb_typeof(p_id_map -> 'slides') <> 'array'
  then
    raise exception 'course_duplicate_id_map_shape_invalid'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'components') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) then
    raise exception 'course_duplicate_id_map_shape_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_lesson_count
  from public.lesson as lesson
  where lesson.course_id = p_source_course_id;

  select count(*)::integer
  into v_component_count
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  where lesson.course_id = p_source_course_id;

  select count(*)::integer
  into v_slide_count
  from public.lesson_student_slide as slide
  join public.lesson as lesson on lesson.id = slide.lesson_id
  where lesson.course_id = p_source_course_id;

  if jsonb_array_length(p_id_map -> 'lessons') <> v_lesson_count
    or jsonb_array_length(p_id_map -> 'components') <> v_component_count
    or jsonb_array_length(p_id_map -> 'slides') <> v_slide_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    ) <> v_lesson_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    ) <> v_lesson_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
    ) <> v_component_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
    ) <> v_component_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    ) <> v_slide_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    ) <> v_slide_count
  then
    raise exception 'course_duplicate_id_map_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.lesson as source_lesson
    where source_lesson.course_id = p_source_course_id
      and not exists (
        select 1
        from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
        where (item.value ->> 'ref')::uuid = source_lesson.id
      )
  ) or exists (
    select 1
    from public.lesson_component as source_component
    join public.lesson as source_lesson
      on source_lesson.id = source_component.lesson_id
    where source_lesson.course_id = p_source_course_id
      and not exists (
        select 1
        from jsonb_array_elements(p_id_map -> 'components') as item(value)
        where (item.value ->> 'ref')::uuid = source_component.id
      )
  ) or exists (
    select 1
    from public.lesson_student_slide as source_slide
    join public.lesson as source_lesson
      on source_lesson.id = source_slide.lesson_id
    where source_lesson.course_id = p_source_course_id
      and not exists (
        select 1
        from jsonb_array_elements(p_id_map -> 'slides') as item(value)
        where (item.value ->> 'ref')::uuid = source_slide.id
      )
  ) then
    raise exception 'course_duplicate_id_map_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    join public.lesson as lesson
      on lesson.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'components') as item(value)
    join public.lesson_component as component
      on component.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    join public.lesson_student_slide as slide
      on slide.id = (item.value ->> 'id')::uuid
  ) then
    raise exception 'course_duplicate_target_id_conflict'
      using errcode = '23505';
  end if;

  insert into public.course (
    id,
    owner_account_id,
    title,
    subject,
    goal,
    level,
    audience_description,
    target_lesson_count,
    teacher_preferences,
    audience_type,
    settings,
    assembled_at,
    archived_at,
    created_at,
    updated_at
  )
  values (
    p_target_course_id,
    p_actor_account_id,
    coalesce(
      btrim(p_target_title),
      concat(left(v_source_course.title, 150), ' — копия')
    ),
    v_source_course.subject,
    v_source_course.goal,
    v_source_course.level,
    v_source_course.audience_description,
    v_source_course.target_lesson_count,
    v_source_course.teacher_preferences,
    'none',
    v_source_course.settings,
    v_source_course.assembled_at,
    null,
    clock_timestamp(),
    clock_timestamp()
  );

  insert into public.course_attachment (
    course_id,
    stored_file_id,
    created_at,
    updated_at
  )
  select
    p_target_course_id,
    source_attachment.stored_file_id,
    clock_timestamp(),
    clock_timestamp()
  from public.course_attachment as source_attachment
  where source_attachment.course_id = p_source_course_id;

  insert into public.lesson (
    id,
    course_id,
    position,
    title,
    summary,
    estimated_duration_minutes,
    settings,
    created_at,
    updated_at
  )
  select
    lesson_map.id,
    p_target_course_id,
    source_lesson.position,
    source_lesson.title,
    source_lesson.summary,
    source_lesson.estimated_duration_minutes,
    source_lesson.settings,
    clock_timestamp(),
    clock_timestamp()
  from public.lesson as source_lesson
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = source_lesson.id
  where source_lesson.course_id = p_source_course_id;

  insert into public.lesson_student_slide (
    id,
    lesson_id,
    position,
    created_at,
    updated_at
  )
  select
    slide_map.id,
    lesson_map.id,
    source_slide.position,
    clock_timestamp(),
    clock_timestamp()
  from public.lesson_student_slide as source_slide
  join public.lesson as source_lesson
    on source_lesson.id = source_slide.lesson_id
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = source_lesson.id
  join jsonb_to_recordset(p_id_map -> 'slides') as slide_map(
    ref uuid,
    id uuid
  ) on slide_map.ref = source_slide.id
  where source_lesson.course_id = p_source_course_id;

  insert into public.lesson_component (
    id,
    lesson_id,
    position,
    type_key,
    schema_version,
    payload,
    placement_config,
    visibility,
    student_slide_id,
    created_at,
    updated_at
  )
  select
    component_map.id,
    lesson_map.id,
    source_component.position,
    source_component.type_key,
    source_component.schema_version,
    source_component.payload,
    source_component.placement_config,
    source_component.visibility,
    slide_map.id,
    clock_timestamp(),
    clock_timestamp()
  from public.lesson_component as source_component
  join public.lesson as source_lesson
    on source_lesson.id = source_component.lesson_id
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = source_lesson.id
  join jsonb_to_recordset(p_id_map -> 'components') as component_map(
    ref uuid,
    id uuid
  ) on component_map.ref = source_component.id
  left join jsonb_to_recordset(p_id_map -> 'slides') as slide_map(
    ref uuid,
    id uuid
  ) on slide_map.ref = source_component.student_slide_id
  where source_lesson.course_id = p_source_course_id;

  return jsonb_build_object('courseId', p_target_course_id);
end
$$;

revoke all on function public.duplicate_course_admin(
  uuid,
  uuid,
  uuid,
  text,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.duplicate_course_admin(
  uuid,
  uuid,
  uuid,
  text,
  jsonb
) to postgres, service_role;

notify pgrst, 'reload schema';

commit;
