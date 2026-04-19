import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/202604190001_scheduled_lesson_live_step_runtime.sql",
  "utf8",
);
const snapshot = readFileSync("supabase/schema/current-schema.sql", "utf8");

test("scheduled lesson live runtime migration adds minimal current step state columns", () => {
  assert.equal(migration.includes("runtime_current_step_id text"), true);
  assert.equal(migration.includes("runtime_current_step_order integer"), true);
  assert.equal(migration.includes("runtime_student_navigation_locked boolean not null default true"), true);
  assert.equal(migration.includes("runtime_step_updated_at timestamptz"), true);
  assert.equal(migration.includes("runtime_started_at timestamptz"), true);
  assert.equal(migration.includes("runtime_completed_at timestamptz"), true);
});

test("schema snapshot contains scheduled lesson live runtime columns", () => {
  assert.equal(snapshot.includes("runtime_current_step_id text"), true);
  assert.equal(snapshot.includes("runtime_current_step_order integer"), true);
  assert.equal(snapshot.includes("runtime_student_navigation_locked boolean not null default true"), true);
});
