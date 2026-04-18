import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const fixtureSource = readFileSync("src/lib/lesson-content/fixtures.ts", "utf8");
const migrationSource = readFileSync(
  "supabase/migrations/202604180001_world_around_me_lesson1_finalize_patch.sql",
  "utf8",
);

test("lesson 1 fixtures and migration no longer use watercolor paths", () => {
  assert.equal(
    fixtureSource.includes("/methodologies/world-around-me/lesson-1/watercolor/"),
    false,
  );
  assert.equal(
    migrationSource.includes("/methodologies/world-around-me/lesson-1/watercolor/"),
    false,
  );
  assert.equal(fixtureSource.includes("/methodologies/world-around-me/lesson-1/visuals/"), true);
  assert.equal(migrationSource.includes("/methodologies/world-around-me/lesson-1/visuals/"), true);
});

test("lesson 2 no longer references deleted lesson 1 action svgs", () => {
  assert.equal(migrationSource.includes("/methodologies/world-around-me/lesson-1/run.svg"), true);
  assert.equal(migrationSource.includes("/methodologies/world-around-me/lesson-1/jump.svg"), true);
  assert.equal(
    migrationSource.includes("/methodologies/world-around-me/lesson-1/visuals/run-action.png"),
    true,
  );
  assert.equal(
    migrationSource.includes("/methodologies/world-around-me/lesson-1/visuals/jump-action.png"),
    true,
  );
});

test("lesson 1 migration contains full methodology hub payload markers", () => {
  assert.equal(migrationSource.includes('"type":"presentation"'), true);
  assert.equal(migrationSource.includes('"type":"resource_links"'), true);
  assert.equal(migrationSource.includes('"type":"word_list"'), true);
  assert.equal(migrationSource.includes('"phrases-actions"'), true);
  assert.equal(migrationSource.includes('"g5"'), true);
});
