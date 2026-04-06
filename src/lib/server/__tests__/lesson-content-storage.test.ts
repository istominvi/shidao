import assert from "node:assert/strict";
import test from "node:test";
import {
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
    vocabulary_summary: ["老师", "学生"],
    phrase_summary: ["你好", "你叫什么名字", "我叫…"],
    estimated_duration_minutes: 45,
    readiness_status: "ready",
    methodology: { slug: "mandarin-a1-kids" },
    blocks: [
      {
        id: "block-2",
        block_type: "video_segment",
        sort_order: 2,
        title: "video",
        content: { promptBeforeWatch: "listen", focusPoints: ["你好"] },
        block_assets: [
          {
            sort_order: 0,
            reusable_asset_id: "asset-video-1",
            asset: {
              id: "asset-video-1",
              kind: "video",
              title: "video",
              description: null,
              source_url: "https://example.com/video.mp4",
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
        content: { taskInstruction: "do", completionMode: "home" },
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
              file_ref: "worksheet.pdf",
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
        content: { activityGoal: "repeat", teacherActions: ["sing"] },
        block_assets: [
          {
            sort_order: 0,
            reusable_asset_id: "asset-song-1",
            asset: {
              id: "asset-song-1",
              kind: "song",
              title: "song",
              description: null,
              source_url: "https://example.com/song.mp3",
              file_ref: null,
              metadata: null,
            },
          },
          {
            sort_order: 1,
            reusable_asset_id: "asset-worksheet-1",
            asset: {
              id: "asset-worksheet-1",
              kind: "worksheet",
              title: "worksheet",
              description: null,
              source_url: null,
              file_ref: "worksheet.pdf",
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

test("bootstrap fixture rows are deterministic and idempotent by stable IDs", () => {
  const first = buildFixtureBootstrapRows();
  const second = buildFixtureBootstrapRows();

  assert.equal(first.methodologyRow.id, second.methodologyRow.id);
  assert.equal(first.methodologyLessonRow.id, second.methodologyLessonRow.id);
  assert.deepEqual(first.reusableAssetRows, second.reusableAssetRows);
  assert.deepEqual(first.blockRows, second.blockRows);
  assert.deepEqual(first.blockAssetRows, second.blockAssetRows);
  assert.equal(first.blockRows.length > 0, true);
});
