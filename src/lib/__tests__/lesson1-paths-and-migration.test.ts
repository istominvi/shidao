import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const fixtureSource = readFileSync("src/lib/lesson-content/fixtures.ts", "utf8");
const migrationSource = readFileSync(
  "supabase/migrations/202604180001_world_around_me_lesson1_finalize_patch.sql",
  "utf8",
);
const kindMigrationSource = readFileSync(
  "supabase/migrations/202604180002_world_around_me_lesson1_asset_kind_alignment.sql",
  "utf8",
);
const stepOneVideosMigrationSource = readFileSync(
  "supabase/migrations/202604200001_world_around_me_lesson1_add_video_playlist_assets.sql",
  "utf8",
);

test("lesson 1 fixtures and migration use canonical visual paths", () => {
  assert.equal(
    fixtureSource.includes("/methodologies/world-around-me/lesson-1/watercolor/"),
    false,
  );
  assert.equal(
    fixtureSource.includes("/methodologies/world-around-me/lesson-1/run.svg"),
    false,
  );
  assert.equal(
    fixtureSource.includes("/methodologies/world-around-me/lesson-1/jump.svg"),
    false,
  );

  assert.equal(
    migrationSource.includes("/methodologies/world-around-me/lesson-1/watercolor/"),
    false,
  );
  assert.equal(migrationSource.includes("/methodologies/world-around-me/lesson-1/visuals/"), true);
  assert.equal(
    migrationSource.includes("/methodologies/world-around-me/lesson-1/visuals/run-action.png"),
    true,
  );
  assert.equal(
    migrationSource.includes("/methodologies/world-around-me/lesson-1/visuals/jump-action.png"),
    true,
  );
});

test("lesson 2 repair keeps old action paths only as replace search strings", () => {
  assert.equal(migrationSource.includes("/methodologies/world-around-me/lesson-1/run.svg"), true);
  assert.equal(migrationSource.includes("/methodologies/world-around-me/lesson-1/jump.svg"), true);
  assert.equal(
    migrationSource.includes(
      "replace(\n    msc.content_payload::text,\n    '/methodologies/world-around-me/lesson-1/run.svg'",
    ),
    true,
  );
  assert.equal(
    migrationSource.includes(
      "'/methodologies/world-around-me/lesson-1/jump.svg',\n  '/methodologies/world-around-me/lesson-1/visuals/jump-action.png'",
    ),
    true,
  );
});

test("lesson 1 migration contains complete hub payload markers", () => {
  assert.equal(migrationSource.includes('"slideImageRefs"'), true);
  assert.equal(migrationSource.includes('"cardImageRefs"'), true);
  assert.equal(migrationSource.includes('"previewImageRef"'), true);
  assert.equal(migrationSource.includes('"type":"word_list"'), true);
  assert.equal(migrationSource.includes('"audio-review-l1"'), true);
  assert.equal(migrationSource.includes('"phrases-actions"'), true);
  assert.equal(migrationSource.includes('"g5"'), true);
});


test("lesson 1 migration aligns reusable asset kinds with fixture semantics", () => {
  assert.equal(kindMigrationSource.includes("drop constraint if exists reusable_asset_kind_check"), true);
  assert.equal(kindMigrationSource.includes("'flashcards_pdf'"), true);
  assert.equal(kindMigrationSource.includes("('presentation', 'presentation:world-around-me-lesson-1'"), true);
  assert.equal(kindMigrationSource.includes("('flashcards_pdf', 'flashcards:world-around-me-lesson-1'"), true);
  assert.equal(kindMigrationSource.includes("('worksheet_pdf', 'worksheet:appendix-1'"), true);
  assert.equal(kindMigrationSource.includes("('song_audio', 'song:farm-animals'"), true);
  assert.equal(kindMigrationSource.includes("('song_video', 'song-video:farm-animals-movement'"), true);
  assert.equal(kindMigrationSource.includes("('pronunciation_audio', 'pronunciation:dog'"), true);
});

test("lesson 1 migration persists full homework practice sections and local audio paths", () => {
  assert.equal(migrationSource.includes('"practiceSections"'), true);
  assert.equal(
    migrationSource.includes('"audioUrl":"/methodologies/world-around-me/lesson-1/audio/gou.mp3"'),
    true,
  );
  assert.equal(
    migrationSource.includes('"audioUrl":"/methodologies/world-around-me/lesson-1/audio/zai.mp3"'),
    true,
  );
});

test("lesson 1 step 1 playlist migration registers all local farm videos", () => {
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/e.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/gou.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/mao.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/tu.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/ma.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/zhu.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/nainiu.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/yang.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/ya.mp4"),
    true,
  );
  assert.equal(
    stepOneVideosMigrationSource.includes("/methodologies/world-around-me/lesson-1/media/ji.mp4"),
    true,
  );
});
