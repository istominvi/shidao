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
const observingPageSource = readFileSync(
  "src/app/(app)/observing/page.tsx",
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
const schedulePeriodSource = readFileSync(
  "src/components/teaching-hub/schedule-period.ts",
  "utf8",
);
const studentsWorkspaceSource = readFileSync(
  "src/components/teaching-hub/students-workspace.tsx",
  "utf8",
);
const observingWorkspaceSource = readFileSync(
  "src/components/learner-identity/observing-workspace.tsx",
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
const courseAudienceEditorSource = readFileSync(
  "src/components/lesson-runs/course-audience-dialog.tsx",
  "utf8",
);
const courseWorkspaceSource = readFileSync(
  "src/components/course-builder/course-workspace.tsx",
  "utf8",
);
const courseAudienceRouteSource = readFileSync(
  "src/app/api/v2/courses/[courseId]/audience/route.ts",
  "utf8",
);

const pageSources = `${schedulePageSource}\n${studentsPageSource}`;
const workspaceSources = `${scheduleWorkspaceSource}\n${studentsWorkspaceSource}`;
const combinedSources = `${pageSources}\n${teacherLayoutSource}\n${workspaceSources}`;

test("teaching hub pages share the demo shell and canonical page header", () => {
  for (const source of [schedulePageSource, studentsPageSource]) {
    assert.match(source, /course-demo-shell teaching-hub-shell/);
    assert.match(source, /<TopNav demoStyle \/>/);
    assert.doesNotMatch(source, /landing-noise/);
    assert.doesNotMatch(
      source,
      /course-index-page-header|course-builder-page-header|teaching-hub-page-header|workspace-page-header/,
    );
  }

  assert.match(schedulePageSource, /title="Расписание"/);
  assert.match(schedulePageSource, /<AppPageHeader/);
  assert.match(schedulePageSource, /Назначить урок в курсе/);
  assert.match(studentsWorkspaceSource, /<AppPageHeader/);
  assert.match(studentsWorkspaceSource, /title="Ученики"/);
  assert.match(studentsWorkspaceSource, /Новый ученик/);
  assert.match(studentsWorkspaceSource, /Новая группа/);
  assert.match(studentsPageSource, /tab === "observing"/);
  assert.match(observingPageSource, /redirect\(`/);
  assert.match(observingPageSource, /ROUTES\.students}\?tab=observing/);
  assert.match(teacherLayoutSource, /resolveTeacherRequiredRedirect/);
});

test("schedule projects persisted LessonRun appointments without a parallel event", () => {
  assert.match(lessonRunClientSource, /\/api\/v2\/lesson-runs\?/);
  assert.match(scheduleWorkspaceSource, /loadSchedule/);
  assert.match(scheduleWorkspaceSource, /schedulePeriodRange/);
  assert.match(scheduleWorkspaceSource, /shiftSchedulePeriod/);
  assert.match(scheduleWorkspaceSource, /useState<SchedulePeriod>\("week"\)/);
  assert.match(scheduleWorkspaceSource, /aria-label="Период расписания"/);
  assert.match(scheduleWorkspaceSource, />\s*Неделя\s*</);
  assert.match(scheduleWorkspaceSource, />\s*Месяц\s*</);
  assert.match(scheduleWorkspaceSource, /aria-pressed=\{period === "week"\}/);
  assert.match(scheduleWorkspaceSource, /aria-pressed=\{period === "month"\}/);
  assert.match(scheduleWorkspaceSource, /<ProductTable/);
  assert.match(scheduleWorkspaceSource, /Показать таблицей/);
  assert.match(scheduleWorkspaceSource, /Показать карточками/);
  assert.match(scheduleWorkspaceSource, /SCHEDULE_RESULT_LIMIT = 500/);
  assert.match(
    scheduleWorkspaceSource,
    /Эта неделя может быть показана не полностью/,
  );
  assert.match(
    scheduleWorkspaceSource,
    /Переключитесь на неделю, чтобы сузить окно/,
  );
  assert.doesNotMatch(
    scheduleWorkspaceSource,
    />\s*(?:Все|Учитель|Родитель|Ученик)\s*</,
  );
  assert.match(schedulePeriodSource, /startOfLocalWeek/);
  assert.match(schedulePeriodSource, /from\.toISOString\(\)/);
  assert.match(schedulePeriodSource, /to\.toISOString\(\)/);
  assert.match(scheduleWorkspaceSource, /Занятий нет/);
  assert.match(schedulePageSource, /Назначить урок в курсе/);
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
  assert.match(studentsWorkspaceSource, /<WorkspaceTabs/);
  assert.match(studentsWorkspaceSource, /label: "Ученики"/);
  assert.match(studentsWorkspaceSource, /label: "Группы"/);
  assert.match(studentsWorkspaceSource, /label: "Наблюдение"/);
  assert.match(studentsWorkspaceSource, /<ObservingWorkspace embedded \/>/);
  assert.match(observingWorkspaceSource, /!embedded \? \(/);
  assert.match(studentsWorkspaceSource, /role="tabpanel"/);
  assert.match(studentsWorkspaceSource, /workspaceTabPanelId/);
  assert.match(studentsWorkspaceSource, /Без группы/);
  assert.match(studentDirectoryTableSource, /<ProductTable/);
  assert.match(studentDirectoryTableSource, /<caption className="sr-only"/);
  assert.match(studentDirectoryTableSource, /onOpen/);
  assert.match(studentDirectoryTableSource, /slice\(0, 2\)/);
  assert.match(studentDirectoryTableSource, /ещё \{hiddenGroupCount\}/);
  assert.doesNotMatch(
    studentDirectoryTableSource,
    /ProductTableActionCell|Действия|onDelete/,
  );
  assert.doesNotMatch(studentDirectoryTableSource, /role="button"/);
  assert.match(learnerProfileDialogSource, /Учебная история сохранится/);
  assert.match(learnerProfileDialogSource, /Имя в моём списке/);
  assert.match(
    learnerProfileDialogSource,
    /восстановить связь можно будет во вкладке «Архив»/,
  );
  assert.match(studentsWorkspaceSource, /Восстановить/);
  assert.match(studentsWorkspaceSource, /Ожидают ответа/);
  assert.match(learnerProfileDialogSource, /LearnerIdentityPanel/);
  assert.match(learnerProfileDialogSource, /data-dialog-initial-focus/);
  assert.match(learnerGroupDialogSource, /data-dialog-initial-focus/);
  assert.match(studentsWorkspaceSource, />\s*Повторить\s*</);
  assert.match(learnerGroupDialogSource, /Уже назначенные уроки не изменятся/);
  assert.match(learnerProfileDialogSource, /LearnerHistoryPanel/);
  assert.match(learnerProfileDialogSource, /label: "История"/);
  assert.match(learnerHistorySource, /только завершённые уроки в ваших курсах/);
  assert.match(learnerHistorySource, /Данные других\s+преподавателей/);
  assert.match(learnerHistorySource, /courseTitleAtTime/);
  assert.match(learnerHistorySource, /lessonTitleAtTime/);
  assert.match(learnerHistorySource, /wasPresent/);
  assert.match(learnerHistorySource, /needsRepeat/);
  assert.match(learnerHistorySource, /teacherComment/);
  assert.doesNotMatch(studentsWorkspaceSource, /\/rest\/v1\/student/);
  assert.doesNotMatch(studentsWorkspaceSource, /\/rest\/v1\/class/);
});

test("inline Course audience keeps group and direct selections with one effective learner count", () => {
  assert.match(
    courseAudienceEditorSource,
    /export function CourseAudienceEditor/,
  );
  assert.match(courseWorkspaceSource, /<CourseAudienceEditor/);
  assert.match(courseWorkspaceSource, />\s*Ученики и группы курса\s*</);
  assert.match(courseWorkspaceSource, /Каждый профиль учитывается один\s+раз/);
  assert.doesNotMatch(
    courseAudienceEditorSource,
    /DialogShell|onClose|autoFocus/,
  );
  assert.match(courseAudienceEditorSource, /Группы/);
  assert.match(courseAudienceEditorSource, /Отдельные ученики/);
  assert.match(courseAudienceEditorSource, /selectedGroupIds/);
  assert.match(courseAudienceEditorSource, /selectedDirectIds/);
  assert.match(courseAudienceEditorSource, /effectiveIds/);
  assert.match(courseAudienceEditorSource, /directLearnerProfileIds/);
  assert.match(courseAudienceEditorSource, /learnerGroupIds/);
  assert.match(courseAudienceEditorSource, /aria-live="polite"/);
  assert.match(
    courseAudienceEditorSource,
    /Уже назначенные уроки не изменятся/,
  );
  assert.match(courseAudienceEditorSource, /Аудитория сохранена/);
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
  assert.match(courseAudienceEditorSource, /mutationError/);
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
