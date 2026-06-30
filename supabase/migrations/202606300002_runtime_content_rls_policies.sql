begin;

-- =============================================================================
-- Runtime + methodology-content RLS policies (Phase 2 — cross-school isolation)
-- -----------------------------------------------------------------------------
-- 15 tables had RLS ENABLED but ZERO policies (fail-closed for non-bypass roles)
-- AND still carried Supabase's default WIDE-OPEN grants (anon+authenticated held
-- ALL privileges). The app always queries as service_role (BYPASSRLS), so these
-- policies do NOT change app behavior; they are defense-in-depth + real isolation
-- IF PostgREST/Realtime is ever exposed with anon/authenticated keys. The
-- load-bearing present-day fix is `revoke all from anon, authenticated`; the
-- SELECT policies mirror exactly how the app authorizes reads.
--
-- RECURSION NOTE (important): under a real `authenticated` role the EXISTING
-- covered-table policies recurse two ways — (1) self-policies call
-- current_*_id() which (as SECURITY INVOKER) re-read teacher/parent under RLS,
-- and (2) class_student's policy reads class_teacher and class_teacher's policy
-- reads class_student (mutual). Neither ever fired because the app is
-- service_role. To stay recursion-proof, every membership check below goes
-- through SECURITY DEFINER helpers whose internal reads BYPASS RLS, so no policy
-- reads the mutually-recursive graph tables (class_teacher/class_student/student)
-- directly. The 3 identity helpers are also converted to SECURITY DEFINER, which
-- additionally repairs the existing teacher/parent self-read policies.
--
-- Convention mirrored from 202604020001: FOR SELECT only; NO insert/update/delete
-- policies (writes stay service_role / SECURITY DEFINER RPCs); revoke-then-grant-
-- select. Methodology/content layer = shared global catalog (no school-ownership
-- column exists); readable by any authenticated user, denied to anon.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1) Identity helpers -> SECURITY DEFINER (recursion fix; owner = supabase_admin)
-- ----------------------------------------------------------------------------
create or replace function public.current_teacher_id()
returns uuid language sql stable security definer set search_path = public as $$
  select t.id from public.teacher t where t.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_parent_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.parent p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select s.id from public.student s where s.user_id = auth.uid() limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 2) Membership primitives (SECURITY DEFINER — internal reads bypass RLS,
--    so policies built on them never touch the recursive graph tables directly).
-- ----------------------------------------------------------------------------
create or replace function public.is_class_teacher(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_teacher ct
    where ct.class_id = p_class_id and ct.teacher_id = public.current_teacher_id()
  );
$$;

create or replace function public.is_class_student(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_student cs
    where cs.class_id = p_class_id and cs.student_id = public.current_student_id()
  );
$$;

create or replace function public.parent_in_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_student cs
    join public.student s on s.id = cs.student_id
    where cs.class_id = p_class_id and s.parent_id = public.current_parent_id()
  );
$$;

-- class-wide read membership (teacher of class OR enrolled student OR parent of enrolled child)
create or replace function public.can_read_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_class_teacher(p_class_id)
      or public.is_class_student(p_class_id)
      or public.parent_in_class(p_class_id);
$$;

create or replace function public.is_my_child(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.student s
    where s.id = p_student_id and s.parent_id = public.current_parent_id()
  );
$$;

-- class that owns a scheduled_lesson_homework_assignment (via its scheduled_lesson)
create or replace function public.scheduled_homework_class_id(p_slha_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select sl.class_id
  from public.scheduled_lesson_homework_assignment sha
  join public.scheduled_lesson sl on sl.id = sha.scheduled_lesson_id
  where sha.id = p_slha_id;
$$;

-- caller (teacher) teaches a class the given student is enrolled in
create or replace function public.teaches_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_student cs
    join public.class_teacher ct on ct.class_id = cs.class_id
    where cs.student_id = p_student_id and ct.teacher_id = public.current_teacher_id()
  );
$$;

-- caller (parent) has a child enrolled in some class of the given school
create or replace function public.parent_in_school(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_student cs
    join public.student s on s.id = cs.student_id
    join public.class c on c.id = cs.class_id
    where c.school_id = p_school_id and s.parent_id = public.current_parent_id()
  );
$$;

-- =============================================================================
-- 3) Runtime layer (8 tables) — membership-scoped SELECT. Role = public; the
--    DEFINER predicates return false for anon (current_*_id() is NULL).
-- =============================================================================

-- scheduled_lesson: teacher/student/parent of the lesson's class.
revoke all on public.scheduled_lesson from anon, authenticated;
grant select on public.scheduled_lesson to authenticated;
create policy scheduled_lesson_member_select on public.scheduled_lesson
for select using ( public.can_read_class(scheduled_lesson.class_id) );

-- scheduled_lesson_homework_assignment (header): visible iff the lesson is visible.
revoke all on public.scheduled_lesson_homework_assignment from anon, authenticated;
grant select on public.scheduled_lesson_homework_assignment to authenticated;
create policy slha_lesson_visible_select on public.scheduled_lesson_homework_assignment
for select using (
  exists (
    select 1 from public.scheduled_lesson sl
    where sl.id = scheduled_lesson_homework_assignment.scheduled_lesson_id
  )
);

-- student_homework_assignment (per-student): the student, their parent, or the
-- teacher of the owning class. NOT visible to classmates.
revoke all on public.student_homework_assignment from anon, authenticated;
grant select on public.student_homework_assignment to authenticated;
create policy student_homework_owner_or_teacher_select on public.student_homework_assignment
for select using (
  student_homework_assignment.student_id = public.current_student_id()
  or public.is_my_child(student_homework_assignment.student_id)
  or public.is_class_teacher(
       public.scheduled_homework_class_id(student_homework_assignment.scheduled_homework_assignment_id)
     )
);

-- group_student_conversation (per-(class,student) channel): teacher of class,
-- the student, or the student's parent.
revoke all on public.group_student_conversation from anon, authenticated;
grant select on public.group_student_conversation to authenticated;
create policy group_student_conversation_member_select on public.group_student_conversation
for select using (
  public.is_class_teacher(group_student_conversation.class_id)
  or group_student_conversation.student_id = public.current_student_id()
  or public.is_my_child(group_student_conversation.student_id)
);

-- group_student_message: visible iff its conversation is visible.
revoke all on public.group_student_message from anon, authenticated;
grant select on public.group_student_message to authenticated;
create policy group_student_message_conversation_visible_select on public.group_student_message
for select using (
  exists (
    select 1 from public.group_student_conversation gc
    where gc.id = group_student_message.conversation_id
  )
);

-- lesson_group_conversation (per-lesson group chat): teacher/student/parent of the class.
revoke all on public.lesson_group_conversation from anon, authenticated;
grant select on public.lesson_group_conversation to authenticated;
create policy lesson_group_conversation_member_select on public.lesson_group_conversation
for select using ( public.can_read_class(lesson_group_conversation.class_id) );

-- lesson_group_message: visible iff its conversation is visible.
revoke all on public.lesson_group_message from anon, authenticated;
grant select on public.lesson_group_message to authenticated;
create policy lesson_group_message_conversation_visible_select on public.lesson_group_message
for select using (
  exists (
    select 1 from public.lesson_group_conversation c
    where c.id = lesson_group_message.conversation_id
  )
);

-- communication_message_attachment: visible iff its parent message is visible
-- (exactly one parent is set per the table's CHECK constraint).
revoke all on public.communication_message_attachment from anon, authenticated;
grant select on public.communication_message_attachment to authenticated;
create policy communication_attachment_parent_message_select on public.communication_message_attachment
for select using (
  (
    communication_message_attachment.lesson_group_message_id is not null
    and exists (
      select 1 from public.lesson_group_message m
      where m.id = communication_message_attachment.lesson_group_message_id
    )
  )
  or (
    communication_message_attachment.group_student_message_id is not null
    and exists (
      select 1 from public.group_student_message gm
      where gm.id = communication_message_attachment.group_student_message_id
    )
  )
);

-- =============================================================================
-- 4) Methodology / content layer (7 tables) — shared global catalog.
--    Scoped `to authenticated` so USING(true) can never be satisfied by anon.
-- =============================================================================

revoke all on public.methodology from anon, authenticated;
grant select on public.methodology to authenticated;
create policy methodology_authenticated_select on public.methodology
for select to authenticated using (true);

revoke all on public.methodology_lesson from anon, authenticated;
grant select on public.methodology_lesson to authenticated;
create policy methodology_lesson_authenticated_select on public.methodology_lesson
for select to authenticated using (true);

revoke all on public.methodology_lesson_block from anon, authenticated;
grant select on public.methodology_lesson_block to authenticated;
create policy methodology_lesson_block_authenticated_select on public.methodology_lesson_block
for select to authenticated using (true);

revoke all on public.methodology_lesson_block_asset from anon, authenticated;
grant select on public.methodology_lesson_block_asset to authenticated;
create policy methodology_lesson_block_asset_authenticated_select on public.methodology_lesson_block_asset
for select to authenticated using (true);

revoke all on public.methodology_lesson_student_content from anon, authenticated;
grant select on public.methodology_lesson_student_content to authenticated;
create policy methodology_lesson_student_content_authenticated_select on public.methodology_lesson_student_content
for select to authenticated using (true);

revoke all on public.methodology_lesson_homework from anon, authenticated;
grant select on public.methodology_lesson_homework to authenticated;
create policy methodology_lesson_homework_authenticated_select on public.methodology_lesson_homework
for select to authenticated using (true);

revoke all on public.reusable_asset from anon, authenticated;
grant select on public.reusable_asset to authenticated;
create policy reusable_asset_authenticated_select on public.reusable_asset
for select to authenticated using (true);

-- =============================================================================
-- 5) Recursion repair for the EXISTING covered-table policies.
--    These predates this work and recurse under `authenticated` (class_student's
--    policy reads class_teacher and vice-versa; student/class/school read the
--    same graph). BEHAVIOR-PRESERVING: each rewrite computes the identical
--    boolean via the SECURITY DEFINER helpers above (whose internal reads bypass
--    RLS), so no policy reads the recursive graph tables directly. Roles and
--    visibility are unchanged; only the recursion is removed. service_role
--    (the app) bypasses RLS and is unaffected either way.
-- =============================================================================

drop policy if exists student_self_parent_teacher_select on public.student;
create policy student_self_parent_teacher_select on public.student
for select using (
  student.user_id = auth.uid()
  or student.parent_id = public.current_parent_id()
  or public.teaches_student(student.id)
);

drop policy if exists school_parent_context_select on public.school;
create policy school_parent_context_select on public.school
for select using ( public.parent_in_school(school.id) );

drop policy if exists class_teacher_or_student_select on public."class";
create policy class_teacher_or_student_select on public."class"
for select using (
  public.is_class_teacher("class".id) or public.is_class_student("class".id)
);

drop policy if exists class_parent_context_select on public."class";
create policy class_parent_context_select on public."class"
for select using ( public.parent_in_class("class".id) );

drop policy if exists class_teacher_self_or_student_select on public.class_teacher;
create policy class_teacher_self_or_student_select on public.class_teacher
for select using (
  class_teacher.teacher_id = public.current_teacher_id()
  or public.is_class_student(class_teacher.class_id)
);

drop policy if exists class_student_related_select on public.class_student;
create policy class_student_related_select on public.class_student
for select using (
  class_student.student_id = public.current_student_id()
  or public.is_my_child(class_student.student_id)
  or public.is_class_teacher(class_student.class_id)
);

commit;
