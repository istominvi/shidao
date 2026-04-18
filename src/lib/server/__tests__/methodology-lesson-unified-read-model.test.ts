import assert from "node:assert/strict";
import test from "node:test";
import { buildMethodologyLessonUnifiedReadModel } from "../methodology-lesson-unified-read-model";

test("world-around-me step mapping marks selected section keys by original index and avoids section reuse", () => {
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
      quickSummary: { prepChecklist: [], keyWords: [], keyPhrases: [], resources: [] },
      lessonFlow: Array.from({ length: 11 }, (_, i) => ({
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
        { type: "lesson_focus", title: "intro", body: "b", chips: [] },
        { type: "phrase_cards", title: "dup", items: [{ phrase: "我是", meaning: "я" }] },
        { type: "phrase_cards", title: "dup", items: [{ phrase: "这是", meaning: "это" }] },
      ],
    },
    assetsById: {},
    canonicalHomework: null,
  });

  assert.equal(readModel.steps[2]?.student.screenType, "phrase_practice");
  assert.equal(readModel.steps[10]?.student.screenType, "placeholder");
});
