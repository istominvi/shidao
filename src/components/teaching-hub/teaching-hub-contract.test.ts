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
const scheduleDatePickerSource = readFileSync(
  "src/components/teaching-hub/schedule-date-picker.tsx",
  "utf8",
);
const schedulePeriodSource = readFileSync(
  "src/components/teaching-hub/schedule-period.ts",
  "utf8",
);
const teachingHubStyleSource = readFileSync(
  "src/app/styles/teaching-hub.css",
  "utf8",
);
const navigationStyleSource = readFileSync(
  "src/app/styles/navigation.css",
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
  assert.match(
    schedulePageSource,
    /description="Здесь все назначенные уроки за выбранный период\."/,
  );
  assert.match(schedulePageSource, /<CalendarPlus/);
  assert.match(schedulePageSource, /Назначить урок/);
  assert.doesNotMatch(schedulePageSource, /Назначить урок в курсе|<BookOpen/);
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
  assert.match(scheduleWorkspaceSource, /useState<SchedulePeriod>\("week"\)/);
  assert.match(scheduleWorkspaceSource, /<ScheduleDatePicker/);
  assert.doesNotMatch(
    scheduleWorkspaceSource,
    /teaching-schedule-period-switch/,
  );
  assert.match(scheduleDatePickerSource, /shiftSchedulePeriod/);
  assert.match(scheduleDatePickerSource, /aria-haspopup="dialog"/);
  assert.match(scheduleDatePickerSource, /aria-expanded=\{open\}/);
  assert.match(scheduleDatePickerSource, /role="dialog"/);
  assert.match(scheduleDatePickerSource, /role="grid"/);
  assert.match(scheduleDatePickerSource, /data-date=\{dateValue\}/);
  assert.match(scheduleDatePickerSource, /ariaLabel="Период расписания"/);
  assert.match(scheduleDatePickerSource, /label: "День"/);
  assert.match(scheduleDatePickerSource, /label: "Неделя"/);
  assert.match(scheduleDatePickerSource, /label: "Месяц"/);
  assert.match(scheduleDatePickerSource, /event\.key === "Escape"/);
  assert.match(scheduleDatePickerSource, /closePopover\(true\)/);
  assert.match(scheduleDatePickerSource, /handlePointerDown/);
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
  assert.match(
    schedulePeriodSource,
    /export type SchedulePeriod = "day" \| "week" \| "month"/,
  );
  assert.match(schedulePeriodSource, /period === "day"/);
  assert.match(schedulePeriodSource, /direction \* 7/);
  assert.match(schedulePeriodSource, /getMonth\(\) \+ direction/);
  assert.match(schedulePeriodSource, /from\.toISOString\(\)/);
  assert.match(schedulePeriodSource, /to\.toISOString\(\)/);
  assert.match(scheduleWorkspaceSource, /Занятий нет/);
  assert.match(schedulePageSource, /Назначить урок/);
  assert.doesNotMatch(
    scheduleWorkspaceSource,
    /periodEyebrow|teaching-(?:empty|section)-eyebrow|teaching-section-heading|schedule-runs-title/,
  );
  assert.match(
    scheduleWorkspaceSource,
    /aria-label=\{`Назначенные уроки за \$\{selectedPeriodLabel\}`\}/,
  );
  assert.match(scheduleWorkspaceSource, />\s*Ученики\s*</);
  assert.doesNotMatch(scheduleWorkspaceSource, />\s*Участники\s*</);
  assert.match(scheduleWorkspaceSource, /label: "Ожидается"/);
  assert.match(scheduleWorkspaceSource, /<ScheduleRunStatus run=\{run\} \/>/);
  assert.doesNotMatch(scheduleWorkspaceSource, /<Chip/);
  assert.match(
    scheduleWorkspaceSource,
    /productButtonClassName\("secondary"\)/,
  );
  assert.match(scheduleWorkspaceSource, /selectedRunId/);
  assert.doesNotMatch(scheduleWorkspaceSource, /ScheduleEvent|LessonSession/);
});

test("schedule keeps the compact date control and dense one-line table contract", () => {
  assert.match(schedulePeriodSource, /month: "short"/);
  assert.match(schedulePeriodSource, /formatToParts\(value\)/);
  assert.match(
    schedulePeriodSource,
    /part\.type === "month" \? part\.value\.replace\(\/\\\.\$\/u, ""\)/,
  );
  assert.match(schedulePeriodSource, /Сегодня ·/);
  assert.match(schedulePeriodSource, /Неделя ·/);
  assert.match(
    teachingHubStyleSource,
    /\.teaching-date-picker\s*\{[^}]*width:\s*18\.75rem;[^}]*flex:\s*0 0 18\.75rem/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-date-navigator > button\s*\{[^}]*font-family:\s*inherit;/,
  );
  assert.doesNotMatch(
    teachingHubStyleSource,
    /\.teaching-date-navigator > button\s*\{[^}]*font:\s*inherit;/,
  );

  for (const label of ["Дата", "Время", "Урок", "Курс", "Ученики", "Статус"]) {
    assert.match(scheduleWorkspaceSource, new RegExp(`>\\s*${label}\\s*<`));
  }
  assert.doesNotMatch(scheduleWorkspaceSource, />\s*Дата и время\s*</);
  assert.match(
    scheduleWorkspaceSource,
    /<ProductTableHeaderCell[\s\S]*aria-label="Действия"[\s\S]*\/>/,
  );
  assert.match(scheduleWorkspaceSource, /compactTableDateFormatter/);
  assert.match(scheduleWorkspaceSource, /formatScheduleCompactDate/);
  assert.match(
    scheduleWorkspaceSource,
    /compactTableDateFormatter\.format\(scheduledAt\),[\s\S]*?· \$\{formatScheduleCompactDate\(scheduledAt\)\}/,
  );
  assert.match(
    scheduleWorkspaceSource,
    /const duration = `\$\{run\.plannedDurationMinutes\} мин`;/,
  );
  assert.doesNotMatch(
    scheduleWorkspaceSource,
    /run\.plannedDurationMinutes\} мин\./,
  );
  assert.match(scheduleWorkspaceSource, /title=\{compactDate\}/);
  assert.match(
    scheduleWorkspaceSource,
    /title=\{`\$\{formattedTime\} · \$\{duration\}`\}/,
  );
  assert.match(scheduleWorkspaceSource, /title=\{run\.lessonTitle\}/);
  assert.match(scheduleWorkspaceSource, /title=\{run\.courseTitle\}/);
  assert.match(scheduleWorkspaceSource, /teaching-run-table-truncate/);
  assert.doesNotMatch(
    scheduleWorkspaceSource,
    /teaching-run-table-quick-actions|teaching-run-table-quick-action/,
  );
  assert.match(scheduleWorkspaceSource, /<ActionMenu/);
  assert.match(scheduleWorkspaceSource, /triggerIcon=\{MoreVertical\}/);
  assert.match(scheduleWorkspaceSource, /triggerVariant="ghost"/);
  assert.match(scheduleWorkspaceSource, /\sportal\s/);
  assert.match(scheduleWorkspaceSource, /label: "Открыть план"/);
  for (const column of [
    "date",
    "time",
    "lesson",
    "course",
    "participants",
    "status",
    "actions",
  ]) {
    assert.match(
      scheduleWorkspaceSource,
      new RegExp(`teaching-run-table-col-${column}`),
    );
  }

  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-wrap\s*\{[^}]*border:\s*0;[^}]*background:\s*#fff;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table thead th\s*\{[^}]*box-sizing:\s*border-box;[^}]*border-bottom:\s*1px/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table thead th\s*\{[^}]*font-weight:\s*500;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table thead th\s*\{[^}]*padding-inline:\s*var\(--course-demo-control-padding-inline, 0\.75rem\);/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table\s*\{[^}]*min-width:\s*0;[^}]*table-layout:\s*auto;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-col-date,[\s\S]*?\.teaching-run-table-col-time\s*\{[^}]*width:\s*1%;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-col-lesson,[\s\S]*?\.teaching-run-table-col-course\s*\{[^}]*width:\s*50%;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-col-participants,[\s\S]*?\.teaching-run-table-col-status\s*\{[^}]*width:\s*1%;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-col-actions\s*\{[^}]*width:\s*1%;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table tbody tr\s*\{[^}]*height:\s*var\(\s*--course-demo-table-row-height,/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table tbody td\s*\{[^}]*height:\s*var\(\s*--course-demo-table-row-height,[^}]*padding-inline:\s*var\(--course-demo-control-padding-inline, 0\.75rem\);[^}]*padding-block:\s*0;[^}]*color:\s*#141414;[^}]*vertical-align:\s*middle;[^}]*white-space:\s*nowrap;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-duration\s*\{[^}]*color:\s*#141414;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-participants,[\s\S]*?\.teaching-run-table-status\s*\{[^}]*color:\s*#141414;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-schedule-view-toggle button svg\s*\{[^}]*color:\s*#141414;[^}]*opacity:\s*1;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-schedule-view-toggle button\s*\{[^}]*height:\s*var\(--product-inner-control-size, 2rem\);[^}]*border-radius:\s*var\(--product-inner-control-radius, 0\.5rem\);/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-actions\s*\{[^}]*width:\s*100%;[^}]*height:\s*var\(--product-inner-control-size, 2rem\);/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.teaching-run-table-action-cell\s*\{[^}]*padding-inline:\s*var\(--product-inner-control-inset, 0\.25rem\) !important;[^}]*line-height:\s*0;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.course-demo-shell \.teaching-run-action-menu \.action-menu-trigger\s*\{[^}]*width:\s*var\(--product-inner-control-size, 2rem\);[^}]*min-width:\s*var\(--product-inner-control-size, 2rem\);[^}]*height:\s*var\(--product-inner-control-size, 2rem\);[^}]*min-height:\s*var\(--product-inner-control-size, 2rem\);[^}]*flex:\s*0 0 var\(--product-inner-control-size, 2rem\);[^}]*border-radius:\s*var\(--product-inner-control-radius, 0\.5rem\);[^}]*padding:\s*0;/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.action-menu-panel-portal \.action-menu-item\s*\{[^}]*height:\s*var\(\s*--course-demo-table-row-height,[^}]*min-height:\s*var\(\s*--course-demo-table-row-height,[^}]*align-items:\s*center;[^}]*gap:\s*var\(--course-demo-control-padding-inline,[^}]*padding-inline:\s*var\(--course-demo-control-padding-inline,[^}]*color:\s*#141414;[^}]*font-size:\s*var\(--course-demo-control-font-size,[^}]*font-weight:\s*var\(--course-demo-control-font-weight,/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.action-menu-panel-portal \.action-menu-item-icon\s*\{[^}]*margin-top:\s*0;[^}]*color:\s*#141414;[^}]*opacity:\s*1;/,
  );
  assert.doesNotMatch(
    teachingHubStyleSource,
    /teaching-run-table-quick-actions|teaching-run-table-quick-action/,
  );
  assert.match(
    teachingHubStyleSource,
    /\.student-directory-table-wrap\s*\{[^}]*border:\s*0;[^}]*--course-demo-table-radius,[^}]*background:\s*#fff;/,
  );
  assert.match(
    navigationStyleSource,
    /\.site-header-shell-demo\s*\{[^}]*background:\s*#fff;/,
  );
  assert.match(
    navigationStyleSource,
    /\.nav-dropdown-panel\s*\{[^}]*background:\s*#fff;/,
  );
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
  assert.doesNotMatch(studentsWorkspaceSource, /<SegmentedControl/);
  assert.doesNotMatch(studentsWorkspaceSource, /directoryStatus/);
  assert.doesNotMatch(
    studentsWorkspaceSource,
    /Состояние списка учеников|label: "Активные"|label: "Архив"/,
  );
  assert.match(studentsWorkspaceSource, /aria-label="Фильтр по группе"/);
  assert.match(studentsWorkspaceSource, /aria-label="Сортировка"/);
  assert.match(studentsWorkspaceSource, /Без группы/);
  assert.match(studentsWorkspaceSource, /archivedDirectory/);
  assert.match(studentsWorkspaceSource, /pendingConnections/);
  assert.match(studentsWorkspaceSource, /kind: "profile" as const/);
  assert.match(studentsWorkspaceSource, /kind: "request" as const/);
  assert.match(studentDirectoryTableSource, /<ProductTable/);
  assert.match(
    studentDirectoryTableSource,
    />Ученики, их статусы и группы<\/caption>/,
  );
  assert.match(studentDirectoryTableSource, /onOpen/);
  assert.match(studentDirectoryTableSource, /slice\(0, 2\)/);
  assert.match(studentDirectoryTableSource, /ещё \{hiddenGroupCount\}/);
  assert.match(studentDirectoryTableSource, />В архиве<\/Chip>/);
  assert.match(studentDirectoryTableSource, /<RequestStatusBadge/);
  assert.match(studentDirectoryTableSource, /onRestore/);
  assert.match(studentDirectoryTableSource, /onPermanentlyDelete/);
  assert.match(studentDirectoryTableSource, /onCancelRequest/);
  assert.match(studentDirectoryTableSource, /student-directory-learners-table/);
  assert.match(studentDirectoryTableSource, /student-directory-actions-column/);
  assert.match(studentDirectoryTableSource, /Восстановить ученика/);
  assert.match(studentDirectoryTableSource, /Отменить запрос для/);
  assert.match(studentDirectoryTableSource, /colSpan=\{3\}/);
  assert.match(studentDirectoryTableSource, /colSpan=\{2\}/);
  assert.doesNotMatch(studentDirectoryTableSource, /role="button"/);
  assert.match(learnerProfileDialogSource, /Учебная история сохранится/);
  assert.match(learnerProfileDialogSource, /Имя в моём списке/);
  assert.match(
    learnerProfileDialogSource,
    /восстановить связь можно будет прямо из общего списка учеников/,
  );
  assert.match(studentDirectoryTableSource, /Восстановить/);
  assert.match(studentDirectoryTableSource, /status: "pending"/);
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
