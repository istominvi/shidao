import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLearnerLessonProjection,
  buildTeacherLessonProjection,
  getFixtureStudentContentFallback,
  isMethodologyLessonShell,
  isRuntimeLessonFormat,
  isScheduledLessonRuntimeShell,
  lessonContentFixtureAssets,
  lessonContentFixtureBlocks,
  lessonContentFixtureHomeworkDefinitionLessonTwo,
  lessonContentFixtureHomeworkDefinitionLessonThree,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureMethodologyLessonStudentContent,
  lessonContentFixtureMethodologyLessonStudentContentLessonTwo,
  lessonContentFixtureMethodologyLessonStudentContentLessonThree,
  lessonContentFixtureMethodologyLessons,
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
  const onlineShell: ScheduledLessonRuntimeShell = {
    id: "runtime-shell:online-example",
    classId: "class:demo-world-around-me",
    startsAt: "2026-04-08T15:00:00.000Z",
    format: "online",
    meetingLink: "https://meet.example.local/demo-world-around-me",
    runtimeStatus: "planned",
  };

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
  assert.equal(Array.isArray(learnerProjection.mediaLinks), true);
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

  assert.equal(summary.lesson_video >= 1, true);
  assert.equal(summary.presentation >= 1, true);
  assert.equal(summary.flashcards_pdf >= 1, true);
  assert.equal(summary.pronunciation_audio >= 5, true);
  assert.equal(summary.worksheet + summary.worksheet_pdf >= 6, true);
});

test("world-around-me fixtures provide at least three canonical lessons", () => {
  assert.equal(lessonContentFixtureMethodologyLessons.length >= 3, true);
  const lessonOne = lessonContentFixtureMethodologyLessons.find(
    (lesson) => lesson.shell.position.lessonIndex === 1,
  );
  const lessonTwo = lessonContentFixtureMethodologyLessons.find(
    (lesson) => lesson.shell.position.lessonIndex === 2,
  );
  const lessonThree = lessonContentFixtureMethodologyLessons.find(
    (lesson) => lesson.shell.position.lessonIndex === 3,
  );

  assert.ok(lessonOne);
  assert.ok(lessonTwo);
  assert.ok(lessonThree);
  assert.equal(lessonTwo.shell.title, "Урок 2. Что это за животное?");
  assert.equal(lessonThree.shell.title, "Урок 3. Этот разноцветный мир");
  assert.equal(lessonTwo.shell.vocabularySummary.includes("房子"), true);
  assert.equal(lessonThree.shell.vocabularySummary.includes("车"), true);
  assert.equal(
    lessonContentFixtureHomeworkDefinitionLessonTwo.quiz?.questions.length,
    6,
  );
  assert.equal(
    lessonContentFixtureHomeworkDefinitionLessonThree.quiz?.questions.length,
    6,
  );
});

test("fallback resolver returns lesson 2 learner content by title and position", () => {
  const byPosition = getFixtureStudentContentFallback({
    methodologySlug: "world-around-me",
    moduleIndex: 1,
    lessonIndex: 2,
  });
  const byTitle = getFixtureStudentContentFallback({
    methodologySlug: "world-around-me",
    lessonTitle: "Урок 2. Что это за животное?",
  });

  assert.ok(byPosition);
  assert.ok(byTitle);
  assert.equal(
    byPosition.source.id,
    lessonContentFixtureMethodologyLessonStudentContentLessonTwo.id,
  );
  assert.equal(byTitle.source.id, byPosition.source.id);
  assert.equal(
    byPosition.assets.some((asset) => asset.id === "worksheet:workbook-page-5"),
    true,
  );
});

test("fallback resolver returns lesson 3 learner content by title and position", () => {
  const byPosition = getFixtureStudentContentFallback({
    methodologySlug: "world-around-me",
    moduleIndex: 1,
    lessonIndex: 3,
  });
  const byTitle = getFixtureStudentContentFallback({
    methodologySlug: "world-around-me",
    lessonTitle: "Урок 3. Этот разноцветный мир",
  });

  assert.ok(byPosition);
  assert.ok(byTitle);
  assert.equal(
    byPosition.source.id,
    lessonContentFixtureMethodologyLessonStudentContentLessonThree.id,
  );
  assert.equal(byTitle.source.id, byPosition.source.id);
  assert.equal(
    byPosition.assets.some((asset) => asset.id === "worksheet:workbook-page-6"),
    true,
  );
});

test("lesson 1 learner content keeps upgraded hub sections and watercolor illustration assets", () => {
  const sectionIllustrations = lessonContentFixtureMethodologyLessonStudentContent.sections
    .map((section) => ("illustrationSrc" in section ? section.illustrationSrc : undefined))
    .filter((path): path is string => typeof path === "string");

  assert.equal(
    sectionIllustrations.includes("/methodologies/world-around-me/lesson-1/watercolor/hero-farm.png"),
    true,
  );
  assert.equal(
    sectionIllustrations.includes("/methodologies/world-around-me/lesson-1/watercolor/farm-barn.png"),
    true,
  );
  assert.equal(
    sectionIllustrations.includes("/methodologies/world-around-me/lesson-1/watercolor/workbook-practice.png"),
    true,
  );

  const vocabSection = lessonContentFixtureMethodologyLessonStudentContent.sections.find(
    (section) => section.type === "vocabulary_cards",
  );
  assert.ok(vocabSection);
  const vocabIllustrations = vocabSection.items.map((item) => item.illustrationSrc);
  assert.deepEqual(vocabIllustrations.slice(0, 4), [
    "/methodologies/world-around-me/lesson-1/watercolor/dog-card.png",
    "/methodologies/world-around-me/lesson-1/watercolor/cat-card.png",
    "/methodologies/world-around-me/lesson-1/watercolor/rabbit-card.png",
    "/methodologies/world-around-me/lesson-1/watercolor/horse-card.png",
  ]);
  assert.equal(vocabSection.displayMode, "carousel");

  const actionSection = lessonContentFixtureMethodologyLessonStudentContent.sections.find(
    (section) => section.type === "action_cards",
  );
  assert.ok(actionSection);
  assert.equal(actionSection.displayMode, "slider");
  assert.deepEqual(
    actionSection.items.slice(0, 2).map((item) => item.illustrationSrc),
    [
      "/methodologies/world-around-me/lesson-1/watercolor/run-action.png",
      "/methodologies/world-around-me/lesson-1/watercolor/jump-action.png",
    ],
  );

  assert.equal(
    lessonContentFixtureMethodologyLessonStudentContent.sections.some(
      (section) => section.type === "presentation",
    ),
    true,
  );
  assert.equal(
    lessonContentFixtureMethodologyLessonStudentContent.sections.some(
      (section) => section.type === "count_board",
    ),
    true,
  );
  assert.equal(
    lessonContentFixtureMethodologyLessonStudentContent.sections.some(
      (section) => section.type === "word_list",
    ),
    true,
  );
});

test("lesson 2 and lesson 3 learner content illustration paths remain unchanged", () => {
  const lessonTwoActionSection = lessonContentFixtureMethodologyLessonStudentContentLessonTwo.sections.find(
    (section) => section.type === "action_cards",
  );
  assert.ok(lessonTwoActionSection);
  assert.equal(
    lessonTwoActionSection.items.some(
      (item) => item.illustrationSrc === "/methodologies/world-around-me/lesson-1/run.svg",
    ),
    true,
  );
  assert.equal(
    lessonTwoActionSection.items.some(
      (item) => item.illustrationSrc === "/methodologies/world-around-me/lesson-1/jump.svg",
    ),
    true,
  );

  const lessonThreeHero = lessonContentFixtureMethodologyLessonStudentContentLessonThree.sections.find(
    (section) => section.type === "lesson_focus" && section.sceneId === "scene-hero",
  );
  assert.ok(lessonThreeHero);
  assert.equal(lessonThreeHero.illustrationSrc, "/methodologies/world-around-me/lesson-3/color-world.svg");
});
