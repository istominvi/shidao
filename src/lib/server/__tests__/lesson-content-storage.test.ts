import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonContentFixtureMethodology,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureScheduledLesson,
} from "../../lesson-content";
import { buildFixtureBootstrapRows } from "../lesson-content-bootstrap";
import {
  mapMethodologyLessonRowToDomain,
  mapScheduledLessonRowToDomain,
  type RowMethodologyLessonWithBlocks,
  type RowScheduledLesson,
} from "../lesson-content-mappers";

function buildLessonRowFixture(): RowMethodologyLessonWithBlocks {
  return {
    id: "lesson-row-1",
    methodology_id: "methodology-1",
    title: lessonContentFixtureMethodologyLesson.shell.title,
    module_index: 1,
    unit_index: 1,
    lesson_index: 1,
    vocabulary_summary: lessonContentFixtureMethodologyLesson.shell.vocabularySummary,
    phrase_summary: lessonContentFixtureMethodologyLesson.shell.phraseSummary,
    estimated_duration_minutes: lessonContentFixtureMethodologyLesson.shell.estimatedDurationMinutes,
    readiness_status: "ready",
    methodology: {
      slug: lessonContentFixtureMethodology.slug,
      title: lessonContentFixtureMethodology.title,
    },
    blocks: [
      {
        id: "block-2",
        block_type: "video_segment",
        sort_order: 2,
        title: "video",
        content: { promptBeforeWatch: "watch", focusPoints: ["狗"] },
        block_assets: [
          {
            sort_order: 0,
            reusable_asset_id: "asset-video-1",
            asset: {
              id: "asset-video-1",
              kind: "video",
              title: "video",
              description: null,
              source_url: null,
              file_ref: null,
              metadata: null,
            },
          },
        ],
      },
      {
        id: "block-3",
        block_type: "worksheet_task",
        sort_order: 3,
        title: "worksheet",
        content: {
          taskInstruction: "Выполнить задание",
          completionMode: "in_class",
        },
        block_assets: [
          {
            sort_order: 0,
            reusable_asset_id: "asset-worksheet-1",
            asset: {
              id: "asset-worksheet-1",
              kind: "worksheet",
              title: "worksheet",
              description: null,
              source_url: null,
              file_ref: null,
              metadata: null,
            },
          },
        ],
      },
      {
        id: "block-1",
        block_type: "song_segment",
        sort_order: 1,
        title: "song",
        content: { activityGoal: "sing", teacherActions: ["repeat"] },
        block_assets: [
          {
            sort_order: 0,
            reusable_asset_id: "asset-song-1",
            asset: {
              id: "asset-song-1",
              kind: "song",
              title: "song",
              description: null,
              source_url: null,
              file_ref: null,
              metadata: null,
            },
          },
        ],
      },
    ],
  };
}

test("methodology lesson mapper returns domain shape with block ordering", () => {
  const lesson = mapMethodologyLessonRowToDomain(buildLessonRowFixture());

  assert.equal(lesson.id, "lesson-row-1");
  assert.equal(lesson.shell.methodologyId, "methodology-1");
  assert.deepEqual(
    lesson.blocks.map((block) => block.order),
    [1, 2, 3],
  );
});

test("methodology lesson mapper computes media summary from linked assets", () => {
  const lesson = mapMethodologyLessonRowToDomain(buildLessonRowFixture());

  assert.deepEqual(lesson.shell.mediaSummary, {
    videos: 1,
    songs: 1,
    worksheets: 1,
    other: 0,
  });
});

test("scheduled lesson mapper enforces online and offline runtime shell shape", () => {
  const onlineRow: RowScheduledLesson = {
    id: "scheduled-1",
    class_id: "class-1",
    methodology_lesson_id: "lesson-1",
    starts_at: lessonContentFixtureScheduledLesson.runtimeShell.startsAt,
    format: "online",
    meeting_link: "https://meet.example.com/x",
    place: null,
    runtime_status: "planned",
    runtime_notes_summary: "summary",
    runtime_notes: null,
    outcome_notes: null,
  };

  const offlineRow: RowScheduledLesson = {
    ...onlineRow,
    id: "scheduled-2",
    format: "offline",
    meeting_link: null,
    place: "Room 204",
  };

  const online = mapScheduledLessonRowToDomain(onlineRow);
  const offline = mapScheduledLessonRowToDomain(offlineRow);

  assert.equal(online.runtimeShell.format, "online");
  assert.equal("place" in online.runtimeShell, false);
  assert.equal(offline.runtimeShell.format, "offline");
  assert.equal("meetingLink" in offline.runtimeShell, false);
});

test("scheduled lesson domain does not include runtime block override structure", () => {
  const scheduled = mapScheduledLessonRowToDomain({
    id: "scheduled-1",
    class_id: "class-1",
    methodology_lesson_id: "lesson-1",
    starts_at: lessonContentFixtureScheduledLesson.runtimeShell.startsAt,
    format: "online",
    meeting_link: "https://meet.example.com/x",
    place: null,
    runtime_status: "planned",
    runtime_notes_summary: null,
    runtime_notes: "runtime",
    outcome_notes: "outcome",
  });

  assert.equal("blockOverrides" in scheduled, false);
  assert.equal("blocks" in scheduled, false);
});

test("bootstrap fixture rows import the real methodology lesson shell for lesson 1", () => {
  const rows = buildFixtureBootstrapRows();

  assert.equal(rows.methodologyRow.slug, "world-around-me");
  assert.equal(rows.methodologyRow.title, "Мир вокруг меня — 我周围的世界");
  assert.equal(rows.methodologyLessonRow.title, "Урок 1. Животные на ферме");
  assert.deepEqual(rows.methodologyLessonRow.vocabulary_summary, [
    "狗",
    "猫",
    "兔子",
    "马",
    "农场",
    "跑",
    "跳",
  ]);
  assert.deepEqual(rows.methodologyLessonRow.phrase_summary, [
    "我是…",
    "这是…",
    "我们…吧！",
    "在…里",
  ]);
});

test("real lesson block mapping keeps order and expected vocabulary/phrases", () => {
  const rows = buildFixtureBootstrapRows();

  assert.equal(rows.blockRows.length >= 10, true);
  assert.deepEqual(
    rows.blockRows.map((block) => block.sort_order),
    [...rows.blockRows]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((block) => block.sort_order),
  );

  const vocabBlock = rows.blockRows.find((block) => block.block_type === "vocabulary_focus");
  assert.ok(vocabBlock);

  const vocabContent = vocabBlock.content as {
    items: Array<{ term: string }>;
  };

  assert.equal(vocabContent.items.some((item) => item.term === "农场"), true);
  assert.equal(vocabContent.items.some((item) => item.term === "我们…吧！"), true);

  const promptBlock = rows.blockRows.find((block) => block.block_type === "teacher_prompt_pattern");
  assert.ok(promptBlock);
  const promptContent = promptBlock.content as { promptPatterns: string[] };
  assert.equal(promptContent.promptPatterns.includes("你是谁？"), true);
});

test("bootstrap fixture rows are deterministic and idempotent by stable IDs", () => {
  const first = buildFixtureBootstrapRows();
  const second = buildFixtureBootstrapRows();

  assert.equal(first.methodologyRow.id, second.methodologyRow.id);
  assert.equal(first.methodologyLessonRow.id, second.methodologyLessonRow.id);
  assert.equal(first.scheduledLessonRow.id, second.scheduledLessonRow.id);
  assert.deepEqual(first.reusableAssetRows, second.reusableAssetRows);
  assert.deepEqual(first.blockRows, second.blockRows);
  assert.deepEqual(first.blockAssetRows, second.blockAssetRows);
  assert.equal(first.blockRows.length > 0, true);
  assert.match(
    first.scheduledLessonRow.class_id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("bootstrap rows allow overriding scheduled lesson class id for real teacher class", () => {
  const classId = "11111111-1111-4111-8111-111111111111";
  const rows = buildFixtureBootstrapRows({ scheduledLessonClassId: classId });

  assert.equal(rows.scheduledLessonRow.class_id, classId);
});
