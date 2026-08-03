import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260803142924_v2_course_builder_vertical_slice.sql",
  "utf8",
);
const snapshot = readFileSync("supabase/schema/current-schema.sql", "utf8");

const v2Tables = [
  "account",
  "course",
  "lesson",
  "lesson_step",
  "lesson_step_component",
  "stored_file",
  "course_attachment",
] as const;

test("V2 Course Builder migration is one transactional forward change", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\ncommit;\n$/);
  assert.equal(migration.includes("drop schema"), false);
  assert.equal(migration.includes("service_role"), false);

  for (const table of v2Tables) {
    assert.equal(
      migration.includes(`create table public.${table} (`),
      true,
      `missing migration table ${table}`,
    );
    assert.equal(
      migration.includes(
        `alter table public.${table} enable row level security;`,
      ),
      true,
      `RLS is not enabled for ${table}`,
    );
    assert.equal(
      snapshot.includes(`create table if not exists public.${table} (`),
      true,
      `current schema snapshot is missing ${table}`,
    );
  }
});

test("Course persists the complete first-milestone form and assembler marker", () => {
  for (const column of [
    "subject text",
    "goal text",
    "level text",
    "audience_description text",
    "target_lesson_count integer",
    "teacher_preferences text",
    "assembled_at timestamptz",
  ]) {
    assert.equal(
      migration.includes(column),
      true,
      `missing Course field ${column}`,
    );
    assert.equal(
      snapshot.includes(column),
      true,
      `snapshot missing Course field ${column}`,
    );
  }

  assert.equal(
    migration.includes(
      "audience_type text not null default 'none' check (audience_type = 'none')",
    ),
    true,
  );
});

test("Lesson, Lesson Step and components have deferrable ordered positions", () => {
  assert.equal(
    migration.includes(
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
  assert.equal(
    migration.includes(
      "unique (lesson_step_id, position) deferrable initially deferred",
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

test("Account bootstrap covers every Auth identity and stays least privilege", () => {
  assert.equal(migration.includes("from auth.users as users"), true);
  assert.equal(
    migration.includes("function public.handle_auth_user_account()"),
    true,
  );
  assert.equal(migration.includes("after insert on auth.users"), true);
  assert.equal(migration.includes("after insert on public.teacher"), false);
  assert.equal(migration.includes("after insert on public.parent"), false);
  assert.equal(migration.includes("student.user_id = users.id"), true);
  assert.equal(migration.includes("student.user_id = new.user_id"), false);
  assert.equal(
    migration.includes("security definer\nset search_path = ''"),
    true,
  );
  assert.equal(
    migration.includes(
      "revoke all on function public.handle_auth_user_account()\nfrom public, anon, authenticated;",
    ),
    true,
  );

  assert.equal(
    migration.includes("function public.current_account_id()"),
    true,
  );
  assert.equal(
    migration.includes("security invoker\nset search_path = ''"),
    true,
  );
  assert.equal(
    migration.includes(
      "grant execute on function public.current_account_id() to authenticated;",
    ),
    true,
  );
  assert.equal(migration.includes("current_student_id"), false);
  assert.equal(migration.includes("current_teacher_id"), false);
  assert.equal(migration.includes("current_parent_id"), false);
  assert.equal(
    migration.includes(
      "grant select on table public.account to authenticated;",
    ),
    true,
  );
  assert.equal(
    migration.includes(
      "grant select, insert, update, delete on table\n  public.account",
    ),
    false,
  );
  assert.equal(
    migration.includes("function public.current_session_invalid_before()"),
    true,
  );
  assert.equal(
    migration.includes("where security.user_id = (select auth.uid())"),
    true,
  );
  assert.equal(
    migration.includes(
      "grant execute on function public.current_session_invalid_before()\nto authenticated;",
    ),
    true,
  );
});

test("component reorder RPC is atomic, RLS-bound and authenticated-only", () => {
  assert.equal(
    migration.includes("function public.reorder_lesson_step_component("),
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
      "grant execute on function public.reorder_lesson_step_component(uuid, integer)\nto authenticated;",
    ),
    true,
  );
  assert.equal(
    migration.includes(
      "revoke all on function public.reorder_lesson_step_component(uuid, integer)\nfrom public, anon;",
    ),
    true,
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
      ") to authenticated;\n\n-- -----------------------------------------------------------------------------\n-- Atomic component reorder",
    ),
    true,
  );
});

test("ordered Lesson, Step and component lists compact after delete", () => {
  for (const fragment of [
    "function public.compact_course_lesson_positions()",
    "function public.compact_lesson_step_positions()",
    "function public.compact_step_component_positions()",
    "after delete on public.lesson",
    "after delete on public.lesson_step",
    "after delete on public.lesson_step_component",
  ]) {
    assert.equal(migration.includes(fragment), true, `missing ${fragment}`);
  }
});

test("private Course Storage is size, MIME and Account-folder restricted", () => {
  assert.equal(migration.includes("'course-assets'"), true);
  assert.equal(migration.includes("10485760"), true);
  assert.equal(migration.includes("'image/jpeg'"), true);
  assert.equal(migration.includes("'application/pdf'"), true);
  assert.equal(
    migration.includes(
      "'application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
    ),
    true,
  );
  assert.equal(
    migration.includes(
      "'application/vnd.openxmlformats-officedocument.presentationml.presentation'",
    ),
    true,
  );
  assert.equal(migration.includes("status in ('pending', 'ready')"), true);
  assert.equal(
    migration.includes(
      "split_part(storage_path, '/', 1) = owner_account_id::text",
    ),
    true,
  );
  assert.equal(
    migration.includes(
      "(storage.foldername(name))[1] = (select public.current_account_id())::text",
    ),
    true,
  );

  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.equal(
      migration.includes(`create policy course_assets_owner_${operation}`),
      true,
      `missing Storage ${operation} policy`,
    );
  }
});
