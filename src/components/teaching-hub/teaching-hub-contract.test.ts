import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schedulePageSource = readFileSync(
  "src/app/(app)/(teacher-required)/schedule/page.tsx",
  "utf8",
);
const studentsPageSource = readFileSync(
  "src/app/(app)/(teacher-required)/students/page.tsx",
  "utf8",
);
const teacherLayoutSource = readFileSync(
  "src/app/(app)/(teacher-required)/layout.tsx",
  "utf8",
);
const scheduleWorkspaceSource = readFileSync(
  "src/components/teaching-hub/schedule-workspace.tsx",
  "utf8",
);
const studentsWorkspaceSource = readFileSync(
  "src/components/teaching-hub/students-workspace.tsx",
  "utf8",
);

const pageSources = `${schedulePageSource}\n${studentsPageSource}`;
const workspaceSources = `${scheduleWorkspaceSource}\n${studentsWorkspaceSource}`;
const combinedSources = `${pageSources}\n${teacherLayoutSource}\n${workspaceSources}`;

test("teaching hub pages share the demo shell and transparent list header", () => {
  for (const source of [schedulePageSource, studentsPageSource]) {
    assert.match(source, /course-demo-shell teaching-hub-shell/);
    assert.match(source, /<TopNav demoStyle \/>/);
    assert.match(source, /<AppPageHeader/);
    assert.match(source, /course-index-page-header teaching-hub-page-header/);
    assert.doesNotMatch(source, /landing-noise/);
  }

  assert.match(schedulePageSource, /title="Расписание"/);
  assert.match(studentsPageSource, /title="Ученики"/);
  assert.match(teacherLayoutSource, /resolveTeacherRequiredRedirect/);
});

test("schedule is an honest empty scheduling surface over real Course documents", () => {
  assert.match(scheduleWorkspaceSource, /\/api\/v2\/courses/);
  assert.match(scheduleWorkspaceSource, /Занятия пока не назначены/);
  assert.match(scheduleWorkspaceSource, /Даты и время занятий ещё не/);
  assert.match(scheduleWorkspaceSource, /Ваши курсы/);
  assert.match(scheduleWorkspaceSource, /Готово к будущему планированию/);
  assert.doesNotMatch(scheduleWorkspaceSource, /Запланировать/);
});

test("students keeps the new learner directory separate from compatibility identity", () => {
  assert.match(studentsWorkspaceSource, /\/api\/v2\/courses/);
  assert.match(studentsWorkspaceSource, /Ученики и группы появятся здесь/);
  assert.match(studentsWorkspaceSource, /Данные\s+старой версии/);
  assert.match(studentsWorkspaceSource, /Ученики не назначены/);
  assert.doesNotMatch(studentsWorkspaceSource, /\/rest\/v1\/student/);
  assert.doesNotMatch(studentsWorkspaceSource, /Новый профиль|Пригласить/);
});

test("teaching hub never restores demo fixtures or local persistence", () => {
  assert.doesNotMatch(combinedSources, /localStorage|fixtures?/i);
  assert.doesNotMatch(
    combinedSources,
    /scheduleLessons|studentCards|demoCourses|Food around the world|Миша Орлов|Добрый день, Агата|2026-07-/,
  );
});
