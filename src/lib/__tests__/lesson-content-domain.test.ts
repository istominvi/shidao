import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLearnerLessonProjection,
  buildTeacherLessonProjection,
  isMethodologyLessonShell,
  isRuntimeLessonFormat,
  isScheduledLessonRuntimeShell,
  lessonContentFixtureAssets,
  lessonContentFixtureBlocks,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureScheduledLesson,
  sortLessonBlocks,
  summarizeAssetsByKind,
} from "../lesson-content";
import type {
  LessonBlockType,
  ScheduledLessonRuntimeShell,
  WorksheetTaskBlock,
} from "../lesson-content";

test("methodology shell and scheduled runtime shell remain separate concepts", () => {
  const methodologyShell = lessonContentFixtureMethodologyLesson.shell;
  const runtimeShell = lessonContentFixtureScheduledLesson.runtimeShell;

  assert.equal(isMethodologyLessonShell(methodologyShell), true);
  assert.equal(isScheduledLessonRuntimeShell(runtimeShell), true);
  assert.equal("readinessStatus" in runtimeShell, false);
  assert.equal("runtimeStatus" in methodologyShell, false);
});

test("runtime lesson format accepts only online and offline", () => {
  assert.equal(isRuntimeLessonFormat("online"), true);
  assert.equal(isRuntimeLessonFormat("offline"), true);
  assert.equal(isRuntimeLessonFormat("hybrid"), false);
});


test("worksheet completion mode supports only in_class and home", () => {
  const worksheetBlock = lessonContentFixtureBlocks.find(
    (block): block is WorksheetTaskBlock => block.blockType === "worksheet_task",
  );

  assert.ok(worksheetBlock);
  assert.equal(worksheetBlock.content.completionMode === "in_class", true);

  // @ts-expect-error hybrid_flow is not part of MVP completion modes
  const invalidMode: WorksheetTaskBlock["content"]["completionMode"] = "hybrid_flow";
  assert.equal(invalidMode, "hybrid_flow");
});

test("online runtime shell requires meetingLink and disallows place", () => {
  const onlineShell = lessonContentFixtureScheduledLesson.runtimeShell;

  assert.equal(onlineShell.format, "online");
  assert.equal(typeof onlineShell.meetingLink, "string");
  assert.equal("place" in onlineShell, false);

  // @ts-expect-error online shell must not provide place
  const invalidOnlineShell: ScheduledLessonRuntimeShell = {
    id: "runtime-shell:invalid-online",
    classId: "class:red-dragons",
    startsAt: "2026-04-07T15:00:00.000Z",
    format: "online",
    meetingLink: "https://meet.example.local/class-red-dragons",
    place: "Classroom A",
    runtimeStatus: "planned",
  };
  assert.equal(invalidOnlineShell.format, "online");
});

test("offline runtime shell requires place and disallows meetingLink", () => {
  const offlineShell: ScheduledLessonRuntimeShell = {
    id: "runtime-shell:offline-example",
    classId: "class:red-dragons",
    startsAt: "2026-04-09T15:00:00.000Z",
    format: "offline",
    place: "Room 204",
    runtimeStatus: "planned",
  };

  assert.equal(offlineShell.format, "offline");
  assert.equal(typeof offlineShell.place, "string");
  assert.equal("meetingLink" in offlineShell, false);

  // @ts-expect-error offline shell must not provide meetingLink
  const invalidOfflineShell: ScheduledLessonRuntimeShell = {
    ...offlineShell,
    meetingLink: "https://meet.example.local/class-red-dragons",
  };
  assert.equal(invalidOfflineShell.format, "offline");
});

test("lesson blocks preserve ordering semantics via helper", () => {
  const shuffled = [
    lessonContentFixtureBlocks[3],
    lessonContentFixtureBlocks[0],
    lessonContentFixtureBlocks[8],
  ];

  const ordered = sortLessonBlocks(shuffled);

  assert.deepEqual(
    ordered.map((block) => block.order),
    [1, 4, 9],
  );
});

test("teacher projection includes runtime and outcome notes", () => {
  const teacherProjection = buildTeacherLessonProjection(
    lessonContentFixtureMethodologyLesson,
    {
      ...lessonContentFixtureScheduledLesson,
      runtimeNotes: "Runtime note for teacher",
      outcomeNotes: "Outcome note for teacher",
    },
  );

  assert.equal(teacherProjection.runtimeNotes, "Runtime note for teacher");
  assert.equal(teacherProjection.outcomeNotes, "Outcome note for teacher");
});

test("learner projection excludes teacher-only notes", () => {
  const learnerProjection = buildLearnerLessonProjection(
    lessonContentFixtureMethodologyLesson,
    {
      ...lessonContentFixtureScheduledLesson,
      runtimeNotes: "teacher-only",
      outcomeNotes: "teacher-only",
    },
    lessonContentFixtureAssets,
  );

  assert.equal("runtimeNotes" in learnerProjection, false);
  assert.equal("outcomeNotes" in learnerProjection, false);
  assert.equal(learnerProjection.mediaLinks.length > 0, true);
});

test("scheduled lesson contract does not expose per-block override structure", () => {
  assert.equal(
    "blockOverrides" in lessonContentFixtureScheduledLesson,
    false,
  );
  assert.equal(
    "blocks" in lessonContentFixtureScheduledLesson,
    false,
  );
});

test("fixture block taxonomy satisfies discriminated union coverage", () => {
  const seenBlockTypes = new Set(
    lessonContentFixtureBlocks.map((block) => block.blockType),
  );
  const expected: LessonBlockType[] = [
    "intro_framing",
    "video_segment",
    "song_segment",
    "vocabulary_focus",
    "teacher_prompt_pattern",
    "guided_activity",
    "materials_prep",
    "worksheet_task",
    "wrap_up_closure",
  ];

  assert.deepEqual(Array.from(seenBlockTypes).sort(), [...expected].sort());
});

test("asset summary helper groups reusable assets by kind", () => {
  const summary = summarizeAssetsByKind(lessonContentFixtureAssets);

  assert.equal(summary.video, 1);
  assert.equal(summary.song, 1);
  assert.equal(summary.worksheet, 1);
});
