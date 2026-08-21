import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260821181832_lesson_homework_authoring.sql";
const migration = readFileSync(migrationPath, "utf8");
const hardeningMigration = readFileSync(
  "supabase/migrations/20260821193000_harden_lesson_homework_rpc_validation.sql",
  "utf8",
);

function migrationFunction(name: string, source = migration) {
  const start = source.indexOf(`function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = source.indexOf("\n$function$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return source.slice(start, end + "\n$function$;".length);
}

test("Homework base and direct-RPC hardening are guarded forward migrations", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\ncommit;\n$/);
  assert.match(hardeningMigration, /^begin;\n/);
  assert.match(hardeningMigration, /\ncommit;\n$/);
  assert.doesNotMatch(
    `${migration}\n${hardeningMigration}`,
    /drop\s+(?:table|schema|function)[^;]*\bcascade\b/i,
  );
  assert.match(migration, /shidao_homework_schema_sanity_check_failed/);
  assert.match(migration, /v_table_count <> 74 or v_function_count <> 275/);
  assert.match(migration, /lesson_homework_postflight_inventory_mismatch/);
  assert.match(migration, /v_table_count <> 76 or v_function_count <> 278/);
  assert.match(migration, /lesson_homework_migration_created_product_data/);
  assert.match(hardeningMigration, /lesson_homework_hardening_head_mismatch/);
  assert.match(
    hardeningMigration,
    /lesson_homework_hardening_definition_incomplete/,
  );
});

test("separate Lesson owner/items enforce exactly-one and dense ordering", () => {
  assert.match(
    migration,
    /create table public\.lesson_homework \([\s\S]*?lesson_id uuid not null[\s\S]*?references public\.lesson\(id\) on delete cascade[\s\S]*?unique \(lesson_id\)/,
  );
  assert.match(
    migration,
    /create table public\.lesson_homework_item \([\s\S]*?lesson_homework_id uuid not null[\s\S]*?on delete cascade/,
  );
  assert.match(
    migration,
    /unique \(lesson_homework_id, position\)[\s\S]*?deferrable initially deferred/,
  );
  assert.match(
    migration,
    /type_key in \('rich_text', 'image', 'external_link', 'file'\)/,
  );
  assert.doesNotMatch(
    migration.slice(
      migration.indexOf("create table public.lesson_homework_item"),
      migration.indexOf("alter table public.lesson_homework enable"),
    ),
    /lesson_component|student_slide|learner|attempt|response|evidence|due_date|activity_role|objective/,
  );
});

test("raw relations are closed and only narrow owner RPCs are callable", () => {
  for (const table of ["lesson_homework", "lesson_homework_item"]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated, service_role;`,
      ),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`create policy[^;]+on public\\.${table}`),
    );
  }

  const read = migrationFunction("get_my_lesson_homework");
  const replace = migrationFunction(
    "replace_my_lesson_homework",
    hardeningMigration,
  );
  for (const definition of [read, replace]) {
    assert.match(definition, /security definer/);
    assert.match(definition, /set search_path = ''/);
    assert.match(definition, /course\.owner_account_id = v_actor_account_id/);
    assert.match(definition, /course\.archived_at is null/);
    assert.match(definition, /account\.can_author_educator_courses/);
  }
  assert.match(read, /current_active_session_account_id\(\)/);
  assert.match(replace, /lock_current_account_session_authority/);
  assert.match(
    migration,
    /grant execute on function public\.get_my_lesson_homework\(uuid\)[\s\S]*?to authenticated, postgres/,
  );
  assert.match(
    migration,
    /grant execute on function public\.replace_my_lesson_homework\([\s\S]*?to authenticated, postgres/,
  );
});

test("full-list replace derives positions atomically and rejects stale input", () => {
  const replace = migrationFunction(
    "replace_my_lesson_homework",
    hardeningMigration,
  );
  assert.match(replace, /jsonb_array_length\(p_items\)/);
  assert.match(replace, /octet_length\(p_items::text\) > 524288/);
  assert.match(replace, /lesson_homework_item_invalid/);
  assert.match(replace, /lesson_homework_item_id_duplicate/);
  assert.match(replace, /lesson_homework_revision_conflict/);
  assert.match(replace, /using errcode = '40001'/);
  assert.match(replace, /for update of course/);
  assert.match(replace, /for update of lesson/);
  assert.match(replace, /for update of homework/);
  assert.match(replace, /order by item\.id[\s\S]*?for update of item/);
  assert.match(
    replace,
    /jsonb_array_elements\(p_items\)[\s\S]*?with ordinality as entry\(value, position\)/,
  );
});

test("clear stays monotonic and cannot recreate revision one through ABA", () => {
  const replace = migrationFunction(
    "replace_my_lesson_homework",
    hardeningMigration,
  );
  assert.doesNotMatch(replace, /delete from public\.lesson_homework\b/);
  assert.match(
    replace,
    /if v_item_count = 0 then[\s\S]*?set revision = homework\.revision \+ 1[\s\S]*?delete from public\.lesson_homework_item[\s\S]*?build_lesson_homework_projection\(v_homework\.id\)/,
  );
});

test("Lesson delete locks/cascades Homework and authoring has no learner side effects", () => {
  const deletion = migrationFunction("delete_lesson_with_history");
  const replace = migrationFunction(
    "replace_my_lesson_homework",
    hardeningMigration,
  );
  assert.match(
    deletion,
    /public\.lesson_homework as homework[\s\S]*?for update of homework[\s\S]*?public\.lesson_homework_item as item[\s\S]*?for update of item/,
  );
  assert.doesNotMatch(
    replace,
    /lesson_component|lesson_run|learning_record|learning_evidence|choice_quiz|learner_profile|notification/,
  );
});

test("direct authenticated replace enforces registry shapes and Course assets", () => {
  const replace = migrationFunction(
    "replace_my_lesson_homework",
    hardeningMigration,
  );
  for (const marker of [
    "when 'rich_text' then not",
    "when 'image' then not",
    "when 'external_link' then not",
    "when 'file' then not",
    "public.course_attachment as attachment",
    "public.stored_file as stored_file",
    "stored_file.status = 'ready'",
    "stored_file.mime_type like 'image/%'",
  ]) {
    assert.equal(replace.includes(marker), true, `missing ${marker}`);
  }
  assert.match(replace, /where attachment\.course_id = v_course_id/);
  assert.match(replace, /stored_file\.owner_account_id = v_actor_account_id/);
});
