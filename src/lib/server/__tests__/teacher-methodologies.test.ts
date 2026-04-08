import assert from "node:assert/strict";
import test from "node:test";
import { groupMethodologyLessonsByModule, type TeacherMethodologyLessonDetail } from "../teacher-methodologies";

function lesson(partial: Partial<TeacherMethodologyLessonDetail>): TeacherMethodologyLessonDetail {
  return {
    id: partial.id ?? "id",
    moduleIndex: partial.moduleIndex ?? 1,
    unitIndex: partial.unitIndex ?? null,
    lessonIndex: partial.lessonIndex ?? 1,
    title: partial.title ?? "Урок",
    durationMinutes: partial.durationMinutes ?? null,
    readinessLabel: partial.readinessLabel ?? "Готов",
    vocabularySummary: partial.vocabularySummary ?? [],
    phraseSummary: partial.phraseSummary ?? [],
    blocks: partial.blocks ?? [],
  };
}

test("groupMethodologyLessonsByModule keeps pedagogical ordering", () => {
  const grouped = groupMethodologyLessonsByModule([
    lesson({ id: "l-3", moduleIndex: 2, unitIndex: 2, lessonIndex: 1 }),
    lesson({ id: "l-1", moduleIndex: 1, unitIndex: 2, lessonIndex: 2 }),
    lesson({ id: "l-2", moduleIndex: 1, unitIndex: 1, lessonIndex: 3 }),
    lesson({ id: "l-4", moduleIndex: 1, unitIndex: null, lessonIndex: 1 }),
  ]);

  assert.deepEqual(grouped.map((module) => module.moduleIndex), [1, 2]);
  assert.deepEqual(grouped[0]?.lessons.map((item) => item.id), ["l-4", "l-2", "l-1"]);
  assert.deepEqual(grouped[1]?.lessons.map((item) => item.id), ["l-3"]);
});
