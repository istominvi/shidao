import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const baselineMigration = readFileSync(
  "supabase/migrations/20260803142924_v2_course_builder_vertical_slice.sql",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260804033421_course_lesson_components_remove_legacy_methodology.sql",
  "utf8",
);
const studentSlidesMigration = readFileSync(
  "supabase/migrations/20260804044955_add_lesson_student_slides.sql",
  "utf8",
);
const dividerRemovalMigration = readFileSync(
  "supabase/migrations/20260811154138_remove_divider_components.sql",
  "utf8",
);
const atomicCourseArchiveMigration = readFileSync(
  "supabase/migrations/20260811231505_atomic_course_archive.sql",
  "utf8",
);
const snapshot = readFileSync("supabase/schema/current-schema.sql", "utf8");
const snapshotWorkflow = readFileSync(
  "scripts/refresh-schema-snapshot.sh",
  "utf8",
);

function migrationFunction(name: string) {
  const start = studentSlidesMigration.indexOf(`function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = studentSlidesMigration.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return studentSlidesMigration.slice(start, end + 4);
}

function atomicArchiveFunction(name: string) {
  const start = atomicCourseArchiveMigration.indexOf(
    `create function public.${name}(`,
  );
  assert.notEqual(start, -1, `missing atomic archive function ${name}`);
  const end = atomicCourseArchiveMigration.indexOf("\n$function$;", start);
  assert.notEqual(end, -1, `unterminated atomic archive function ${name}`);
  return atomicCourseArchiveMigration.slice(start, end + 12);
}

const preservedBuilderTables = [
  "account",
  "course",
  "lesson",
  "stored_file",
  "course_attachment",
] as const;

test("divider removal is guarded, deterministic, and irreversible", () => {
  assert.match(dividerRemovalMigration, /^begin;\n/);
  assert.match(dividerRemovalMigration, /\ncommit;\n$/);
  assert.doesNotMatch(
    dividerRemovalMigration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );

  for (const fragment of [
    "shidao_schema_sanity_check_failed",
    "course_publication_revision_contains_divider",
    "order by component.lesson_id, component.position desc, component.id",
    "set constraints all immediate",
    "lower(btrim(type_key)) <> 'divider'",
    "lesson_component_positions_are_not_dense",
    "lesson_student_slide_positions_are_not_dense",
    "empty_lesson_student_slide_remains",
  ]) {
    assert.equal(
      dividerRemovalMigration.includes(fragment),
      true,
      `divider cleanup migration missing ${fragment}`,
    );
  }

  const courseLock = dividerRemovalMigration.indexOf(
    "lock table public.course in share row exclusive mode",
  );
  const lessonLock = dividerRemovalMigration.indexOf(
    "lock table public.lesson in share row exclusive mode",
  );
  const componentLock = dividerRemovalMigration.indexOf(
    "lock table public.lesson_component in share row exclusive mode",
  );
  const slideLock = dividerRemovalMigration.indexOf(
    "lock table public.lesson_student_slide in share row exclusive mode",
  );
  const revisionLock = dividerRemovalMigration.indexOf(
    "lock table public.course_publication_revision in share row exclusive mode",
  );
  assert.equal(
    courseLock >= 0 &&
      courseLock < lessonLock &&
      lessonLock < componentLock &&
      componentLock < slideLock &&
      slideLock < revisionLock,
    true,
  );
});

test("Student Screen slides are one transactional forward migration", () => {
  assert.match(studentSlidesMigration, /^begin;\n/);
  assert.match(studentSlidesMigration, /\ncommit;\n$/);
  assert.doesNotMatch(
    studentSlidesMigration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );

  for (const fragment of [
    "create table public.lesson_student_slide (",
    "add column student_slide_id uuid null",
    "default 'staff_only'",
    "lesson_component_student_screen_assignment_check",
    "foreign key (student_slide_id, lesson_id)",
    "references public.lesson_student_slide(id, lesson_id)",
    "alter table public.lesson_student_slide enable row level security",
    "create policy lesson_student_slide_course_owner_select",
  ]) {
    assert.equal(
      studentSlidesMigration.includes(fragment),
      true,
      `Student Screen migration missing ${fragment}`,
    );
  }

  assert.match(snapshot, /CREATE TABLE public\.lesson_student_slide \(/);
  assert.match(snapshot, /student_slide_id uuid/);
  assert.match(snapshot, /visibility text DEFAULT 'staff_only'::text NOT NULL/);
});

test("slide backfill preserves old learner visibility without publishing private components", () => {
  assert.match(
    studentSlidesMigration,
    /where component\.visibility = 'learner_visible'/,
  );
  assert.match(
    studentSlidesMigration,
    /and component\.visibility = 'learner_visible'/,
  );
  assert.match(
    studentSlidesMigration,
    /Existing learner-visible rows were preserved by the backfill/,
  );
  const assembler = migrationFunction("assemble_course_draft");
  assert.match(assembler, /v_component -> 'placement'\n    \)/);
  assert.doesNotMatch(assembler, /\bvisibility\b|\bstudent_slide_id\b/);
});

test("Student Screen assignment and reorder preserve monotonic slide order atomically", () => {
  for (const fragment of [
    "function public.set_lesson_component_student_screen(",
    "function public.delete_lesson_component(",
    "student_slide_target_out_of_order",
    "student_slide_cannot_split_group",
    "previous_slide_position > slide_position",
    "cleanup_empty_lesson_student_slide",
    "row_number() over (order by slide.position, slide.id)",
    "v_clamped_slide_position",
    "notify pgrst, 'reload schema'",
  ]) {
    assert.equal(
      studentSlidesMigration.includes(fragment),
      true,
      `Student Screen invariant missing ${fragment}`,
    );
  }

  for (const functionName of [
    "set_lesson_component_student_screen",
    "reorder_lesson_component",
    "delete_lesson_component",
  ]) {
    const body = migrationFunction(functionName);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /v_actor_user_id uuid := \(select auth\.uid\(\)\)/);
    assert.match(body, /account\.auth_user_id = v_actor_user_id/);

    const parentLock = body.indexOf("for update of lesson;");
    const componentLock = body.indexOf("order by component.id\n  for update;");
    const slideLock = body.indexOf("order by slide.id\n  for update;");
    assert.equal(parentLock >= 0 && parentLock < componentLock, true);
    assert.equal(componentLock < slideLock, true);
  }

  assert.match(
    migrationFunction("set_lesson_component_student_screen"),
    /if p_mode is null or p_mode not in \('hide', 'existing', 'new'\)/,
  );
  assert.match(
    migrationFunction("reorder_lesson_component"),
    /returns table \([\s\S]*?student_slide_id uuid[\s\S]*?where component\.id = p_component_id/,
  );
  assert.match(
    migrationFunction("delete_lesson_component"),
    /returns boolean[\s\S]*?get diagnostics v_deleted_count = row_count/,
  );

  assert.match(
    studentSlidesMigration,
    /grant execute on function public\.set_lesson_component_student_screen\([\s\S]*?\) to authenticated;/,
  );
  for (const functionName of [
    "set_lesson_component_student_screen",
    "reorder_lesson_component",
    "delete_lesson_component",
  ]) {
    assert.doesNotMatch(
      studentSlidesMigration,
      new RegExp(
        `grant execute on function public\\.${functionName}\\([\\s\\S]*?\\) to service_role;`,
      ),
    );
  }
  assert.match(
    snapshot,
    /CREATE FUNCTION public\.set_lesson_component_student_screen/,
  );
  assert.match(snapshot, /CREATE FUNCTION public\.delete_lesson_component/);
});

test("Student Screen table access is least-privilege and private by default", () => {
  assert.match(
    studentSlidesMigration,
    /create policy lesson_component_staff_only_insert_guard[\s\S]*?as restrictive[\s\S]*?visibility = 'staff_only'[\s\S]*?student_slide_id is null/,
  );
  assert.match(
    studentSlidesMigration,
    /grant insert \([\s\S]*?lesson_id,[\s\S]*?placement_config[\s\S]*?\) on table public\.lesson_component to authenticated;/,
  );
  assert.match(
    studentSlidesMigration,
    /grant update \(payload, placement_config\)[\s\S]*?to authenticated;/,
  );
  assert.doesNotMatch(
    studentSlidesMigration,
    /grant (?:delete|update) on table public\.lesson_component to authenticated;/,
  );
  assert.match(
    studentSlidesMigration,
    /grant select on table public\.lesson_student_slide to authenticated;/,
  );
  assert.doesNotMatch(
    studentSlidesMigration,
    /grant (?:insert|update|delete) on table public\.lesson_student_slide to authenticated;/,
  );
  assert.match(
    studentSlidesMigration,
    /compact_lesson_component_positions\(\)[\s\S]*?if not exists \([\s\S]*?from public\.lesson as lesson/,
  );
});

test("component-first cutover is one transactional forward change", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\ncommit;\n$/);
  assert.equal(migration.includes("drop schema"), false);
  assert.equal(migration.includes("drop table auth."), false);
  assert.equal(migration.includes("drop table storage."), false);

  for (const table of preservedBuilderTables) {
    assert.equal(
      baselineMigration.includes(`create table public.${table} (`),
      true,
      `missing baseline table ${table}`,
    );
    assert.equal(
      baselineMigration.includes(
        `alter table public.${table} enable row level security;`,
      ),
      true,
      `RLS is not enabled for ${table}`,
    );
    assert.equal(
      snapshot.includes(`CREATE TABLE public.${table} (`),
      true,
      `current schema snapshot is missing ${table}`,
    );
  }

  assert.equal(
    migration.includes("create table public.lesson_component ("),
    true,
  );
  assert.equal(
    snapshot.includes("CREATE TABLE public.lesson_component ("),
    true,
  );
  assert.equal(
    migration.includes(
      "alter table public.lesson_component enable row level security;",
    ),
    true,
  );
});

test("Course persists the complete first-milestone form and assembler marker", () => {
  for (const { migrationColumn, snapshotColumn = migrationColumn } of [
    { migrationColumn: "subject text" },
    { migrationColumn: "goal text" },
    { migrationColumn: "level text" },
    { migrationColumn: "audience_description text" },
    { migrationColumn: "target_lesson_count integer" },
    { migrationColumn: "teacher_preferences text" },
    {
      migrationColumn: "assembled_at timestamptz",
      snapshotColumn: "assembled_at timestamp with time zone",
    },
  ]) {
    assert.equal(
      baselineMigration.includes(migrationColumn),
      true,
      `missing Course field ${migrationColumn}`,
    );
    assert.equal(
      snapshot.includes(snapshotColumn),
      true,
      `snapshot missing Course field ${snapshotColumn}`,
    );
  }

  assert.equal(
    baselineMigration.includes(
      "audience_type text not null default 'none' check (audience_type = 'none')",
    ),
    true,
  );
});

test("Lesson and direct components have deferrable ordered positions", () => {
  assert.equal(
    baselineMigration.includes(
      "unique (course_id, position) deferrable initially deferred",
    ),
    true,
  );
  assert.equal(
    migration.includes(
      "unique (lesson_id, position) deferrable initially deferred",
    ),
    true,
  );
  assert.equal(migration.includes("type_key text not null"), true);
  assert.equal(migration.includes("schema_version integer not null"), true);
  assert.equal(migration.includes("payload jsonb not null"), true);
  assert.equal(migration.includes("placement_config jsonb not null"), true);
  assert.equal(migration.includes("visibility text not null"), true);
  assert.equal(
    migration.includes("create type") && migration.includes("component"),
    false,
  );
});

test("cutover preserves component IDs, enforces Course ownership and removes Step storage", () => {
  for (const fragment of [
    "create temporary table lesson_component_migration_plan (",
    "insert into public.lesson_component (",
    "from lesson_component_migration_plan",
    "lesson_component_persisted_data_mismatch",
    "lesson_component_persisted_positions_are_not_dense",
    "create policy lesson_component_course_owner_all",
    "course.owner_account_id = (select public.current_account_id())",
    "drop function public.reorder_lesson_step_component(uuid, integer);",
    "drop function public.compact_step_component_positions();",
    "drop function public.compact_lesson_step_positions();",
    "drop table public.lesson_step_component;",
    "drop table public.lesson_step;",
  ]) {
    assert.equal(migration.includes(fragment), true, `missing ${fragment}`);
  }

  const sourceLock = migration.indexOf(
    "lock table\n  public.lesson_step,\n  public.lesson_step_component\nin share row exclusive mode;",
  );
  assert.notEqual(sourceLock, -1);
  assert.equal(
    sourceLock <
      migration.indexOf("lesson_step_source_positions_are_not_dense"),
    true,
    "source writes must be frozen before data-dependent checks and backfill",
  );
});

test("cutover removes archived methodology and lesson runtime explicitly", () => {
  const removedTables = [
    "notification",
    "communication_message_attachment",
    "lesson_group_message",
    "lesson_group_conversation",
    "group_student_message",
    "group_student_conversation",
    "student_homework_assignment",
    "scheduled_lesson_homework_assignment",
    "scheduled_lesson",
    "methodology_lesson_block_asset",
    "methodology_lesson_student_content",
    "methodology_lesson_homework",
    "methodology_lesson_block",
    "methodology_lesson",
    "reusable_asset",
    "methodology",
  ] as const;

  for (const table of removedTables) {
    assert.equal(
      migration.includes(`drop table public.${table};`),
      true,
      `migration does not explicitly remove ${table}`,
    );
    assert.equal(
      snapshot.includes(`CREATE TABLE public.${table} (`),
      false,
      `current snapshot still exposes ${table}`,
    );
  }

  assert.equal(migration.includes("drop column methodology_id;"), true);
  assert.equal(snapshot.includes("methodology_id"), false);
  assert.doesNotMatch(
    migration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );
});

test("Account bootstrap covers every Auth identity and stays least privilege", () => {
  assert.equal(baselineMigration.includes("from auth.users as users"), true);
  assert.equal(
    baselineMigration.includes("function public.handle_auth_user_account()"),
    true,
  );
  assert.equal(baselineMigration.includes("after insert on auth.users"), true);
  assert.equal(
    baselineMigration.includes("after insert on public.teacher"),
    false,
  );
  assert.equal(
    baselineMigration.includes("after insert on public.parent"),
    false,
  );
  assert.equal(baselineMigration.includes("student.user_id = users.id"), true);
  assert.equal(
    baselineMigration.includes("student.user_id = new.user_id"),
    false,
  );
  assert.equal(
    baselineMigration.includes("security definer\nset search_path = ''"),
    true,
  );
  assert.equal(
    baselineMigration.includes(
      "revoke all on function public.handle_auth_user_account()\nfrom public, anon, authenticated;",
    ),
    true,
  );

  assert.equal(
    baselineMigration.includes("function public.current_account_id()"),
    true,
  );
  assert.equal(
    baselineMigration.includes("security invoker\nset search_path = ''"),
    true,
  );
  assert.equal(
    baselineMigration.includes(
      "grant execute on function public.current_account_id() to authenticated;",
    ),
    true,
  );
  assert.equal(baselineMigration.includes("current_student_id"), false);
  assert.equal(baselineMigration.includes("current_teacher_id"), false);
  assert.equal(baselineMigration.includes("current_parent_id"), false);
  assert.equal(
    baselineMigration.includes(
      "grant select on table public.account to authenticated;",
    ),
    true,
  );
  assert.equal(
    baselineMigration.includes(
      "grant select, insert, update, delete on table\n  public.account",
    ),
    false,
  );
  assert.equal(
    baselineMigration.includes(
      "function public.current_session_invalid_before()",
    ),
    true,
  );
  assert.equal(
    baselineMigration.includes("where security.user_id = (select auth.uid())"),
    true,
  );
  assert.equal(
    baselineMigration.includes(
      "grant execute on function public.current_session_invalid_before()\nto authenticated;",
    ),
    true,
  );
});

test("component reorder RPC is atomic, RLS-bound and authenticated-only", () => {
  assert.equal(
    migration.includes("function public.reorder_lesson_component("),
    true,
  );
  assert.equal(
    migration.includes('returns table (component_id uuid, "position" integer)'),
    true,
  );
  assert.equal(migration.includes("for update;"), true);
  assert.equal(migration.includes("security invoker"), true);
  assert.equal(
    migration.includes(
      "grant execute on function public.reorder_lesson_component(uuid, integer)\nto authenticated;",
    ),
    true,
  );
  assert.equal(
    migration.includes(
      "revoke all on function public.reorder_lesson_component(uuid, integer)\nfrom public, anon;",
    ),
    true,
  );

  const parentLessonLock = migration.indexOf(
    "from public.lesson as lesson\n  where lesson.id = v_lesson_id\n  for update;",
  );
  const siblingLocks = migration.indexOf(
    "from public.lesson_component as component\n  where component.lesson_id = v_lesson_id\n  order by component.id\n  for update;",
  );
  assert.notEqual(parentLessonLock, -1);
  assert.notEqual(siblingLocks, -1);
  assert.equal(
    parentLessonLock < siblingLocks,
    true,
    "reorders must serialize on the parent Lesson before sibling row locks",
  );
});

test("draft assembly is one authenticated SECURITY INVOKER transaction boundary", () => {
  assert.equal(
    migration.includes("function public.assemble_course_draft("),
    true,
  );
  assert.equal(
    migration.includes(
      "select course.assembled_at\n  into v_assembled_at\n  from public.course",
    ),
    true,
  );
  assert.equal(migration.includes("course_contains_manual_content"), true);
  assert.equal(
    migration.includes(
      "grant execute on function public.assemble_course_draft(",
    ),
    true,
  );
  assert.equal(
    migration.includes(
      ") to authenticated;\n\n-- -----------------------------------------------------------------------------\n-- Remove the superseded Lesson Step API",
    ),
    true,
  );
  assert.equal(migration.includes("'stepIds'"), false);
  assert.equal(migration.includes("p_step_"), false);
  assert.equal(
    migration.includes("'public.assemble_course_draft(uuid,text,text,jsonb)'"),
    true,
  );
});

test("ordered Lesson and component lists compact after delete", () => {
  for (const fragment of [
    "function public.compact_lesson_component_positions()",
    "after delete on public.lesson_component",
  ]) {
    assert.equal(migration.includes(fragment), true, `missing ${fragment}`);
  }
  assert.equal(
    baselineMigration.includes(
      "function public.compact_course_lesson_positions()",
    ),
    true,
  );
});

test("private Course Storage is size, MIME and Account-folder restricted", () => {
  assert.equal(baselineMigration.includes("'course-assets'"), true);
  assert.equal(baselineMigration.includes("10485760"), true);
  assert.equal(baselineMigration.includes("'image/jpeg'"), true);
  assert.equal(baselineMigration.includes("'application/pdf'"), true);
  assert.equal(
    baselineMigration.includes(
      "'application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
    ),
    true,
  );
  assert.equal(
    baselineMigration.includes(
      "'application/vnd.openxmlformats-officedocument.presentationml.presentation'",
    ),
    true,
  );
  assert.equal(
    baselineMigration.includes("status in ('pending', 'ready')"),
    true,
  );
  assert.equal(
    baselineMigration.includes(
      "split_part(storage_path, '/', 1) = owner_account_id::text",
    ),
    true,
  );
  assert.equal(
    baselineMigration.includes(
      "(storage.foldername(name))[1] = (select public.current_account_id())::text",
    ),
    true,
  );

  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.equal(
      baselineMigration.includes(
        `create policy course_assets_owner_${operation}`,
      ),
      true,
      `missing Storage ${operation} policy`,
    );
  }
});

test("Course archive is one guarded transaction with stable outcomes", () => {
  assert.match(atomicCourseArchiveMigration, /^begin;\n/);
  assert.match(atomicCourseArchiveMigration, /\ncommit;\n$/);
  assert.doesNotMatch(
    atomicCourseArchiveMigration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );

  const courseLock = atomicCourseArchiveMigration.indexOf(
    "lock table public.course in share row exclusive mode",
  );
  const publicationLock = atomicCourseArchiveMigration.indexOf(
    "lock table public.course_publication in share row exclusive mode",
  );
  const lessonLock = atomicCourseArchiveMigration.indexOf(
    "lock table public.lesson in share row exclusive mode",
  );
  const runLock = atomicCourseArchiveMigration.indexOf(
    "lock table public.lesson_run in share row exclusive mode",
  );
  assert.equal(
    courseLock >= 0 &&
      courseLock < publicationLock &&
      publicationLock < lessonLock &&
      lessonLock < runLock,
    true,
  );

  const archive = atomicArchiveFunction("archive_course");
  for (const fragment of [
    "security definer",
    "set search_path = ''",
    "v_actor_user_id uuid := (select auth.uid())",
    "account.auth_user_id = v_actor_user_id",
    "account.status = 'active'",
    "for update of course",
    "return 'course_is_published'",
    "return 'course_has_open_lesson_runs'",
    "set archived_at = clock_timestamp()",
    "return 'archived'",
  ]) {
    assert.equal(
      archive.includes(fragment),
      true,
      `archive RPC missing ${fragment}`,
    );
  }
  assert.match(
    atomicCourseArchiveMigration,
    /revoke all on function public\.archive_course\(uuid\)[\s\S]*?grant execute on function public\.archive_course\(uuid\) to authenticated;/,
  );
  assert.match(
    atomicCourseArchiveMigration,
    /pg_get_userbyid\([\s\S]*?'public\.course'::regclass[\s\S]*?\) <> current_user/,
  );
  assert.match(
    atomicCourseArchiveMigration,
    /course_archive_guard_function_contract_invalid/,
  );
  assert.equal(
    (atomicCourseArchiveMigration.match(/procedure\.proconfig is null/g) ?? [])
      .length >= 2,
    true,
  );
});

test("archive, publication, Lesson ownership, and open Runs share DB guards", () => {
  const guards = [
    ["guard_course_archive_invariants", "course_is_published"],
    ["guard_course_publication_active_source", "for update of course"],
    ["guard_lesson_course_immutable", "lesson_course_move_forbidden"],
    ["guard_lesson_run_active_course", "for update of course"],
  ] as const;

  for (const [name, fragment] of guards) {
    const guard = atomicArchiveFunction(name);
    assert.match(guard, /set search_path = ''/);
    assert.equal(guard.includes(fragment), true, `${name} missing ${fragment}`);
    assert.doesNotMatch(guard, /security definer/);
  }

  for (const [table, trigger] of [
    ["course", "trg_course_archive_invariants"],
    ["course_publication", "trg_course_publication_active_source"],
    ["lesson", "trg_lesson_course_immutable"],
    ["lesson_run", "trg_lesson_run_active_course"],
  ]) {
    assert.match(
      atomicCourseArchiveMigration,
      new RegExp(
        `create trigger ${trigger}[\\s\\S]*?on public\\.${table}|create trigger ${trigger}[\\s\\S]*?public\\.${table}`,
      ),
    );
  }
});

test("browser cannot bypass archive or move Lessons through direct table ACL", () => {
  assert.match(
    atomicCourseArchiveMigration,
    /revoke update, delete on table public\.course from authenticated;/,
  );
  assert.match(
    atomicCourseArchiveMigration,
    /revoke update, delete on table public\.lesson from authenticated;/,
  );
  assert.match(
    atomicCourseArchiveMigration,
    /alter function public\.touch_course_from_authoring_child\(\) security definer;/,
  );
  assert.match(
    atomicCourseArchiveMigration,
    /alter function public\.touch_courses_from_stored_file\(\) security definer;/,
  );
  assert.equal(
    atomicCourseArchiveMigration.match(/attribute\.attname <> all/g)?.length,
    2,
  );
  assert.match(
    atomicCourseArchiveMigration,
    /trigger_row\.tgfoid = required_trigger\.function_id[\s\S]*?trigger_row\.tgtype = required_trigger\.trigger_type[\s\S]*?trigger_row\.tgenabled = 'O'[\s\S]*?trigger_row\.tgqual is null[\s\S]*?trigger_row\.tgattr::smallint\[\]/,
  );
  assert.equal(snapshotWorkflow.match(/attribute\.attname <> all/g)?.length, 2);
  assert.equal(
    snapshotWorkflow.match(/procedure\.proconfig is null/g)?.length,
    2,
  );
  assert.match(
    snapshotWorkflow,
    /trigger\.tgfoid = required_trigger\.function_id[\s\S]*?trigger\.tgtype = required_trigger\.trigger_type[\s\S]*?trigger\.tgenabled = 'O'[\s\S]*?trigger\.tgqual is null[\s\S]*?trigger\.tgattr::smallint\[\]/,
  );

  for (const fragment of [
    "public.archive_course(uuid)",
    "public.guard_course_archive_invariants()",
    "public.guard_course_publication_active_source()",
    "public.guard_lesson_course_immutable()",
    "public.guard_lesson_run_active_course()",
    "trg_course_archive_invariants",
    "trg_course_publication_active_source",
    "trg_lesson_course_immutable",
    "trg_lesson_run_active_course",
  ]) {
    assert.equal(
      snapshotWorkflow.includes(fragment),
      true,
      `snapshot workflow missing ${fragment}`,
    );
  }
});

test("current snapshot mirrors the A1 archive RPC and invariant triggers", () => {
  for (const functionName of [
    "archive_course",
    "guard_course_archive_invariants",
    "guard_course_publication_active_source",
    "guard_lesson_course_immutable",
    "guard_lesson_run_active_course",
  ]) {
    assert.match(
      snapshot,
      new RegExp(`CREATE FUNCTION public\\.${functionName}\\(`),
    );
  }
  for (const trigger of [
    "trg_course_archive_invariants",
    "trg_course_publication_active_source",
    "trg_lesson_course_immutable",
    "trg_lesson_run_active_course",
  ]) {
    assert.match(snapshot, new RegExp(`CREATE TRIGGER ${trigger}`));
  }
});

test("current snapshot mirrors A1 private helpers and column-only ACL", () => {
  assert.match(
    snapshot,
    /CREATE FUNCTION public\.touch_course_from_authoring_child\(\) RETURNS trigger\s+LANGUAGE plpgsql SECURITY DEFINER/,
  );
  assert.match(
    snapshot,
    /CREATE FUNCTION public\.touch_courses_from_stored_file\(\) RETURNS trigger\s+LANGUAGE plpgsql SECURITY DEFINER/,
  );
  assert.doesNotMatch(
    snapshot,
    /GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public\.course TO authenticated;/,
  );
  assert.doesNotMatch(
    snapshot,
    /GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public\.lesson TO authenticated;/,
  );
  assert.match(
    snapshot,
    /GRANT UPDATE\(title\) ON TABLE public\.course TO authenticated;/,
  );
  assert.match(
    snapshot,
    /GRANT UPDATE\("position"\) ON TABLE public\.lesson TO authenticated;/,
  );
});
