import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonContentFixtureAssets,
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

test("world-around-me lesson 1 unified read model is canonical 16-step teacher/student aligned mapping", () => {
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

  const step2 = unified.steps[1];
  assert.equal(step2.title, "Видео: farm animals");
  assert.equal(step2.resourceIds?.includes("song:farm-animals"), false);

  const step8 = unified.steps[7];
  assert.equal(step8.title, "Приложение 1: считаем и называем");
  assert.equal(step8.student.payload?.sections?.[0]?.type, "count_board");
  assert.equal(step8.resourceIds?.includes("worksheet:appendix-1"), true);

  const step15 = unified.steps[14];
  assert.equal(step15.title, "Песня: farm animals");
  assert.equal(step15.resourceIds?.includes("song:farm-animals"), true);

  const assignedSectionKeys = unified.steps.flatMap((step) =>
    (step.student.payload?.sections ?? []).map(
      (section) => `${section.sceneId ?? ""}|${section.type}|${section.title}`,
    ),
  );
  assert.equal(new Set(assignedSectionKeys).size, assignedSectionKeys.length);
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
      lessonFlow: Array.from({ length: 16 }, (_, i) => ({
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
  assert.equal(readModel.steps[10]?.student.screenType, "placeholder");
});
