import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonContentFixtureAssets,
  lessonContentFixtureHomeworkDefinition,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureMethodologyLessonStudentContent,
} from "../../lesson-content";
import { buildMethodologyLessonUnifiedReadModel } from "../methodology-lesson-unified-read-model";

function buildPresentationFlow() {
  const assetsById = Object.fromEntries(
    lessonContentFixtureAssets.map((asset) => [asset.id, asset]),
  );

  return lessonContentFixtureMethodologyLesson.blocks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((block) => ({
      id: block.id,
      order: block.order,
      stepLabel: `Шаг ${block.order}`,
      blockLabel: block.blockType,
      accentTone: "sky" as const,
      title: block.title ?? `Шаг ${block.order}`,
      description: undefined,
      teacherActions: [],
      studentActions: [],
      materials: [],
      resources: block.assetRefs.map((ref) => ({
        title: assetsById[ref.id]?.title ?? ref.id,
        kindLabel: ref.kind,
        url: assetsById[ref.id]?.sourceUrl,
      })),
    }));
}

test("world-around-me lesson 1 unified read model keeps canonical 16-step mapping", () => {
  const assetsById = Object.fromEntries(
    lessonContentFixtureAssets.map((asset) => [asset.id, asset]),
  );

  const unified = buildMethodologyLessonUnifiedReadModel({
    lessonId: lessonContentFixtureMethodologyLesson.id,
    lessonShell: lessonContentFixtureMethodologyLesson.shell,
    presentation: {
      quickSummary: {
        prepChecklist: ["Карточки", "Приложение 1"],
        keyWords: lessonContentFixtureMethodologyLesson.shell.vocabularySummary,
        keyPhrases: lessonContentFixtureMethodologyLesson.shell.phraseSummary,
        resources: [],
      },
      lessonFlow: buildPresentationFlow(),
    },
    studentContent: lessonContentFixtureMethodologyLessonStudentContent,
    assetsById,
    canonicalHomework: null,
  });

  assert.equal(unified.steps.length, 16);
  assert.equal(unified.steps.some((step) => step.title === "Подготовка до урока"), false);

  for (const step of unified.steps) {
    assert.equal(step.title, step.student.title);
  }

  const step1 = unified.steps[0];
  assert.equal(step1.title, "Приветствие детей и героев курса");
  assert.equal(step1.student.screenType, "intro");

  const step2 = unified.steps[1];
  assert.equal(step2.title, "Смотрим видео «farm animals»");
  assert.equal(step2.student.screenType, "video");
  assert.equal(step2.resourceIds?.includes("video:farm-animals"), true);
  assert.equal(step2.resourceIds?.includes("song:farm-animals"), false);

  const step3 = unified.steps[2];
  assert.equal(step3.title, "Учим фразу 我是…");
  const step3Phrases = step3.student.payload?.sections?.[0];
  assert.equal(step3Phrases?.type, "phrase_cards");
  if (step3Phrases?.type === "phrase_cards") {
    const phrases = step3Phrases.items.map((item) => item.phrase);
    assert.equal(phrases.includes("你是谁？"), true);
    assert.equal(phrases.includes("我是…"), true);
  }

  const step4 = unified.steps[3];
  assert.equal(step4.title, "Учим слова 狗，猫，兔子，马 с карточками");
  assert.equal(step4.student.payload?.sections?.[0]?.type, "vocabulary_cards");
  const step4Words = step4.student.payload?.sections?.[0]?.type === "vocabulary_cards"
    ? step4.student.payload.sections[0].items.map((entry) => entry.term)
    : [];
  assert.deepEqual(step4Words, ["狗", "猫", "兔子", "马"]);

  const step7 = unified.steps[6];
  assert.equal(step7.title, "Счётные палочки");
  assert.equal(step7.student.payload?.sections?.[0]?.type, "count_board");
  const step7Section = step7.student.payload?.sections?.[0];
  const step7Text = JSON.stringify(step7Section ?? {});
  assert.equal(/一只|两只|三只|四匹|五只/u.test(step7Text), false);

  const step8 = unified.steps[7];
  assert.equal(step8.title, "Приложение 1: указываем, считаем и называем животных");
  assert.equal(step8.student.payload?.sections?.[0]?.type, "count_board");
  assert.equal(step8.resourceIds?.includes("worksheet:appendix-1"), true);
  const step8Text = JSON.stringify(step8.student.payload?.sections?.[0] ?? {});
  assert.equal(/一只|两只|三只|四匹|五只/u.test(step8Text), false);

  const step13 = unified.steps[12];
  assert.equal(step13.title, "Учим слово 农场");
  const step13Terms = step13.student.payload?.sections?.[0]?.type === "vocabulary_cards"
    ? step13.student.payload.sections[0].items.map((item) => item.term)
    : [];
  assert.deepEqual(step13Terms, ["农场"]);

  const step14 = unified.steps[13];
  assert.equal(step14.title, "Игрушечная ферма и конструкция 在…里");
  assert.equal(step14.student.payload?.sections?.[0]?.type, "farm_placement");
  const step14Section = step14.student.payload?.sections?.[0];
  if (step14Section?.type === "farm_placement") {
    assert.equal(step14Section.defaultZoneLabel.includes("农场里"), true);
  }

  const assignedSectionKeys = unified.steps.flatMap((step) =>
    (step.student.payload?.sections ?? []).map(
      (section) => `${section.sceneId ?? ""}|${section.type}|${section.title}`,
    ),
  );
  assert.equal(new Set(assignedSectionKeys).size, assignedSectionKeys.length);

  const step5 = unified.steps[5];
  assert.equal(step5.student.payload?.sections?.[0]?.type, "matching_practice");
  const step5Section = step5.student.payload?.sections?.[0];
  const step5Text =
    step5Section &&
    step5Section.type === "matching_practice"
      ? `${step5Section.title ?? ""} ${step5Section.subtitle ?? ""} ${step5Section.prompt ?? ""}`
      : "";
  assert.equal(step5Text.toLowerCase().includes("homework"), false);


  const totalMinutes = unified.steps.reduce((acc, step) => acc + (step.durationMinutes ?? 0), 0);
  assert.equal(totalMinutes >= 43 && totalMinutes <= 47, true);

  for (const step of unified.steps) {
    assert.equal((step.teacher.teacherActions?.length ?? 0) > 0, true);
    assert.equal((step.teacher.studentActions?.length ?? 0) > 0, true);
    assert.equal((step.teacher.teacherScript?.length ?? 0) > 0, true);
    assert.equal((step.teacher.materials?.length ?? 0) > 0, true);
    assert.equal((step.teacher.successCriteria?.length ?? 0) > 0, true);
    assert.equal(step.teacher.notes?.some((note) => note.includes("Педагогические детали будут уточнены")) ?? false, false);
    assert.equal(step.movementMode == null, false);
  }

  const lessonOneTeacherText = unified.steps
    .map((step) => [
      step.teacher.goal,
      step.teacher.description,
      ...step.teacher.teacherActions,
      ...step.teacher.studentActions,
      ...(step.teacher.teacherScript ?? []),
      ...(step.teacher.expectedResponses ?? []),
      ...step.teacher.materials,
      ...(step.teacher.successCriteria ?? []),
      ...(step.teacher.notes ?? []),
    ].filter((chunk): chunk is string => Boolean(chunk)).join(" "))
    .join(" ")
    .toLowerCase();

  assert.equal(lessonOneTeacherText.includes("cow"), false);
  assert.equal(lessonOneTeacherText.includes("pig"), false);
  assert.equal(lessonOneTeacherText.includes("three cows"), false);
  assert.equal(lessonOneTeacherText.includes("where is horse"), false);
  assert.equal(lessonOneTeacherText.includes("put cow"), false);

  assert.equal(lessonOneTeacherText.includes("狗"), true);
  assert.equal(lessonOneTeacherText.includes("猫"), true);
  assert.equal(lessonOneTeacherText.includes("兔子"), true);
  assert.equal(lessonOneTeacherText.includes("马"), true);
  assert.equal(lessonOneTeacherText.includes("农场"), true);
  assert.equal(lessonOneTeacherText.includes("показывает动作"), false);
  assert.equal(lessonOneTeacherText.includes("показывает движения"), true);

  const studentPayloadText = unified.steps
    .map((step) => JSON.stringify(step.student.payload ?? {}))
    .join(" ");
  assert.equal(studentPayloadText.includes("Фраза …"), false);
  assert.equal(studentPayloadText.includes("..."), false);
  assert.equal(studentPayloadText.includes("，，"), false);
});


test("world-around-me step mapping keeps phrase scene single-use and avoids duplicate section reuse", () => {
  const readModel = buildMethodologyLessonUnifiedReadModel({
    lessonId: "lesson-1",
    lessonShell: {
      id: "lesson-1",
      methodologyId: "m1",
      title: "Урок 1",
      position: { moduleIndex: 1, lessonIndex: 1 },
      vocabularySummary: [],
      phraseSummary: [],
      estimatedDurationMinutes: 45,
      mediaSummary: { videos: 0, songs: 0, worksheets: 0, other: 0 },
      readinessStatus: "ready",
    },
    presentation: {
      quickSummary: {
        prepChecklist: [],
        keyWords: [],
        keyPhrases: [],
        resources: [],
      },
      lessonFlow: Array.from({ length: 15 }, (_, i) => ({
        id: `s${i + 1}`,
        order: i + 1,
        stepLabel: `Шаг ${i + 1}`,
        blockLabel: "intro",
        accentTone: "sky" as const,
        title: `Step ${i + 1}`,
        teacherActions: [],
        studentActions: [],
        materials: [],
        resources: [],
      })),
    },
    studentContent: {
      id: "sc-1",
      methodologyLessonId: "lesson-1",
      title: "Student",
      sections: [
        { type: "lesson_focus", title: "intro", body: "b", chips: [], sceneId: "scene-hero" },
        { type: "presentation", title: "slides", sceneId: "scene-presentation", assetId: "presentation:world-around-me-lesson-1" },
        { type: "phrase_cards", title: "dup", sceneId: "scene-phrases", items: [{ phrase: "我是", meaning: "я" }] },
        { type: "phrase_cards", title: "dup-2", sceneId: "scene-phrases", items: [{ phrase: "这是", meaning: "это" }] },
      ],
    },
    assetsById: {},
    canonicalHomework: null,
  });

  assert.equal(readModel.steps[2]?.student.screenType, "phrase_practice");
  assert.equal(readModel.steps[9]?.student.screenType, "placeholder");
});

test("lesson 1 homework keeps mission flow: cards, matching, audio review, then quiz", () => {
  const homework = lessonContentFixtureHomeworkDefinition;
  assert.equal(homework.title.toLowerCase().includes("мини"), true);
  assert.equal(homework.quiz?.practiceSections?.length, 2);
  assert.equal(homework.materialLinks.includes("Карточки животных"), true);

  const sections = homework.quiz?.practiceSections as Array<Record<string, unknown>>;
  const matching = sections.find((section) => section.id === "matching-l1");
  assert.equal(matching?.type, "matching");
  assert.equal(Array.isArray(matching?.items), true);
  assert.equal((matching?.items as unknown[]).length, 4);

  const audioReview = sections.find((section) => section.id === "audio-review-l1");
  assert.equal(audioReview?.type, "audio_review");
  const audioGroups = (audioReview?.groups as Array<{ entries: Array<{ hanzi: string }> }>) ?? [];
  const hanzi = audioGroups.flatMap((group) => group.entries.map((entry) => entry.hanzi));
  for (const expected of ["狗", "猫", "兔子", "马", "农场", "我是…", "这是…", "跑", "跳", "我们…吧!", "在"]) {
    assert.equal(hanzi.includes(expected), true);
  }
});
