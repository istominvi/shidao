import assert from "node:assert/strict";
import test from "node:test";
import {
  COURSE_WORKSPACE_TABS,
  LESSON_WORKSPACE_TABS,
  createCourseWorkspaceNavigation,
  formatLessonWorkspaceTitle,
  openCourseWorkspaceLesson,
  reconcileCourseWorkspaceNavigation,
  returnToCourseWorkspace,
} from "./course-workspace-navigation";

test("course and lesson tabs follow the product hierarchy", () => {
  assert.deepEqual(
    COURSE_WORKSPACE_TABS.map((item) => item.label),
    ["Уроки", "О курсе", "Материалы", "История"],
  );
  assert.deepEqual(
    LESSON_WORKSPACE_TABS.map((item) => item.label),
    ["План", "Экран ученика", "Домашнее задание", "Материалы", "История"],
  );
});

test("a persisted course without a tab deep link opens on its lesson list", () => {
  assert.deepEqual(createCourseWorkspaceNavigation(), {
    courseSurface: "lessons",
    selectedLessonId: null,
    lessonSurface: "plan",
  });
});

test("opening a lesson and returning to its course reset the expected surfaces", () => {
  const initial = createCourseWorkspaceNavigation();
  const lesson = openCourseWorkspaceLesson(initial, "lesson-4");

  assert.deepEqual(lesson, {
    courseSurface: "lessons",
    selectedLessonId: "lesson-4",
    lessonSurface: "plan",
  });
  assert.deepEqual(returnToCourseWorkspace(lesson), initial);
});

test("a removed lesson returns to the course instead of opening another lesson", () => {
  const lesson = openCourseWorkspaceLesson(
    createCourseWorkspaceNavigation(),
    "removed-lesson",
  );

  assert.deepEqual(
    reconcileCourseWorkspaceNavigation(lesson, ["another-lesson"]),
    createCourseWorkspaceNavigation(),
  );
});

test("lesson heading combines its number and authored title", () => {
  assert.equal(
    formatLessonWorkspaceTitle(4, "Present Perfect · жизненный опыт"),
    "Урок 4. Present Perfect · жизненный опыт",
  );
});
