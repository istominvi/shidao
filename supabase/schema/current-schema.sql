-- CURRENT SCHEMA SNAPSHOT (post-migration reference)
-- -----------------------------------------------------------------------------
-- Public DDL below was generated from an isolated clone of the live ShiDao
-- schema after applying migrations through
-- 20260804044955_add_lesson_student_slides.sql.
-- It includes active public tables, types, functions, constraints, indexes,
-- triggers, RLS policies, grants, and default privileges. The final section
-- records Course Builder's unchanged cross-schema Auth/Storage objects.
--
-- This file is read-only developer/agent context, not migration history.
-- Canonical forward history remains in supabase/migrations/*.
-- -----------------------------------------------------------------------------

--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: guardian_relation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.guardian_relation AS ENUM (
    'mother',
    'father',
    'guardian',
    'other'
);


--
-- Name: guardian_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.guardian_status AS ENUM (
    'invited',
    'active',
    'revoked'
);


--
-- Name: assemble_course_draft(uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assemble_course_draft(p_course_id uuid, p_lesson_title text, p_lesson_summary text, p_components jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_assembled_at timestamptz;
  v_lesson_id uuid;
  v_component_id uuid;
  v_component jsonb;
  v_position integer := 0;
  v_lesson_ids uuid[] := '{}'::uuid[];
  v_component_ids uuid[] := '{}'::uuid[];
begin
  if p_components is null or jsonb_typeof(p_components) <> 'array' then
    raise exception
      'course_components_must_be_array'
      using errcode = '22023';
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
    select coalesce(
      array_agg(lesson.id order by lesson.position),
      '{}'::uuid[]
    )
    into v_lesson_ids
    from public.lesson
    where lesson.course_id = p_course_id;

    select coalesce(
      array_agg(
        component.id
        order by lesson.position, component.position
      ),
      '{}'::uuid[]
    )
    into v_component_ids
    from public.lesson_component as component
    join public.lesson on lesson.id = component.lesson_id
    where lesson.course_id = p_course_id;

    return jsonb_build_object(
      'courseId', p_course_id,
      'lessonIds', to_jsonb(v_lesson_ids),
      'componentIds', to_jsonb(v_component_ids),
      'alreadyAssembled', true
    );
  end if;

  if exists (
    select 1
    from public.lesson
    where lesson.course_id = p_course_id
  ) then
    raise exception
      'course_contains_manual_content'
      using errcode = '23505';
  end if;

  insert into public.lesson (course_id, position, title, summary)
  values (p_course_id, 1, p_lesson_title, p_lesson_summary)
  returning id into v_lesson_id;

  for v_component in
    select component.value
    from jsonb_array_elements(p_components) as component(value)
  loop
    v_position := v_position + 1;

    insert into public.lesson_component (
      lesson_id,
      position,
      type_key,
      schema_version,
      payload,
      placement_config
    )
    values (
      v_lesson_id,
      v_position,
      v_component ->> 'typeKey',
      (v_component ->> 'schemaVersion')::integer,
      v_component -> 'payload',
      v_component -> 'placement'
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
    'componentIds', to_jsonb(v_component_ids),
    'alreadyAssembled', false
  );
end
$$;


--
-- Name: can_read_class(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_class(p_class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.is_class_teacher(p_class_id)
      or public.is_class_student(p_class_id)
      or public.parent_in_class(p_class_id);
$$;


--
-- Name: clear_user_pin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_user_pin(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: compact_course_lesson_positions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compact_course_lesson_positions() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  update public.lesson
  set position = position - 1
  where course_id = old.course_id
    and position > old.position;
  return old;
end
$$;


--
-- Name: compact_lesson_component_positions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compact_lesson_component_positions() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if not exists (
    select 1
    from public.lesson as lesson
    where lesson.id = old.lesson_id
  ) then
    return old;
  end if;

  update public.lesson_component
  set position = position - 1
  where lesson_id = old.lesson_id
    and position > old.position;
  return old;
end
$$;


--
-- Name: cleanup_empty_lesson_student_slide(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_empty_lesson_student_slide() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if old.student_slide_id is null
    or not exists (
      select 1 from public.lesson where lesson.id = old.lesson_id
    )
  then
    return old;
  end if;

  delete from public.lesson_student_slide as slide
  where slide.id = old.student_slide_id
    and slide.lesson_id = old.lesson_id
    and not exists (
      select 1
      from public.lesson_component as component
      where component.student_slide_id = slide.id
        and component.visibility = 'learner_visible'
    );

  if found then
    with ordered as (
      select
        slide.id,
        row_number() over (order by slide.position, slide.id)::integer
          as new_position
      from public.lesson_student_slide as slide
      where slide.lesson_id = old.lesson_id
    )
    update public.lesson_student_slide as slide
    set position = ordered.new_position
    from ordered
    where slide.id = ordered.id
      and slide.position <> ordered.new_position;
  end if;

  return old;
end
$$;


--
-- Name: enforce_lesson_student_screen_invariants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_lesson_student_screen_invariants() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_lesson_id uuid;
begin
  for v_lesson_id in
    select distinct candidate.lesson_id
    from (
      select case when tg_op <> 'DELETE' then new.lesson_id end as lesson_id
      union all
      select case when tg_op <> 'INSERT' then old.lesson_id end
    ) as candidate
    where candidate.lesson_id is not null
  loop
    if not exists (
      select 1 from public.lesson where lesson.id = v_lesson_id
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.lesson_component as component
      left join public.lesson_student_slide as slide
        on slide.id = component.student_slide_id
      where component.lesson_id = v_lesson_id
        and (
          (component.visibility = 'staff_only'
            and component.student_slide_id is not null)
          or
          (component.visibility = 'learner_visible'
            and (
              component.student_slide_id is null
              or slide.id is null
              or slide.lesson_id <> component.lesson_id
            ))
        )
    ) then
      raise exception
        'lesson_student_screen_assignment_inconsistent'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.lesson_student_slide as slide
      where slide.lesson_id = v_lesson_id
        and not exists (
          select 1
          from public.lesson_component as component
          where component.student_slide_id = slide.id
            and component.visibility = 'learner_visible'
        )
    ) then
      raise exception
        'lesson_student_screen_contains_empty_slide'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.lesson_student_slide as slide
      where slide.lesson_id = v_lesson_id
      group by slide.lesson_id
      having min(slide.position) <> 1
        or max(slide.position) <> count(*)
        or count(distinct slide.position) <> count(*)
    ) then
      raise exception
        'lesson_student_slide_positions_are_not_dense'
        using errcode = '23514';
    end if;

    if exists (
      with visible_components as (
        select
          component.position,
          slide.position as slide_position,
          lag(slide.position) over (
            order by component.position
          ) as previous_slide_position
        from public.lesson_component as component
        join public.lesson_student_slide as slide
          on slide.id = component.student_slide_id
        where component.lesson_id = v_lesson_id
          and component.visibility = 'learner_visible'
      )
      select 1
      from visible_components
      where previous_slide_position > slide_position
    ) then
      raise exception
        'lesson_student_slide_order_conflict'
        using errcode = '23514';
    end if;
  end loop;

  return null;
end
$$;


--
-- Name: current_account_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_account_id() RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select account.id
  from public.account
  where account.auth_user_id = (select auth.uid())
  limit 1;
$$;


--
-- Name: current_parent_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_parent_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id from public.parent p where p.user_id = auth.uid() limit 1;
$$;


--
-- Name: current_session_invalid_before(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_session_invalid_before() RETURNS timestamp with time zone
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select security.sessions_invalid_before
  from public.user_security as security
  where security.user_id = (select auth.uid())
  limit 1;
$$;


--
-- Name: current_student_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_student_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.id from public.student s where s.user_id = auth.uid() limit 1;
$$;


--
-- Name: current_teacher_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_teacher_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select t.id from public.teacher t where t.user_id = auth.uid() limit 1;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: user_preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preference (
    user_id uuid NOT NULL,
    last_active_profile text,
    last_selected_school_id uuid,
    theme text,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_preference_last_active_profile_check CHECK ((last_active_profile = ANY (ARRAY['parent'::text, 'teacher'::text])))
);


--
-- Name: TABLE user_preference; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_preference IS 'Persistent user UI preferences and routing hints.';


--
-- Name: COLUMN user_preference.last_active_profile; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_preference.last_active_profile IS 'Last active adult cabinet profile.';


--
-- Name: COLUMN user_preference.last_selected_school_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_preference.last_selected_school_id IS 'Last selected school for future multi-school UX.';


--
-- Name: ensure_user_preference(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_preference(p_user_id uuid) RETURNS public.user_preference
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: user_security; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_security (
    user_id uuid NOT NULL,
    pin_hash text,
    pin_failed_attempts integer DEFAULT 0 NOT NULL,
    pin_locked_until timestamp with time zone,
    pin_created_at timestamp with time zone,
    pin_updated_at timestamp with time zone,
    last_pin_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sessions_invalid_before timestamp with time zone
);


--
-- Name: TABLE user_security; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_security IS 'Security settings: hashed PIN and lock state.';


--
-- Name: COLUMN user_security.sessions_invalid_before; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_security.sessions_invalid_before IS 'App sessions whose issued-at (iat) precedes this instant are treated as revoked. Null = no revocation.';


--
-- Name: ensure_user_security(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_security(p_user_id uuid) RETURNS public.user_security
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: get_last_active_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_last_active_profile(p_user_id uuid) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select up.last_active_profile
  from public.user_preference up
  where up.user_id = p_user_id;
$$;


--
-- Name: handle_auth_user_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_auth_user_account() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: is_class_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_class_student(p_class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.class_student cs
    where cs.class_id = p_class_id and cs.student_id = public.current_student_id()
  );
$$;


--
-- Name: is_class_teacher(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_class_teacher(p_class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.class_teacher ct
    where ct.class_id = p_class_id and ct.teacher_id = public.current_teacher_id()
  );
$$;


--
-- Name: is_my_child(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_my_child(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.student s
    where s.id = p_student_id and s.parent_id = public.current_parent_id()
  );
$$;


--
-- Name: merge_user_settings(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_user_settings(p_user_id uuid, p_settings jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.ensure_user_preference(p_user_id);

  update public.user_preference
  set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_settings, '{}'::jsonb),
      updated_at = now()
  where user_id = p_user_id;
end
$$;


--
-- Name: onboard_parent(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.onboard_parent(p_user_id uuid, p_full_name text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_parent_id uuid;
begin
  insert into public.parent (user_id, full_name)
  values (p_user_id, p_full_name)
  on conflict (user_id) do update
    set full_name = coalesce(excluded.full_name, public.parent.full_name),
        updated_at = now()
  returning id into v_parent_id;

  return v_parent_id;
end
$$;


--
-- Name: onboard_teacher(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.onboard_teacher(p_user_id uuid, p_full_name text DEFAULT NULL::text) RETURNS TABLE(teacher_id uuid, school_id uuid, class_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_teacher_id uuid;
  v_school_id uuid;
  v_class_id uuid;
  base_slug text;
  slug_candidate text;
  i integer;
begin
  insert into public.teacher (user_id, full_name)
  values (p_user_id, p_full_name)
  on conflict (user_id) do update
    set full_name = coalesce(excluded.full_name, public.teacher.full_name),
        updated_at = now()
  returning id into v_teacher_id;

  select st.school_id into v_school_id
  from public.school_teacher st
  where st.teacher_id = v_teacher_id
  order by case when st.role = 'owner' then 0 else 1 end, st.created_at
  limit 1;

  if v_school_id is null then
    base_slug := lower(regexp_replace(coalesce(nullif(p_full_name, ''), 'teacher') || '-' || left(v_teacher_id::text, 8), '[^a-z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then
      base_slug := 'school-' || left(v_teacher_id::text, 8);
    end if;

    slug_candidate := base_slug;
    i := 1;
    while exists (select 1 from public.school s where s.slug = slug_candidate) loop
      i := i + 1;
      slug_candidate := base_slug || '-' || i::text;
    end loop;

    insert into public.school (name, slug)
    values (coalesce(nullif(p_full_name, ''), 'Преподаватель') || ' — школа', slug_candidate)
    returning id into v_school_id;

    insert into public.school_teacher (school_id, teacher_id, role)
    values (v_school_id, v_teacher_id, 'owner')
    on conflict (school_id, teacher_id) do update set role = 'owner';
  end if;

  select c.id into v_class_id
  from public."class" c
  where c.school_id = v_school_id
  order by c.created_at asc, c.id asc
  limit 1;

  if v_class_id is null then
    insert into public."class" (school_id, name)
    values (v_school_id, 'Основной класс')
    returning id into v_class_id;
  end if;

  insert into public.class_teacher (class_id, teacher_id)
  values (v_class_id, v_teacher_id)
  on conflict (class_id, teacher_id) do nothing;

  return query select v_teacher_id, v_school_id, v_class_id;
end
$$;


--
-- Name: parent_in_class(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.parent_in_class(p_class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.class_student cs
    join public.student s on s.id = cs.student_id
    where cs.class_id = p_class_id and s.parent_id = public.current_parent_id()
  );
$$;


--
-- Name: parent_in_school(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.parent_in_school(p_school_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.class_student cs
    join public.student s on s.id = cs.student_id
    join public.class c on c.id = cs.class_id
    where c.school_id = p_school_id and s.parent_id = public.current_parent_id()
  );
$$;


--
-- Name: set_lesson_component_student_screen(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_lesson_component_student_screen(p_component_id uuid, p_mode text, p_slide_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, lesson_id uuid, type_key text, schema_version integer, "position" integer, payload jsonb, placement_config jsonb, visibility text, student_slide_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
AS $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_component_position integer;
  v_previous_slide_position integer;
  v_next_slide_position integer;
  v_target_slide_position integer;
  v_target_slide_id uuid;
  v_insert_position integer;
begin
  if v_actor_user_id is null then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  if p_mode is null or p_mode not in ('hide', 'existing', 'new') then
    raise exception
      'student_screen_mode_invalid'
      using errcode = '22023';
  end if;

  if (p_mode = 'existing' and p_slide_id is null)
    or (p_mode <> 'existing' and p_slide_id is not null)
  then
    raise exception
      'student_screen_slide_argument_invalid'
      using errcode = '22023';
  end if;

  select component.lesson_id
  into v_lesson_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  -- Parent-row serialization gives assignment and reorder one lock order per
  -- Lesson, including when callers target different components.
  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update;

  perform 1
  from public.lesson_student_slide as slide
  where slide.lesson_id = v_lesson_id
  order by slide.id
  for update;

  select component.position
  into v_component_position
  from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  if p_mode = 'hide' then
    update public.lesson_component as component
    set visibility = 'staff_only',
        student_slide_id = null
    where component.id = p_component_id;
  else
    select slide.position
    into v_previous_slide_position
    from public.lesson_component as component
    join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where component.lesson_id = v_lesson_id
      and component.id <> p_component_id
      and component.visibility = 'learner_visible'
      and component.position < v_component_position
    order by component.position desc
    limit 1;

    select slide.position
    into v_next_slide_position
    from public.lesson_component as component
    join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where component.lesson_id = v_lesson_id
      and component.id <> p_component_id
      and component.visibility = 'learner_visible'
      and component.position > v_component_position
    order by component.position
    limit 1;

    if p_mode = 'existing' then
      select slide.position
      into v_target_slide_position
      from public.lesson_student_slide as slide
      where slide.id = p_slide_id
        and slide.lesson_id = v_lesson_id;

      if not found then
        raise exception
          'student_slide_not_found'
          using errcode = 'P0002';
      end if;

      if (
        v_previous_slide_position is not null
        and v_target_slide_position < v_previous_slide_position
      ) or (
        v_next_slide_position is not null
        and v_target_slide_position > v_next_slide_position
      ) then
        raise exception
          'student_slide_target_out_of_order'
          using errcode = '23514';
      end if;

      v_target_slide_id := p_slide_id;
    else
      if v_previous_slide_position is not null
        and v_next_slide_position is not null
        and v_previous_slide_position = v_next_slide_position
      then
        raise exception
          'student_slide_cannot_split_group'
          using errcode = '23514';
      end if;

      v_insert_position := case
        when v_next_slide_position is not null
          then v_next_slide_position
        when v_previous_slide_position is not null
          then v_previous_slide_position + 1
        else 1
      end;

      update public.lesson_student_slide as slide
      set position = slide.position + 1
      where slide.lesson_id = v_lesson_id
        and slide.position >= v_insert_position;

      insert into public.lesson_student_slide as inserted_slide (
        lesson_id,
        position
      )
      values (v_lesson_id, v_insert_position)
      returning inserted_slide.id into v_target_slide_id;
    end if;

    update public.lesson_component as component
    set visibility = 'learner_visible',
        student_slide_id = v_target_slide_id
    where component.id = p_component_id;
  end if;

  return query
  select
    component.id,
    component.lesson_id,
    component.type_key,
    component.schema_version,
    component.position,
    component.payload,
    component.placement_config,
    component.visibility,
    component.student_slide_id,
    component.created_at,
    component.updated_at
  from public.lesson_component as component
  where component.id = p_component_id;
end
$$;


--
-- Name: reorder_lesson_component(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_lesson_component(p_component_id uuid, p_new_position integer) RETURNS TABLE(id uuid, lesson_id uuid, type_key text, schema_version integer, "position" integer, payload jsonb, placement_config jsonb, visibility text, student_slide_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
AS $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_old_position integer;
  v_component_count integer;
  v_visibility text;
  v_student_slide_id uuid;
  v_current_slide_position integer;
  v_previous_slide_position integer;
  v_next_slide_position integer;
  v_clamped_slide_position integer;
  v_clamped_slide_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  if p_new_position is null or p_new_position < 1 then
    raise exception
      'component_position_out_of_range'
      using errcode = '22023';
  end if;

  select component.lesson_id
  into v_lesson_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update;

  perform 1
  from public.lesson_student_slide as slide
  where slide.lesson_id = v_lesson_id
  order by slide.id
  for update;

  select
    component.position,
    component.visibility,
    component.student_slide_id
  into v_old_position, v_visibility, v_student_slide_id
  from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into v_component_count
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id;

  if p_new_position > v_component_count then
    raise exception
      'component_position_out_of_range'
      using errcode = '22023';
  end if;

  if p_new_position < v_old_position then
    update public.lesson_component as component
    set position = component.position + 1
    where component.lesson_id = v_lesson_id
      and component.position >= p_new_position
      and component.position < v_old_position;
  elsif p_new_position > v_old_position then
    update public.lesson_component as component
    set position = component.position - 1
    where component.lesson_id = v_lesson_id
      and component.position > v_old_position
      and component.position <= p_new_position;
  end if;

  update public.lesson_component as component
  set position = p_new_position
  where component.id = p_component_id;

  if v_visibility = 'learner_visible' then
    select slide.position
    into v_current_slide_position
    from public.lesson_student_slide as slide
    where slide.id = v_student_slide_id
      and slide.lesson_id = v_lesson_id;

    select slide.position
    into v_previous_slide_position
    from public.lesson_component as component
    join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where component.lesson_id = v_lesson_id
      and component.id <> p_component_id
      and component.visibility = 'learner_visible'
      and component.position < p_new_position
    order by component.position desc
    limit 1;

    select slide.position
    into v_next_slide_position
    from public.lesson_component as component
    join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where component.lesson_id = v_lesson_id
      and component.id <> p_component_id
      and component.visibility = 'learner_visible'
      and component.position > p_new_position
    order by component.position
    limit 1;

    v_clamped_slide_position := v_current_slide_position;

    if v_previous_slide_position is not null
      and v_clamped_slide_position < v_previous_slide_position
    then
      v_clamped_slide_position := v_previous_slide_position;
    end if;

    if v_next_slide_position is not null
      and v_clamped_slide_position > v_next_slide_position
    then
      v_clamped_slide_position := v_next_slide_position;
    end if;

    if v_clamped_slide_position <> v_current_slide_position then
      select slide.id
      into v_clamped_slide_id
      from public.lesson_student_slide as slide
      where slide.lesson_id = v_lesson_id
        and slide.position = v_clamped_slide_position;

      update public.lesson_component as component
      set student_slide_id = v_clamped_slide_id
      where component.id = p_component_id;
    end if;
  end if;

  return query
  select
    component.id,
    component.lesson_id,
    component.type_key,
    component.schema_version,
    component.position,
    component.payload,
    component.placement_config,
    component.visibility,
    component.student_slide_id,
    component.created_at,
    component.updated_at
  from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;
end
$$;


--
-- Name: delete_lesson_component(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_lesson_component(p_component_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
AS $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_deleted_count integer;
begin
  if v_actor_user_id is null then
    return false;
  end if;

  select component.lesson_id
  into v_lesson_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    return false;
  end if;

  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    return false;
  end if;

  perform 1
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update;

  perform 1
  from public.lesson_student_slide as slide
  where slide.lesson_id = v_lesson_id
  order by slide.id
  for update;

  delete from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count = 1;
end
$$;


--
-- Name: reset_pin_attempts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_pin_attempts(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.ensure_user_security(p_user_id);

  update public.user_security
  set pin_failed_attempts = 0,
      pin_locked_until = null,
      updated_at = now()
  where user_id = p_user_id;
end
$$;


--
-- Name: revoke_user_sessions(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_user_sessions(p_user_id uuid, p_cutoff timestamp with time zone DEFAULT now()) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: set_last_active_profile(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_last_active_profile(p_user_id uuid, p_profile text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.ensure_user_preference(p_user_id);

  update public.user_preference
  set last_active_profile = p_profile,
      updated_at = now()
  where user_id = p_user_id;
end
$$;


--
-- Name: set_last_selected_school(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_last_selected_school(p_user_id uuid, p_school_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.ensure_user_preference(p_user_id);

  update public.user_preference
  set last_selected_school_id = p_school_id,
      updated_at = now()
  where user_id = p_user_id;
end
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_user_pin(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_pin(p_user_id uuid, p_raw_pin text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: teaches_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.teaches_student(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.class_student cs
    join public.class_teacher ct on ct.class_id = cs.class_id
    where cs.student_id = p_student_id and ct.teacher_id = public.current_teacher_id()
  );
$$;


--
-- Name: upsert_user_theme(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_user_theme(p_user_id uuid, p_theme text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.ensure_user_preference(p_user_id);

  update public.user_preference
  set theme = p_theme,
      updated_at = now()
  where user_id = p_user_id;
end
$$;


--
-- Name: verify_user_pin(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_user_pin(p_user_id uuid, p_raw_pin text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    display_name text NOT NULL,
    locale text DEFAULT 'ru'::text NOT NULL,
    timezone text DEFAULT 'Europe/Moscow'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_display_name_check CHECK ((btrim(display_name) <> ''::text)),
    CONSTRAINT account_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text])))
);


--
-- Name: class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: class_student; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_student (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    student_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: class_teacher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_teacher (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: course; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_account_id uuid NOT NULL,
    title text NOT NULL,
    subject text,
    goal text,
    level text,
    audience_description text,
    target_lesson_count integer,
    teacher_preferences text,
    audience_type text DEFAULT 'none'::text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    assembled_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_audience_type_check CHECK ((audience_type = 'none'::text)),
    CONSTRAINT course_settings_check CHECK ((jsonb_typeof(settings) = 'object'::text)),
    CONSTRAINT course_target_lesson_count_check CHECK (((target_lesson_count IS NULL) OR (target_lesson_count > 0))),
    CONSTRAINT course_title_check CHECK ((btrim(title) <> ''::text))
);


--
-- Name: course_attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_attachment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    stored_file_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lesson; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    "position" integer NOT NULL,
    title text NOT NULL,
    summary text,
    estimated_duration_minutes integer,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_estimated_duration_minutes_check CHECK (((estimated_duration_minutes IS NULL) OR (estimated_duration_minutes > 0))),
    CONSTRAINT lesson_position_check CHECK (("position" > 0)),
    CONSTRAINT lesson_settings_check CHECK ((jsonb_typeof(settings) = 'object'::text)),
    CONSTRAINT lesson_title_check CHECK ((btrim(title) <> ''::text))
);


--
-- Name: lesson_component; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_component (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_id uuid NOT NULL,
    "position" integer NOT NULL,
    type_key text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    placement_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    visibility text DEFAULT 'staff_only'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    student_slide_id uuid,
    CONSTRAINT lesson_component_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT lesson_component_placement_config_check CHECK ((jsonb_typeof(placement_config) = 'object'::text)),
    CONSTRAINT lesson_component_position_check CHECK (("position" > 0)),
    CONSTRAINT lesson_component_schema_version_check CHECK ((schema_version > 0)),
    CONSTRAINT lesson_component_student_screen_assignment_check CHECK ((((visibility = 'staff_only'::text) AND (student_slide_id IS NULL)) OR ((visibility = 'learner_visible'::text) AND (student_slide_id IS NOT NULL)))),
    CONSTRAINT lesson_component_type_key_check CHECK ((btrim(type_key) <> ''::text)),
    CONSTRAINT lesson_component_visibility_check CHECK ((visibility = ANY (ARRAY['staff_only'::text, 'learner_visible'::text])))
);


--
-- Name: lesson_student_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_student_slide (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_id uuid NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_student_slide_position_check CHECK (("position" > 0))
);


--
-- Name: parent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    timezone text DEFAULT 'Europe/Moscow'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: school; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'personal'::text NOT NULL,
    owner_teacher_id uuid,
    teacher_limit integer DEFAULT 1 NOT NULL,
    plan_code text DEFAULT 'demo'::text NOT NULL,
    subscription_status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT school_kind_check CHECK ((kind = ANY (ARRAY['personal'::text, 'organization'::text]))),
    CONSTRAINT school_teacher_limit_positive_check CHECK ((teacher_limit > 0))
);


--
-- Name: school_teacher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_teacher (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT school_teacher_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'teacher'::text])))
);


--
-- Name: stored_file; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stored_file (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_account_id uuid NOT NULL,
    storage_bucket text DEFAULT 'course-assets'::text NOT NULL,
    storage_path text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    checksum_sha256 text,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stored_file_checksum_sha256_check CHECK (((checksum_sha256 IS NULL) OR (checksum_sha256 ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT stored_file_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT stored_file_mime_type_check CHECK ((btrim(mime_type) <> ''::text)),
    CONSTRAINT stored_file_original_filename_check CHECK ((btrim(original_filename) <> ''::text)),
    CONSTRAINT stored_file_owner_path_check CHECK ((split_part(storage_path, '/'::text, 1) = (owner_account_id)::text)),
    CONSTRAINT stored_file_ready_checksum_check CHECK (((status = 'pending'::text) OR (checksum_sha256 IS NOT NULL))),
    CONSTRAINT stored_file_size_bytes_check CHECK (((size_bytes > 0) AND (size_bytes <= 10485760))),
    CONSTRAINT stored_file_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text]))),
    CONSTRAINT stored_file_storage_bucket_check CHECK ((storage_bucket = 'course-assets'::text)),
    CONSTRAINT stored_file_storage_path_check CHECK ((btrim(storage_path) <> ''::text))
);


--
-- Name: student; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text,
    birth_date date,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    login text NOT NULL,
    parent_id uuid,
    internal_auth_email text
);


--
-- Name: teacher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    timezone text DEFAULT 'Europe/Moscow'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account account_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: class class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_pkey PRIMARY KEY (id);


--
-- Name: class_student class_student_class_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_student
    ADD CONSTRAINT class_student_class_id_student_id_key UNIQUE (class_id, student_id);


--
-- Name: class_student class_student_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_student
    ADD CONSTRAINT class_student_pkey PRIMARY KEY (id);


--
-- Name: class_teacher class_teacher_class_id_teacher_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_teacher
    ADD CONSTRAINT class_teacher_class_id_teacher_id_key UNIQUE (class_id, teacher_id);


--
-- Name: class_teacher class_teacher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_teacher
    ADD CONSTRAINT class_teacher_pkey PRIMARY KEY (id);


--
-- Name: course_attachment course_attachment_course_id_stored_file_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_attachment
    ADD CONSTRAINT course_attachment_course_id_stored_file_id_key UNIQUE (course_id, stored_file_id);


--
-- Name: course_attachment course_attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_attachment
    ADD CONSTRAINT course_attachment_pkey PRIMARY KEY (id);


--
-- Name: course course_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_pkey PRIMARY KEY (id);


--
-- Name: lesson_component lesson_component_lesson_position_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_component
    ADD CONSTRAINT lesson_component_lesson_position_unique UNIQUE (lesson_id, "position") DEFERRABLE INITIALLY DEFERRED;


--
-- Name: lesson_component lesson_component_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_component
    ADD CONSTRAINT lesson_component_pkey PRIMARY KEY (id);


--
-- Name: lesson_student_slide lesson_student_slide_id_lesson_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_student_slide
    ADD CONSTRAINT lesson_student_slide_id_lesson_unique UNIQUE (id, lesson_id);


--
-- Name: lesson_student_slide lesson_student_slide_lesson_position_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_student_slide
    ADD CONSTRAINT lesson_student_slide_lesson_position_unique UNIQUE (lesson_id, "position") DEFERRABLE INITIALLY DEFERRED;


--
-- Name: lesson_student_slide lesson_student_slide_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_student_slide
    ADD CONSTRAINT lesson_student_slide_pkey PRIMARY KEY (id);


--
-- Name: lesson lesson_course_position_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson
    ADD CONSTRAINT lesson_course_position_unique UNIQUE (course_id, "position") DEFERRABLE INITIALLY DEFERRED;


--
-- Name: lesson lesson_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson
    ADD CONSTRAINT lesson_pkey PRIMARY KEY (id);


--
-- Name: school organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: school organization_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
-- Name: parent parent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent
    ADD CONSTRAINT parent_pkey PRIMARY KEY (id);


--
-- Name: parent parent_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent
    ADD CONSTRAINT parent_user_id_key UNIQUE (user_id);


--
-- Name: school_teacher school_teacher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_teacher
    ADD CONSTRAINT school_teacher_pkey PRIMARY KEY (id);


--
-- Name: school_teacher school_teacher_school_id_teacher_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_teacher
    ADD CONSTRAINT school_teacher_school_id_teacher_id_key UNIQUE (school_id, teacher_id);


--
-- Name: stored_file stored_file_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_file
    ADD CONSTRAINT stored_file_pkey PRIMARY KEY (id);


--
-- Name: stored_file stored_file_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_file
    ADD CONSTRAINT stored_file_storage_path_key UNIQUE (storage_path);


--
-- Name: student student_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student
    ADD CONSTRAINT student_profile_pkey PRIMARY KEY (id);


--
-- Name: teacher teacher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher
    ADD CONSTRAINT teacher_pkey PRIMARY KEY (id);


--
-- Name: teacher teacher_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher
    ADD CONSTRAINT teacher_user_id_key UNIQUE (user_id);


--
-- Name: user_preference user_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_pkey PRIMARY KEY (user_id);


--
-- Name: user_security user_security_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_security
    ADD CONSTRAINT user_security_pkey PRIMARY KEY (user_id);


--
-- Name: class_school_name_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX class_school_name_unique_idx ON public.class USING btree (school_id, lower(name));


--
-- Name: class_student_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX class_student_student_id_idx ON public.class_student USING btree (student_id);


--
-- Name: class_teacher_class_teacher_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX class_teacher_class_teacher_unique_idx ON public.class_teacher USING btree (class_id, teacher_id);


--
-- Name: class_teacher_teacher_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX class_teacher_teacher_id_idx ON public.class_teacher USING btree (teacher_id);


--
-- Name: course_attachment_file_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_attachment_file_idx ON public.course_attachment USING btree (stored_file_id);


--
-- Name: course_owner_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_owner_updated_at_idx ON public.course USING btree (owner_account_id, updated_at DESC);


--
-- Name: lesson_component_lesson_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_component_lesson_position_idx ON public.lesson_component USING btree (lesson_id, "position");


--
-- Name: lesson_component_student_slide_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_component_student_slide_id_idx ON public.lesson_component USING btree (student_slide_id) WHERE (student_slide_id IS NOT NULL);


--
-- Name: lesson_component_type_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_component_type_key_idx ON public.lesson_component USING btree (type_key);


--
-- Name: lesson_course_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_course_position_idx ON public.lesson USING btree (course_id, "position");


--
-- Name: school_teacher_school_teacher_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX school_teacher_school_teacher_unique_idx ON public.school_teacher USING btree (school_id, teacher_id);


--
-- Name: school_teacher_teacher_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX school_teacher_teacher_id_idx ON public.school_teacher USING btree (teacher_id);


--
-- Name: stored_file_owner_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stored_file_owner_created_at_idx ON public.stored_file USING btree (owner_account_id, created_at DESC);


--
-- Name: student_internal_auth_email_unique_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX student_internal_auth_email_unique_ci ON public.student USING btree (lower(internal_auth_email));


--
-- Name: student_login_unique_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX student_login_unique_ci ON public.student USING btree (lower(login));


--
-- Name: student_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_parent_id_idx ON public.student USING btree (parent_id);


--
-- Name: teacher_user_id_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX teacher_user_id_unique_idx ON public.teacher USING btree (user_id);


--
-- Name: user_preference_last_active_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_preference_last_active_profile_idx ON public.user_preference USING btree (last_active_profile) WHERE (last_active_profile IS NOT NULL);


--
-- Name: user_preference_last_selected_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_preference_last_selected_school_idx ON public.user_preference USING btree (last_selected_school_id) WHERE (last_selected_school_id IS NOT NULL);


--
-- Name: user_security_pin_locked_until_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_security_pin_locked_until_idx ON public.user_security USING btree (pin_locked_until) WHERE (pin_locked_until IS NOT NULL);


--
-- Name: account trg_account_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_account_updated_at BEFORE UPDATE ON public.account FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: class trg_class_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_class_updated_at BEFORE UPDATE ON public.class FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: course_attachment trg_course_attachment_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_course_attachment_updated_at BEFORE UPDATE ON public.course_attachment FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: course trg_course_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_course_updated_at BEFORE UPDATE ON public.course FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lesson trg_lesson_compact_positions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lesson_compact_positions AFTER DELETE ON public.lesson FOR EACH ROW EXECUTE FUNCTION public.compact_course_lesson_positions();


--
-- Name: lesson_component trg_lesson_component_compact_positions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lesson_component_compact_positions AFTER DELETE ON public.lesson_component FOR EACH ROW EXECUTE FUNCTION public.compact_lesson_component_positions();


--
-- Name: lesson_component trg_lesson_component_cleanup_empty_student_slide; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lesson_component_cleanup_empty_student_slide AFTER DELETE OR UPDATE OF lesson_id, visibility, student_slide_id ON public.lesson_component FOR EACH ROW EXECUTE FUNCTION public.cleanup_empty_lesson_student_slide();


--
-- Name: lesson_component trg_lesson_component_student_screen_invariants; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER trg_lesson_component_student_screen_invariants AFTER INSERT OR DELETE OR UPDATE OF lesson_id, "position", visibility, student_slide_id ON public.lesson_component DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_lesson_student_screen_invariants();


--
-- Name: lesson_component trg_lesson_component_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lesson_component_updated_at BEFORE UPDATE ON public.lesson_component FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lesson_student_slide trg_lesson_student_slide_invariants; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER trg_lesson_student_slide_invariants AFTER INSERT OR DELETE OR UPDATE OF lesson_id, "position" ON public.lesson_student_slide DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_lesson_student_screen_invariants();


--
-- Name: lesson_student_slide trg_lesson_student_slide_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lesson_student_slide_updated_at BEFORE UPDATE ON public.lesson_student_slide FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lesson trg_lesson_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lesson_updated_at BEFORE UPDATE ON public.lesson FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: parent trg_parent_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parent_updated_at BEFORE UPDATE ON public.parent FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: school trg_school_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_school_updated_at BEFORE UPDATE ON public.school FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stored_file trg_stored_file_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stored_file_updated_at BEFORE UPDATE ON public.stored_file FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: student trg_student_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_student_updated_at BEFORE UPDATE ON public.student FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: teacher trg_teacher_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_teacher_updated_at BEFORE UPDATE ON public.teacher FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_preference trg_user_preference_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_preference_updated_at BEFORE UPDATE ON public.user_preference FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_security trg_user_security_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_security_updated_at BEFORE UPDATE ON public.user_security FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: account account_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: class class_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id) ON DELETE CASCADE;


--
-- Name: class_student class_student_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_student
    ADD CONSTRAINT class_student_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class(id) ON DELETE CASCADE;


--
-- Name: class_student class_student_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_student
    ADD CONSTRAINT class_student_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.student(id) ON DELETE CASCADE;


--
-- Name: class_teacher class_teacher_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_teacher
    ADD CONSTRAINT class_teacher_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class(id) ON DELETE CASCADE;


--
-- Name: class_teacher class_teacher_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_teacher
    ADD CONSTRAINT class_teacher_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher(id) ON DELETE CASCADE;


--
-- Name: course_attachment course_attachment_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_attachment
    ADD CONSTRAINT course_attachment_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.course(id) ON DELETE CASCADE;


--
-- Name: course_attachment course_attachment_stored_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_attachment
    ADD CONSTRAINT course_attachment_stored_file_id_fkey FOREIGN KEY (stored_file_id) REFERENCES public.stored_file(id) ON DELETE CASCADE;


--
-- Name: course course_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: lesson_component lesson_component_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_component
    ADD CONSTRAINT lesson_component_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lesson(id) ON DELETE CASCADE;


--
-- Name: lesson_component lesson_component_student_slide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_component
    ADD CONSTRAINT lesson_component_student_slide_id_fkey FOREIGN KEY (student_slide_id, lesson_id) REFERENCES public.lesson_student_slide(id, lesson_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: lesson_student_slide lesson_student_slide_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_student_slide
    ADD CONSTRAINT lesson_student_slide_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lesson(id) ON DELETE CASCADE;


--
-- Name: lesson lesson_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson
    ADD CONSTRAINT lesson_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.course(id) ON DELETE CASCADE;


--
-- Name: parent parent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent
    ADD CONSTRAINT parent_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: school school_owner_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_owner_teacher_id_fkey FOREIGN KEY (owner_teacher_id) REFERENCES public.teacher(id) ON DELETE SET NULL;


--
-- Name: school_teacher school_teacher_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_teacher
    ADD CONSTRAINT school_teacher_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id) ON DELETE CASCADE;


--
-- Name: school_teacher school_teacher_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_teacher
    ADD CONSTRAINT school_teacher_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher(id) ON DELETE CASCADE;


--
-- Name: stored_file stored_file_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_file
    ADD CONSTRAINT stored_file_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: student student_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student
    ADD CONSTRAINT student_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parent(id) ON DELETE SET NULL;


--
-- Name: student student_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student
    ADD CONSTRAINT student_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: teacher teacher_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher
    ADD CONSTRAINT teacher_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_preference user_preference_last_selected_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_last_selected_school_id_fkey FOREIGN KEY (last_selected_school_id) REFERENCES public.school(id) ON DELETE SET NULL;


--
-- Name: user_preference user_preference_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_security user_security_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_security
    ADD CONSTRAINT user_security_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: account; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;

--
-- Name: account account_self_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_self_select ON public.account FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: class; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class ENABLE ROW LEVEL SECURITY;

--
-- Name: class class_parent_context_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_parent_context_select ON public.class FOR SELECT USING (public.parent_in_class(id));


--
-- Name: class_student; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_student ENABLE ROW LEVEL SECURITY;

--
-- Name: class_student class_student_related_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_student_related_select ON public.class_student FOR SELECT USING (((student_id = public.current_student_id()) OR public.is_my_child(student_id) OR public.is_class_teacher(class_id)));


--
-- Name: class_teacher; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_teacher ENABLE ROW LEVEL SECURITY;

--
-- Name: class class_teacher_or_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_teacher_or_student_select ON public.class FOR SELECT USING ((public.is_class_teacher(id) OR public.is_class_student(id)));


--
-- Name: class_teacher class_teacher_self_or_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_teacher_self_or_student_select ON public.class_teacher FOR SELECT USING (((teacher_id = public.current_teacher_id()) OR public.is_class_student(class_id)));


--
-- Name: course; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course ENABLE ROW LEVEL SECURITY;

--
-- Name: course_attachment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_attachment ENABLE ROW LEVEL SECURITY;

--
-- Name: course_attachment course_attachment_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_attachment_owner_all ON public.course_attachment TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.course
  WHERE ((course.id = course_attachment.course_id) AND (course.owner_account_id = ( SELECT public.current_account_id() AS current_account_id))))) AND (EXISTS ( SELECT 1
   FROM public.stored_file
  WHERE ((stored_file.id = course_attachment.stored_file_id) AND (stored_file.owner_account_id = ( SELECT public.current_account_id() AS current_account_id))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.course
  WHERE ((course.id = course_attachment.course_id) AND (course.owner_account_id = ( SELECT public.current_account_id() AS current_account_id))))) AND (EXISTS ( SELECT 1
   FROM public.stored_file
  WHERE ((stored_file.id = course_attachment.stored_file_id) AND (stored_file.owner_account_id = ( SELECT public.current_account_id() AS current_account_id)))))));


--
-- Name: course course_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_owner_all ON public.course TO authenticated USING ((owner_account_id = ( SELECT public.current_account_id() AS current_account_id))) WITH CHECK ((owner_account_id = ( SELECT public.current_account_id() AS current_account_id)));


--
-- Name: lesson; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_component; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_component ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_component lesson_component_course_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_component_course_owner_all ON public.lesson_component TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.lesson
     JOIN public.course ON ((course.id = lesson.course_id)))
  WHERE ((lesson.id = lesson_component.lesson_id) AND (course.owner_account_id = ( SELECT public.current_account_id() AS current_account_id)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.lesson
     JOIN public.course ON ((course.id = lesson.course_id)))
  WHERE ((lesson.id = lesson_component.lesson_id) AND (course.owner_account_id = ( SELECT public.current_account_id() AS current_account_id))))));


--
-- Name: lesson_component lesson_component_staff_only_insert_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_component_staff_only_insert_guard ON public.lesson_component AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (((visibility = 'staff_only'::text) AND (student_slide_id IS NULL)));


--
-- Name: lesson_student_slide; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_student_slide ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_student_slide lesson_student_slide_course_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_student_slide_course_owner_select ON public.lesson_student_slide FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.lesson
     JOIN public.course ON ((course.id = lesson.course_id)))
  WHERE ((lesson.id = lesson_student_slide.lesson_id) AND (course.owner_account_id = ( SELECT public.current_account_id() AS current_account_id))))));


--
-- Name: lesson lesson_course_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_course_owner_all ON public.lesson TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.course
  WHERE ((course.id = lesson.course_id) AND (course.owner_account_id = ( SELECT public.current_account_id() AS current_account_id)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.course
  WHERE ((course.id = lesson.course_id) AND (course.owner_account_id = ( SELECT public.current_account_id() AS current_account_id))))));


--
-- Name: parent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parent ENABLE ROW LEVEL SECURITY;

--
-- Name: parent parent_self_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parent_self_select ON public.parent FOR SELECT USING ((id = public.current_parent_id()));


--
-- Name: parent parent_self_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parent_self_update ON public.parent FOR UPDATE USING ((id = public.current_parent_id())) WITH CHECK ((id = public.current_parent_id()));


--
-- Name: school; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school ENABLE ROW LEVEL SECURITY;

--
-- Name: school school_parent_context_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_parent_context_select ON public.school FOR SELECT USING (public.parent_in_school(id));


--
-- Name: school_teacher; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_teacher ENABLE ROW LEVEL SECURITY;

--
-- Name: school school_teacher_membership_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_teacher_membership_select ON public.school FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.school_teacher st
  WHERE ((st.school_id = school.id) AND (st.teacher_id = public.current_teacher_id())))));


--
-- Name: school_teacher school_teacher_self_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_teacher_self_select ON public.school_teacher FOR SELECT USING ((teacher_id = public.current_teacher_id()));


--
-- Name: stored_file; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stored_file ENABLE ROW LEVEL SECURITY;

--
-- Name: stored_file stored_file_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stored_file_owner_all ON public.stored_file TO authenticated USING ((owner_account_id = ( SELECT public.current_account_id() AS current_account_id))) WITH CHECK ((owner_account_id = ( SELECT public.current_account_id() AS current_account_id)));


--
-- Name: student; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student ENABLE ROW LEVEL SECURITY;

--
-- Name: student student_self_parent_teacher_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_self_parent_teacher_select ON public.student FOR SELECT USING (((user_id = auth.uid()) OR (parent_id = public.current_parent_id()) OR public.teaches_student(id)));


--
-- Name: student student_self_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_self_update ON public.student FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: teacher; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher teacher_self_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_self_select ON public.teacher FOR SELECT USING ((id = public.current_teacher_id()));


--
-- Name: teacher teacher_self_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_self_update ON public.teacher FOR UPDATE USING ((id = public.current_teacher_id())) WITH CHECK ((id = public.current_teacher_id()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION assemble_course_draft(p_course_id uuid, p_lesson_title text, p_lesson_summary text, p_components jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assemble_course_draft(p_course_id uuid, p_lesson_title text, p_lesson_summary text, p_components jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assemble_course_draft(p_course_id uuid, p_lesson_title text, p_lesson_summary text, p_components jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.assemble_course_draft(p_course_id uuid, p_lesson_title text, p_lesson_summary text, p_components jsonb) TO service_role;


--
-- Name: FUNCTION can_read_class(p_class_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_read_class(p_class_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_read_class(p_class_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_read_class(p_class_id uuid) TO service_role;


--
-- Name: FUNCTION clear_user_pin(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.clear_user_pin(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.clear_user_pin(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.clear_user_pin(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION compact_course_lesson_positions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.compact_course_lesson_positions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.compact_course_lesson_positions() TO service_role;


--
-- Name: FUNCTION compact_lesson_component_positions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.compact_lesson_component_positions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.compact_lesson_component_positions() TO service_role;


--
-- Name: FUNCTION cleanup_empty_lesson_student_slide(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cleanup_empty_lesson_student_slide() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cleanup_empty_lesson_student_slide() TO service_role;


--
-- Name: FUNCTION enforce_lesson_student_screen_invariants(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_lesson_student_screen_invariants() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_lesson_student_screen_invariants() TO service_role;


--
-- Name: FUNCTION current_account_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_account_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_account_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_account_id() TO service_role;


--
-- Name: FUNCTION current_parent_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_parent_id() TO anon;
GRANT ALL ON FUNCTION public.current_parent_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_parent_id() TO service_role;


--
-- Name: FUNCTION current_session_invalid_before(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_session_invalid_before() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_session_invalid_before() TO authenticated;
GRANT ALL ON FUNCTION public.current_session_invalid_before() TO service_role;


--
-- Name: FUNCTION current_student_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_student_id() TO anon;
GRANT ALL ON FUNCTION public.current_student_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_student_id() TO service_role;


--
-- Name: FUNCTION current_teacher_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_teacher_id() TO anon;
GRANT ALL ON FUNCTION public.current_teacher_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_teacher_id() TO service_role;


--
-- Name: TABLE user_preference; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_preference TO anon;
GRANT ALL ON TABLE public.user_preference TO authenticated;
GRANT ALL ON TABLE public.user_preference TO service_role;


--
-- Name: FUNCTION ensure_user_preference(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ensure_user_preference(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.ensure_user_preference(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ensure_user_preference(p_user_id uuid) TO service_role;


--
-- Name: TABLE user_security; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_security TO anon;
GRANT ALL ON TABLE public.user_security TO authenticated;
GRANT ALL ON TABLE public.user_security TO service_role;


--
-- Name: FUNCTION ensure_user_security(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ensure_user_security(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.ensure_user_security(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ensure_user_security(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_last_active_profile(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_last_active_profile(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_last_active_profile(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_last_active_profile(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_auth_user_account(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_auth_user_account() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_auth_user_account() TO service_role;


--
-- Name: FUNCTION is_class_student(p_class_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_class_student(p_class_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_class_student(p_class_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_class_student(p_class_id uuid) TO service_role;


--
-- Name: FUNCTION is_class_teacher(p_class_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_class_teacher(p_class_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_class_teacher(p_class_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_class_teacher(p_class_id uuid) TO service_role;


--
-- Name: FUNCTION is_my_child(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_my_child(p_student_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_my_child(p_student_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_my_child(p_student_id uuid) TO service_role;


--
-- Name: FUNCTION merge_user_settings(p_user_id uuid, p_settings jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.merge_user_settings(p_user_id uuid, p_settings jsonb) TO anon;
GRANT ALL ON FUNCTION public.merge_user_settings(p_user_id uuid, p_settings jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.merge_user_settings(p_user_id uuid, p_settings jsonb) TO service_role;


--
-- Name: FUNCTION onboard_parent(p_user_id uuid, p_full_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.onboard_parent(p_user_id uuid, p_full_name text) TO anon;
GRANT ALL ON FUNCTION public.onboard_parent(p_user_id uuid, p_full_name text) TO authenticated;
GRANT ALL ON FUNCTION public.onboard_parent(p_user_id uuid, p_full_name text) TO service_role;


--
-- Name: FUNCTION onboard_teacher(p_user_id uuid, p_full_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.onboard_teacher(p_user_id uuid, p_full_name text) TO anon;
GRANT ALL ON FUNCTION public.onboard_teacher(p_user_id uuid, p_full_name text) TO authenticated;
GRANT ALL ON FUNCTION public.onboard_teacher(p_user_id uuid, p_full_name text) TO service_role;


--
-- Name: FUNCTION parent_in_class(p_class_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.parent_in_class(p_class_id uuid) TO anon;
GRANT ALL ON FUNCTION public.parent_in_class(p_class_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.parent_in_class(p_class_id uuid) TO service_role;


--
-- Name: FUNCTION parent_in_school(p_school_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.parent_in_school(p_school_id uuid) TO anon;
GRANT ALL ON FUNCTION public.parent_in_school(p_school_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.parent_in_school(p_school_id uuid) TO service_role;


--
-- Name: FUNCTION delete_lesson_component(p_component_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_lesson_component(p_component_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_lesson_component(p_component_id uuid) TO authenticated;


--
-- Name: FUNCTION reorder_lesson_component(p_component_id uuid, p_new_position integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reorder_lesson_component(p_component_id uuid, p_new_position integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reorder_lesson_component(p_component_id uuid, p_new_position integer) TO authenticated;


--
-- Name: FUNCTION set_lesson_component_student_screen(p_component_id uuid, p_mode text, p_slide_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_lesson_component_student_screen(p_component_id uuid, p_mode text, p_slide_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_lesson_component_student_screen(p_component_id uuid, p_mode text, p_slide_id uuid) TO authenticated;


--
-- Name: FUNCTION reset_pin_attempts(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reset_pin_attempts(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.reset_pin_attempts(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reset_pin_attempts(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION revoke_user_sessions(p_user_id uuid, p_cutoff timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revoke_user_sessions(p_user_id uuid, p_cutoff timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.revoke_user_sessions(p_user_id uuid, p_cutoff timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.revoke_user_sessions(p_user_id uuid, p_cutoff timestamp with time zone) TO service_role;


--
-- Name: FUNCTION set_last_active_profile(p_user_id uuid, p_profile text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_last_active_profile(p_user_id uuid, p_profile text) TO anon;
GRANT ALL ON FUNCTION public.set_last_active_profile(p_user_id uuid, p_profile text) TO authenticated;
GRANT ALL ON FUNCTION public.set_last_active_profile(p_user_id uuid, p_profile text) TO service_role;


--
-- Name: FUNCTION set_last_selected_school(p_user_id uuid, p_school_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_last_selected_school(p_user_id uuid, p_school_id uuid) TO anon;
GRANT ALL ON FUNCTION public.set_last_selected_school(p_user_id uuid, p_school_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.set_last_selected_school(p_user_id uuid, p_school_id uuid) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION set_user_pin(p_user_id uuid, p_raw_pin text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_user_pin(p_user_id uuid, p_raw_pin text) TO anon;
GRANT ALL ON FUNCTION public.set_user_pin(p_user_id uuid, p_raw_pin text) TO authenticated;
GRANT ALL ON FUNCTION public.set_user_pin(p_user_id uuid, p_raw_pin text) TO service_role;


--
-- Name: FUNCTION teaches_student(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.teaches_student(p_student_id uuid) TO anon;
GRANT ALL ON FUNCTION public.teaches_student(p_student_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.teaches_student(p_student_id uuid) TO service_role;


--
-- Name: FUNCTION upsert_user_theme(p_user_id uuid, p_theme text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_user_theme(p_user_id uuid, p_theme text) TO anon;
GRANT ALL ON FUNCTION public.upsert_user_theme(p_user_id uuid, p_theme text) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_user_theme(p_user_id uuid, p_theme text) TO service_role;


--
-- Name: FUNCTION verify_user_pin(p_user_id uuid, p_raw_pin text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.verify_user_pin(p_user_id uuid, p_raw_pin text) TO anon;
GRANT ALL ON FUNCTION public.verify_user_pin(p_user_id uuid, p_raw_pin text) TO authenticated;
GRANT ALL ON FUNCTION public.verify_user_pin(p_user_id uuid, p_raw_pin text) TO service_role;


--
-- Name: TABLE account; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.account TO service_role;
GRANT SELECT ON TABLE public.account TO authenticated;


--
-- Name: TABLE class; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.class TO anon;
GRANT ALL ON TABLE public.class TO authenticated;
GRANT ALL ON TABLE public.class TO service_role;


--
-- Name: TABLE class_student; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.class_student TO anon;
GRANT ALL ON TABLE public.class_student TO authenticated;
GRANT ALL ON TABLE public.class_student TO service_role;


--
-- Name: TABLE class_teacher; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.class_teacher TO anon;
GRANT ALL ON TABLE public.class_teacher TO authenticated;
GRANT ALL ON TABLE public.class_teacher TO service_role;


--
-- Name: TABLE course; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.course TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.course TO authenticated;


--
-- Name: TABLE course_attachment; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.course_attachment TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.course_attachment TO authenticated;


--
-- Name: TABLE lesson; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lesson TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lesson TO authenticated;


--
-- Name: TABLE lesson_component; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lesson_component TO service_role;
GRANT SELECT ON TABLE public.lesson_component TO authenticated;
GRANT INSERT(lesson_id) ON TABLE public.lesson_component TO authenticated;
GRANT INSERT(type_key) ON TABLE public.lesson_component TO authenticated;
GRANT INSERT(schema_version) ON TABLE public.lesson_component TO authenticated;
GRANT INSERT("position") ON TABLE public.lesson_component TO authenticated;
GRANT INSERT(payload) ON TABLE public.lesson_component TO authenticated;
GRANT INSERT(placement_config) ON TABLE public.lesson_component TO authenticated;
GRANT UPDATE(payload) ON TABLE public.lesson_component TO authenticated;
GRANT UPDATE(placement_config) ON TABLE public.lesson_component TO authenticated;


--
-- Name: TABLE lesson_student_slide; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lesson_student_slide TO service_role;
GRANT SELECT ON TABLE public.lesson_student_slide TO authenticated;


--
-- Name: TABLE parent; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.parent TO anon;
GRANT ALL ON TABLE public.parent TO authenticated;
GRANT ALL ON TABLE public.parent TO service_role;


--
-- Name: TABLE school; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.school TO anon;
GRANT ALL ON TABLE public.school TO authenticated;
GRANT ALL ON TABLE public.school TO service_role;


--
-- Name: TABLE school_teacher; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.school_teacher TO anon;
GRANT ALL ON TABLE public.school_teacher TO authenticated;
GRANT ALL ON TABLE public.school_teacher TO service_role;


--
-- Name: TABLE stored_file; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stored_file TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stored_file TO authenticated;


--
-- Name: TABLE student; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student TO service_role;
GRANT SELECT,UPDATE ON TABLE public.student TO authenticated;


--
-- Name: TABLE teacher; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teacher TO anon;
GRANT ALL ON TABLE public.teacher TO authenticated;
GRANT ALL ON TABLE public.teacher TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- -----------------------------------------------------------------------------
-- Cross-schema Supabase objects owned by the active Course Builder model
-- -----------------------------------------------------------------------------

-- Auth Account bootstrap trigger. Its function and ACL are part of the public
-- dump above; the trigger itself belongs to auth.users and is recorded here.
CREATE TRIGGER trg_auth_user_create_account
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_account();

-- Private Storage bucket data invariant. This does not change the base Storage
-- schema; it records the current bucket row that accompanies the public model.
INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'course-assets',
    'course-assets',
    false,
    10485760,
    ARRAY[
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
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- storage.objects is supplied by Supabase Storage and already has RLS enabled.
CREATE POLICY course_assets_owner_select ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'course-assets'
    AND (storage.foldername(name))[1] =
        (SELECT public.current_account_id())::text
);

CREATE POLICY course_assets_owner_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'course-assets'
    AND (storage.foldername(name))[1] =
        (SELECT public.current_account_id())::text
);

CREATE POLICY course_assets_owner_update ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'course-assets'
    AND (storage.foldername(name))[1] =
        (SELECT public.current_account_id())::text
)
WITH CHECK (
    bucket_id = 'course-assets'
    AND (storage.foldername(name))[1] =
        (SELECT public.current_account_id())::text
);

CREATE POLICY course_assets_owner_delete ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'course-assets'
    AND (storage.foldername(name))[1] =
        (SELECT public.current_account_id())::text
);

--
-- PostgreSQL database dump complete
--
