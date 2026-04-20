import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  "src/app/(app)/(profile-required)/methodologies/[methodologySlug]/lessons/[lessonId]/page.tsx",
  "utf8",
);

const workspaceSource = readFileSync(
  "src/components/lessons/teacher-methodology-lesson-workspace.tsx",
  "utf8",
);

const pedagogicalSource = readFileSync(
  "src/components/lessons/teacher-lesson-pedagogical-content.tsx",
  "utf8",
);

const contentPanelSource = readFileSync(
  "src/components/lessons/lesson-student-content-panel.tsx",
  "utf8",
);

test("methodology lesson page uses shared teacher workspace tabs", () => {
  assert.equal(pageSource.includes("TeacherMethodologyLessonWorkspace"), true);
  assert.equal(pageSource.includes("productActionClassName"), true);
  assert.equal(pageSource.includes("<span>Запланировать урок</span>"), true);
  assert.equal(pageSource.includes('className="[&_.app-page-actions]:mt-5"'), true);
});

test("teacher lesson workspace keeps canonical plan/content/homework tabs", () => {
  assert.equal(workspaceSource.includes('tabs={["plan", "content", "homework"]}'), true);
  assert.equal(workspaceSource.includes("TeacherLessonPedagogicalContent"), true);
  assert.equal(workspaceSource.includes("LessonStudentContentPanel"), true);
});

test("pedagogical content renders richer lesson passport + phase structure", () => {
  assert.equal(pedagogicalSource.includes("Паспорт урока"), true);
  assert.equal(pedagogicalSource.includes("phaseLabel"), true);
  assert.equal(pedagogicalSource.includes("Пошаговый план урока"), true);
});

test("teacher content tab uses learner deck renderer instead of bare type dump", () => {
  assert.equal(contentPanelSource.includes("LessonLearnerContentDeck"), true);
  assert.equal(contentPanelSource.includes("Тип:"), false);
});
