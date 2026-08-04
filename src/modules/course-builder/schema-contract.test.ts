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
const snapshot = readFileSync("supabase/schema/current-schema.sql", "utf8");

function migrationFunction(name: string) {
  const start = studentSlidesMigration.indexOf(`function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = studentSlidesMigration.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return studentSlidesMigration.slice(start, end + 4);
}

const preservedBuilderTables = [
  "account",
  "course",
  "lesson",
  "stored_file",
  "course_attachment",
] as const;

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
