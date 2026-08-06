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
const studentDirectoryTableSource = readFileSync(
  "src/components/teaching-hub/student-directory-table.tsx",
  "utf8",
);
const learnerProfileDialogSource = readFileSync(
  "src/components/teaching-hub/learner-profile-dialog.tsx",
  "utf8",
);
const learnerGroupDialogSource = readFileSync(
  "src/components/teaching-hub/learner-group-dialog.tsx",
  "utf8",
);
const lessonRunClientSource = readFileSync(
  "src/components/lesson-runs/lesson-run-client.ts",
  "utf8",
);
const lessonRunDialogSource = readFileSync(
  "src/components/lesson-runs/lesson-run-dialog.tsx",
  "utf8",
);
const lessonRunFormatSource = readFileSync(
  "src/components/lesson-runs/lesson-run-format.ts",
  "utf8",
);
const learnerHistorySource = readFileSync(
  "src/components/lesson-runs/learner-history-dialog.tsx",
  "utf8",
);
const courseAudienceDialogSource = readFileSync(
  "src/components/lesson-runs/course-audience-dialog.tsx",
  "utf8",
);
const courseAudienceRouteSource = readFileSync(
  "src/app/api/v2/courses/[courseId]/audience/route.ts",
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

test("schedule projects persisted LessonRun appointments without a parallel event", () => {
  assert.match(lessonRunClientSource, /\/api\/v2\/lesson-runs\?/);
  assert.match(scheduleWorkspaceSource, /loadSchedule/);
  assert.match(scheduleWorkspaceSource, /Занятий нет/);
  assert.match(scheduleWorkspaceSource, /Назначить урок в курсе/);
  assert.match(scheduleWorkspaceSource, /lessonRunStateLabel/);
  assert.match(scheduleWorkspaceSource, /selectedRunId/);
  assert.doesNotMatch(scheduleWorkspaceSource, /ScheduleEvent|LessonSession/);
});

test("students manages one learner and group directory with durable history", () => {
  assert.match(lessonRunClientSource, /\/api\/v2\/learner-profiles/);
  assert.match(lessonRunClientSource, /\/api\/v2\/learner-groups/);
  assert.match(studentsWorkspaceSource, /Новый ученик/);
  assert.match(studentsWorkspaceSource, /Новая группа/);
  assert.match(studentsWorkspaceSource, /createLearnerProfile/);
  assert.match(studentsWorkspaceSource, /updateLearnerProfile/);
  assert.match(studentsWorkspaceSource, /deleteLearnerProfile/);
  assert.match(studentsWorkspaceSource, /createLearnerGroup/);
  assert.match(studentsWorkspaceSource, /updateLearnerGroup/);
  assert.match(studentsWorkspaceSource, /deleteLearnerGroup/);
  assert.match(studentsWorkspaceSource, /По группам/);
  assert.match(studentsWorkspaceSource, /Без группы/);
  assert.match(studentDirectoryTableSource, /<ProductTable/);
  assert.match(studentDirectoryTableSource, /<caption className="sr-only"/);
  assert.match(studentDirectoryTableSource, /История/);
  assert.match(studentDirectoryTableSource, /Редактировать/);
  assert.match(studentDirectoryTableSource, /Удалить/);
  assert.doesNotMatch(studentDirectoryTableSource, /role="button"/);
  assert.match(
    learnerProfileDialogSource,
    /Учебная история и уже назначенные уроки сохранятся/,
  );
  assert.match(learnerGroupDialogSource, /Уже назначенные уроки не изменятся/);
  assert.match(studentsWorkspaceSource, /LearnerHistoryDialog/);
  assert.match(learnerHistorySource, /courseTitleAtTime/);
  assert.match(learnerHistorySource, /lessonTitleAtTime/);
  assert.match(learnerHistorySource, /wasPresent/);
  assert.match(learnerHistorySource, /needsRepeat/);
  assert.match(learnerHistorySource, /teacherComment/);
  assert.doesNotMatch(studentsWorkspaceSource, /\/rest\/v1\/student/);
  assert.doesNotMatch(studentsWorkspaceSource, /\/rest\/v1\/class/);
});

test("course audience keeps group and direct selections with one effective learner count", () => {
  assert.match(courseAudienceDialogSource, /Группы/);
  assert.match(courseAudienceDialogSource, /Отдельные ученики/);
  assert.match(courseAudienceDialogSource, /selectedGroupIds/);
  assert.match(courseAudienceDialogSource, /selectedDirectIds/);
  assert.match(courseAudienceDialogSource, /effectiveIds/);
  assert.match(courseAudienceDialogSource, /directLearnerProfileIds/);
  assert.match(courseAudienceDialogSource, /learnerGroupIds/);
  assert.match(courseAudienceDialogSource, /Один ученик учитывается один раз/);
  assert.match(courseAudienceDialogSource, /aria-live="polite"/);
  assert.match(
    courseAudienceDialogSource,
    /Уже назначенные уроки не изменятся/,
  );
  assert.match(lessonRunClientSource, /effectiveLearners/);
  assert.equal(
    courseAudienceRouteSource.match(
      /learnerProfiles: audience\.directLearners/g,
    )?.length,
    2,
  );
  assert.doesNotMatch(
    courseAudienceRouteSource,
    /learnerProfiles: audience\.effectiveLearners/,
  );
});

test("lesson run controls derive state from timestamps and capture individual results", () => {
  const runUiSources = `${lessonRunDialogSource}\n${lessonRunFormatSource}`;
  for (const field of ["scheduledAt", "startedAt", "endedAt", "cancelledAt"]) {
    assert.match(runUiSources, new RegExp(field));
  }
  assert.match(lessonRunDialogSource, /wasPresent/);
  assert.match(lessonRunDialogSource, /needsRepeat/);
  assert.match(lessonRunDialogSource, /teacherComment/);
  assert.match(lessonRunDialogSource, /Как прошёл урок/);
  assert.match(lessonRunDialogSource, /Урок не состоялся/);
  assert.match(lessonRunDialogSource, /Перенести/);
  assert.match(lessonRunDialogSource, /Отменить проведение/);
  assert.match(
    lessonRunDialogSource,
    /runState === "active" \|\| runState === "attention"/,
  );
  assert.match(lessonRunDialogSource, /type="radio"/);
  assert.match(lessonRunDialogSource, /draft\.wasPresent === true/);
  assert.match(lessonRunDialogSource, /draft\.wasPresent === false/);
  assert.match(lessonRunDialogSource, /completionReady/);
  assert.match(
    lessonRunDialogSource,
    /disabled=\{disabled \|\| !completionReady\}/,
  );
  assert.doesNotMatch(lessonRunDialogSource, /record\.wasPresent \?\? true/);
  assert.match(lessonRunDialogSource, /Закрыть без сохранения/);
  assert.match(lessonRunDialogSource, /mutationError/);
  assert.match(courseAudienceDialogSource, /mutationError/);
  assert.match(studentsWorkspaceSource, /mutationError/);
  assert.doesNotMatch(lessonRunDialogSource, /lessonRunParticipant|status:/i);
});

test("teaching hub never restores demo fixtures or local persistence", () => {
  assert.doesNotMatch(combinedSources, /localStorage|fixtures?/i);
  assert.doesNotMatch(
    combinedSources,
    /scheduleLessons|studentCards|demoCourses|Food around the world|Миша Орлов|Добрый день, Агата|2026-07-/,
  );
});
