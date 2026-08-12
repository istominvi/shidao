import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { componentTypeKeys } from "../../modules/course-builder/registry/contracts";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const workspacePath = "src/components/course-builder/course-workspace.tsx";
const lessonAuthoringPath =
  "src/components/course-builder/lesson-authoring-workspace.tsx";
const componentEditorPath =
  "src/components/course-builder/component-payload-editor.tsx";

test("workspace writes persisted course, lesson, and component entities", () => {
  const combined = [source(workspacePath), source(lessonAuthoringPath)].join(
    "\n",
  );

  for (const endpoint of [
    "/api/v2/courses/",
    "/api/v2/lessons/",
    "/api/v2/components/",
  ]) {
    assert.match(combined, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(combined, /\/api\/v2\/lessons\/\$\{lessonId\}\/components/);
  assert.match(combined, /method: "DELETE"|, "DELETE"/);
  assert.doesNotMatch(combined, /localStorage|fixture/i);
});

test("lesson creation stays title-first and no longer asks for a step", () => {
  const workspace = source(workspacePath);

  assert.match(workspace, /<DialogShell[\s\S]*?title="Новый урок"/);
  assert.match(workspace, />\s*Добавить урок\s*</);
  assert.match(
    workspace,
    /id="new-lesson-title"[\s\S]*?required[\s\S]*?maxLength=\{180\}/,
  );
  assert.match(workspace, /не отдельный компонент/);
  assert.match(workspace, /без ИИ и без списания токенов/);
  assert.doesNotMatch(workspace, /Добавить шаг|Новый шаг урока|new-step-title/);
});

test("course Lessons uses full-width controls and a dense sortable ProductTable", () => {
  const workspace = source(workspacePath);
  const styles = source("src/app/globals.css");
  const teachingStyles = source("src/app/styles/teaching-hub.css");
  const panelStart = workspace.indexOf("function CourseLessonsPanel");
  const panelEnd = workspace.indexOf("function CourseSourcesPanel");
  const panel = workspace.slice(panelStart, panelEnd);
  const projectionStart = panel.indexOf("const visibleLessons");
  const projectionEnd = panel.indexOf("useEffect", projectionStart);
  const projection = panel.slice(projectionStart, projectionEnd);
  const actionMenu =
    /<ActionMenu[\s\S]*?items=\{\[[\s\S]*?\]\}[\s\S]*?\/>/.exec(panel)?.[0];

  assert.ok(panelStart >= 0, "CourseLessonsPanel must remain present");
  assert.ok(panelEnd > panelStart, "CourseLessonsPanel must remain bounded");
  assert.match(
    panel,
    /className="compact-page-toolbar course-lessons-toolbar"[\s\S]*?aria-label="Управление уроками"/,
  );
  assert.match(
    panel,
    /className="compact-toolbar-search product-search-wrap"[\s\S]*?Поиск уроков[\s\S]*?placeholder="Название или описание урока…"/,
  );
  assert.match(
    panel,
    /className="compact-toolbar-rail"[\s\S]*?>\s*Добавить урок\s*</,
  );
  assert.match(
    panel,
    /className="product-table-wrap course-index-table-wrap course-lessons-table-wrap"[\s\S]*?aria-label="Таблица уроков курса"[\s\S]*?tabIndex=\{0\}/,
  );
  assert.match(
    panel,
    /<ProductTable className="course-index-table course-lessons-table">/,
  );
  assert.match(
    panel,
    /Уроки курса: план, экран ученика, проведение и дата обновления/,
  );

  for (const column of [
    "position",
    "title",
    "plan",
    "student",
    "schedule",
    "updated",
    "actions",
  ]) {
    assert.match(panel, new RegExp(`course-lessons-table-col-${column}`));
  }
  for (const label of [
    "№",
    "Урок",
    "План",
    "Экран ученика",
    "Проведение",
    "Обновлён",
  ]) {
    assert.match(panel, new RegExp(`>\\s*${label}\\s*<`));
  }
  assert.equal(panel.match(/<ProductTableSortableHeaderCell/g)?.length, 6);
  for (const key of [
    "position",
    "title",
    "plan",
    "student",
    "schedule",
    "updated",
  ]) {
    assert.match(
      panel,
      new RegExp(`nextProductTableSort\\(current, "${key}"\\)`),
    );
  }
  assert.match(
    panel,
    /useState<ProductTableSortState<CourseLessonSortKey>>\(\{[\s\S]*?key: "position",[\s\S]*?direction: "asc"/,
  );
  assert.match(projection, /return \[\.\.\.matchingLessons\]\.sort/);
  assert.doesNotMatch(projection, /jsonRequest|runMutation|method:/);
  assert.match(
    workspace,
    /if \(difference !== 0\) return direction \* difference;[\s\S]*?left\.position - right\.position[\s\S]*?left\.id\.localeCompare\(right\.id\)/,
  );
  assert.match(panel, /<ProductTableHeaderCell aria-label="Действия" \/>/);
  assert.match(panel, /learnerVisibleComponentCount\(lesson\)/);
  assert.match(panel, /lesson\.studentSlides\.length/);
  assert.match(panel, /lessonScheduleInfo\(lessonRuns\)/);
  assert.match(panel, /courseLessonContentUpdatedAt\(lesson\)/);
  assert.match(panel, /formatCourseLessonUpdatedAt\(lessonUpdatedAt\)/);

  assert.ok(actionMenu, "Course Lesson action menu must remain discoverable");
  assert.equal(actionMenu.match(/\bid: "/g)?.length, 2);
  assert.match(actionMenu, /triggerIcon=\{MoreVertical\}/);
  assert.match(actionMenu, /triggerVariant="ghost"/);
  assert.match(actionMenu, /\sportal\s/);
  assert.match(actionMenu, /id: "open"[\s\S]*?label: "Открыть урок"/);
  assert.match(actionMenu, /id: "schedule"[\s\S]*?label: scheduleActionLabel/);
  for (const contextualLabel of [
    "Назначить урок",
    "Изменить назначение",
    "Отметить результаты",
    "Завершить урок",
  ]) {
    assert.match(panel, new RegExp(`"${contextualLabel}"`));
  }
  assert.doesNotMatch(actionMenu, /Удалить|delete|destructive/);

  const legacyLessonCardPattern =
    /workspace-lesson-(?:list|item|row|leading-icon|number|title|arrow|schedule|status)/;
  assert.doesNotMatch(panel, legacyLessonCardPattern);
  assert.doesNotMatch(styles, legacyLessonCardPattern);
  assert.doesNotMatch(teachingStyles, legacyLessonCardPattern);
  assert.doesNotMatch(panel, /<section className="workspace-surface">/);
});

test("course About keeps settings and audience inline while materials stay course-wide", () => {
  const workspace = source(workspacePath);
  const materials = source(
    "src/components/course-builder/course-materials-panel.tsx",
  );
  const styles = source("src/app/globals.css");
  const aboutStart = workspace.indexOf("function CourseAboutPanel");
  const historyStart = workspace.indexOf("function CourseHistoryPanel");
  const aboutPanel = workspace.slice(aboutStart, historyStart);
  const aboutStyles = /\.course-about-panel\s*\{[^}]*\}/.exec(styles)?.[0];

  assert.ok(aboutStart >= 0, "CourseAboutPanel must remain present");
  assert.ok(historyStart > aboutStart, "CourseAboutPanel must remain bounded");
  assert.ok(aboutStyles, "Course About styles must remain discoverable");
  assert.match(workspace, /COURSE_WORKSPACE_TABS/);
  assert.match(
    aboutPanel,
    /CourseBasicsForm[\s\S]*?CourseAudienceEditor[\s\S]*?CourseSourcesPanel/,
  );
  assert.match(
    aboutPanel,
    /aria-label="Настройки, аудитория и источники курса"[\s\S]*?tabIndex=\{0\}/,
  );
  assert.match(aboutPanel, />\s*Настройки курса\s*</);
  assert.match(aboutPanel, />\s*Ученики и группы курса\s*</);
  assert.match(aboutPanel, /CourseSourcesPanel/);
  assert.doesNotMatch(aboutPanel, /CourseMaterialsPanel/);
  assert.doesNotMatch(workspace, /CourseSettingsDialog|CourseAudienceDialog/);
  assert.match(
    workspace,
    /item\.value === "materials"[\s\S]*?<CourseMaterialsPanel[\s\S]*?course=\{course\}/,
  );
  assert.match(materials, /projectCourseMaterials\(course\)/);
  assert.match(materials, /projection\.used/);
  assert.match(materials, /projection\.unused/);
  assert.doesNotMatch(materials, /CourseMaterialUploader/);
  assert.match(
    materials,
    /event\.preventDefault\(\)[\s\S]*?onOpenLesson\(usage\.lessonId\)/,
  );
  assert.match(materials, /Используются в уроках/);
  assert.match(materials, /Другие материалы курса/);
  assert.match(materials, /общая библиотека курса/);
  assert.match(materials, /Отдельной копии файла у урока нет/);
  assert.match(materials, /Содержимое файлов пока не анализировалось/);
  assert.match(
    workspace,
    /const saved = await runMutation\("Сохраняем настройки курса…"[\s\S]*?if \(saved\) setSaved\(true\)/,
  );
  assert.match(workspace, /Настройки сохранены/);
  assert.doesNotMatch(aboutStyles, /max-height/);
  assert.doesNotMatch(aboutStyles, /overflow(?:-y)?:\s*(?:auto|scroll)/);
});

test("course uses four consolidated tabs while lesson keeps five surfaces", () => {
  const workspace = source(workspacePath);
  const authoring = source(lessonAuthoringPath);
  const tabs = source("src/components/ui/workspace-tabs.tsx");
  const navigation = source(
    "src/components/course-builder/course-workspace-navigation.ts",
  );

  for (const label of ["Уроки", "О курсе", "Материалы", "История"]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(navigation, /label: "Описание"|label: "Источники"/);
  for (const label of [
    "План",
    "Экран ученика",
    "Домашнее задание",
    "Материалы",
    "История",
  ]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }
  assert.match(workspace, /ariaLabel="Разделы курса"/);
  assert.match(
    workspace,
    /COURSE_WORKSPACE_TABS\.find\([\s\S]*?searchParams\.get\("tab"\)/,
  );
  assert.match(
    workspace,
    /function selectCourseSurface[\s\S]*?searchParams\.set\("tab", courseSurface\)/,
  );
  assert.match(
    workspace,
    /item\.value === "materials"[\s\S]*?count: course\.attachments\.length/,
  );
  assert.match(authoring, /ariaLabel="Разделы урока"/);
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /aria-controls=\{workspaceTabPanelId/);
  assert.match(tabs, /tabIndex=\{active \? 0 : -1\}/);
  assert.match(workspace, /role="tabpanel"/);
  assert.match(workspace, /aria-labelledby=\{workspaceTabId/);
  assert.match(authoring, /role="tabpanel"/);
  assert.match(authoring, /aria-labelledby=\{workspaceTabId/);
  assert.match(authoring, />\s*Компонент\s*</);
  assert.match(authoring, /Редактор домашнего задания будет/);
  assert.match(
    authoring,
    /CourseMaterialsPanel course=\{course\} context="lesson"/,
  );
  assert.match(
    authoring,
    /LessonHistorySurface lesson=\{lesson\} runs=\{runs\}/,
  );
  assert.match(authoring, /LessonRunStatusButton/);
  assert.match(authoring, /Завершённые индивидуальные результаты сохранятся/);
  assert.doesNotMatch(authoring, /\/api\/teacher\//);
  assert.match(tabs, /aria-orientation="horizontal"/);
});

test("lesson metadata moves into a transparent page header and remains editable", () => {
  const workspace = source(workspacePath);
  const authoring = source(lessonAuthoringPath);
  const styles = source("src/app/globals.css");

  assert.match(authoring, /<AppPageHeader/);
  assert.match(
    authoring,
    /back=\{\{[\s\S]*?type: "button"[\s\S]*?onClick: onBackToCourse[\s\S]*?label: course\.title/,
  );
  assert.match(authoring, /formatLessonWorkspaceTitle/);
  assert.match(authoring, /headingRef=\{lessonHeadingRef\}/);
  assert.match(authoring, /closest\("header"\)\?\.scrollIntoView/);
  assert.match(authoring, /focus\(\{ preventScroll: true \}\)/);
  assert.match(workspace, /lessonRowRefs\.current\.get\(focusLessonId\)/);
  assert.doesNotMatch(
    authoring,
    /rounded-3xl border border-violet-200 bg-violet-50\/45/,
  );
  assert.match(
    styles,
    /\.app-page-header\s*\{[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/,
  );

  assert.match(authoring, /title="Редактировать урок"/);
  assert.match(
    authoring,
    /Название урока[\s\S]*?<input[\s\S]*?required[\s\S]*?maxLength=\{180\}/,
  );
  assert.match(
    authoring,
    /Комментарий преподавателя[\s\S]*?<textarea[\s\S]*?maxLength=\{1200\}/,
  );
  assert.match(authoring, /if \(saved\) onClose\(\)/);
  assert.match(authoring, />\s*Сохранить\s*</);
});

test("course routes use the flat demo background and unified visual controls", () => {
  const styles = source("src/app/globals.css");
  const navigationStyles = source("src/app/styles/navigation.css");
  const topNav = source("src/components/top-nav.tsx");
  const routeSources = [
    source("src/app/(app)/courses/page.tsx"),
    source("src/app/(app)/courses/new/page.tsx"),
    source("src/app/(app)/courses/[courseId]/page.tsx"),
  ].join("\n");
  const courseShellStyles = /\.course-demo-shell\s*\{[\s\S]*?\n\}/.exec(
    styles,
  )?.[0];
  const demoPageHeaderStyles =
    /\.course-demo-shell \.app-page-header\s*\{[^}]*\}/.exec(styles)?.[0];

  assert.ok(courseShellStyles, "Course shell styles must remain discoverable");
  assert.ok(
    demoPageHeaderStyles,
    "Demo page-header styles must remain discoverable",
  );
  assert.match(courseShellStyles, /background: #f5f1e8;/);
  assert.doesNotMatch(courseShellStyles, /gradient/i);
  assert.doesNotMatch(routeSources, /landing-noise/);

  assert.match(
    styles,
    /\.course-demo-shell \.app-page-title\s*\{[\s\S]*?font-weight: 400;[\s\S]*?letter-spacing: -0\.055em;/,
  );
  assert.match(
    demoPageHeaderStyles,
    /--app-page-header-title-size: clamp\(2rem, 3\.8vw, 3rem\);/,
  );
  assert.match(demoPageHeaderStyles, /min-height: 200px;/);
  assert.doesNotMatch(
    demoPageHeaderStyles,
    /(?:^|\n)\s*height:\s*200px;/,
    "The canonical header must be able to grow beyond its 200px minimum",
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn\s*\{[\s\S]*?--course-demo-control-radius[\s\S]*?--course-demo-control-font-weight/,
  );
  assert.match(
    styles,
    /\.workspace-tabs\s*\{[^}]*--workspace-tabs-inline-offset: 0px;[^}]*padding-inline: var\(--workspace-tabs-inline-offset\);/,
  );
  assert.match(
    styles,
    /\.workspace-tabs::before\s*\{[^}]*right: var\(--workspace-tabs-inline-offset\);[^}]*left: var\(--workspace-tabs-inline-offset\);[^}]*height: 1px;[^}]*background: rgba\(20, 20, 20, 0\.2\);/,
  );
  assert.match(
    styles,
    /\.workspace-tab\s*\{[\s\S]*?--course-demo-control-height[\s\S]*?flex: 0 0 auto;[\s\S]*?border-radius: 0;/,
  );
  assert.match(
    styles,
    /\.workspace-tab-active::after\s*\{[^}]*bottom: 0;[^}]*height: 4px;[^}]*border-radius: 0;[^}]*background: #141414;/,
  );
  assert.match(topNav, /container course-top-nav/);
  assert.match(
    navigationStyles,
    /\.course-top-nav\s*\{[\s\S]*?position: sticky;[\s\S]*?top: 0;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-demo\s*\{[\s\S]*?height: 4\.25rem;[\s\S]*?border-radius: var\(--product-card-radius, 1\.25rem\);[\s\S]*?background: #fff;/,
  );
  assert.match(
    navigationStyles,
    /\.nav-dropdown-panel\s*\{[\s\S]*?background: #fff;/,
  );
});

test("active product buttons and header controls share one flat 40px contract", () => {
  const styles = source("src/app/globals.css");
  const navigationStyles = source("src/app/styles/navigation.css");
  const teachingStyles = source("src/app/styles/teaching-hub.css");

  assert.match(
    styles,
    /:root\s*\{[\s\S]*?--product-element-radius: 0\.75rem;[\s\S]*?--product-card-radius: 1\.25rem;[\s\S]*?--product-row-height: 2\.5rem;[\s\S]*?\.course-demo-shell\s*\{[\s\S]*?--course-demo-element-radius: var\(--product-element-radius\);[\s\S]*?--course-demo-card-radius: var\(--product-card-radius\);[\s\S]*?--course-demo-table-radius: var\(--course-demo-element-radius\);[\s\S]*?--course-demo-table-row-height: var\(--product-row-height\);[\s\S]*?--course-demo-control-height: var\(--product-row-height\);[\s\S]*?--course-demo-control-radius: var\(--course-demo-element-radius\);[\s\S]*?--course-demo-control-padding-inline: 0\.75rem;[\s\S]*?--course-demo-content-inset: 0\.75rem;[\s\S]*?--course-demo-control-font-size: 0\.88rem;[\s\S]*?--course-demo-control-font-weight: 400;[\s\S]*?--course-demo-control-icon-size: 1rem;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn\s*\{[^}]*--product-control-height: var\(--course-demo-control-height\);[^}]*border-radius: var\(--course-demo-control-radius\);[^}]*font-size: var\(--course-demo-control-font-size\);[^}]*font-weight: var\(--course-demo-control-font-weight\);[^}]*box-shadow: none;[^}]*transform: none;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn svg\s*\{[^}]*width: var\(--course-demo-control-icon-size\);[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-search-icon,[\s\S]*?\.course-demo-shell \.product-select-icon\s*\{[^}]*color: var\(--course-demo-control-foreground\);[^}]*opacity: 1;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.course-filter-trigger svg,[\s\S]*?\.course-demo-shell \.compact-toolbar-rail \[role="group"\] button svg\s*\{[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn-primary\s*\{[^}]*border-color: #141414;[^}]*background: #141414;[^}]*color: #fff;[^}]*box-shadow: none;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn-primary:hover:not\(:disabled\)\s*\{[^}]*background: #141414;[^}]*box-shadow: none;[^}]*transform: none;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn-secondary\s*\{[^}]*border-color: var\(--course-demo-control-border\);[^}]*background: #fff;[^}]*color: var\(--course-demo-control-foreground\);/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn-ghost\s*\{[^}]*border-color: transparent;[^}]*background: transparent;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn\.compact-toolbar-reset\s*\{[^}]*border-color: var\(--course-demo-control-border\);[^}]*background: #fff;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn:focus-visible:not\(:disabled\)\s*\{[^}]*box-shadow: 0 0 0 3px rgba\(20, 20, 20, 0\.12\);/,
  );
  assert.match(
    styles,
    /\.action-menu-item\s*\{[^}]*min-height: var\([^}]*--product-row-height[^}]*align-items: center;[^}]*gap: 0\.5rem;[^}]*border: 0;[^}]*padding: 0 var\(--course-demo-control-padding-inline, 0\.75rem\);[^}]*font-size: var\(--course-demo-control-font-size, 0\.88rem\);[^}]*font-weight: var\(--course-demo-control-font-weight, 400\);/,
  );

  assert.match(
    navigationStyles,
    /\.site-header-shell-demo \.site-header-nav-pill,[\s\S]*?\.site-header-shell-demo \.header-action-btn\s*\{[^}]*height: 2\.5rem;[^}]*font-size: var\(--course-demo-control-font-size, 0\.88rem\);[^}]*font-weight: var\(--course-demo-control-font-weight, 400\);/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-demo \.nav-user-trigger-name\s*\{[^}]*font-size: var\(--course-demo-control-font-size, 0\.88rem\);[^}]*font-weight: var\(--course-demo-control-font-weight, 400\);/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-demo \.nav-pill-active\s*\{[^}]*box-shadow: none;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-demo \.nav-pill-icon,[\s\S]*?\.site-header-shell-demo \.nav-user-trigger > span > svg\s*\{[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-demo \.nav-pill-active \.nav-pill-icon\s*\{[^}]*opacity: 1;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-demo \.nav-dropdown-item\s*\{[^}]*border: 0;[^}]*font-weight: var\(--course-demo-control-font-weight, 400\);/,
  );

  assert.match(
    teachingStyles,
    /\.teaching-date-trigger\s*\{[^}]*font-size: var\(--course-demo-control-font-size\);[^}]*font-weight: var\(--course-demo-control-font-weight\);/,
  );
});

test("component picker is registry-driven and grouped into Russian categories", () => {
  const authoring = source(lessonAuthoringPath);
  const styles = source("src/app/globals.css");
  const pickerStart = authoring.indexOf("function ComponentPickerDialog");
  const pickerEnd = authoring.indexOf("function LessonEditorDialog");
  const picker = authoring.slice(pickerStart, pickerEnd);
  const panelStyles = /\.component-picker-dialog-panel\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const bodyStyles = /\.component-picker-dialog-body\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const listStyles = /\.component-picker-dialog-list\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const closeStyles =
    /\.component-picker-dialog \.dialog-shell-close,\s*\.component-picker-dialog \.dialog-shell-close:hover\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];

  assert.match(authoring, /componentDefinitions\.filter/);
  assert.ok(pickerStart >= 0 && pickerEnd > pickerStart);
  for (const category of [
    "Текст",
    "Медиа",
    "Игры и активности",
    "Ссылки и файлы",
  ]) {
    assert.match(authoring, new RegExp(category));
  }
  assert.doesNotMatch(authoring, /Разделители и структура плана/);
  assert.doesNotMatch(authoring, /visibility: "staff_only"/);
  assert.match(authoring, /сразу перейти к редактированию/);
  assert.match(picker, /className="component-picker-dialog"/);
  assert.match(
    picker,
    /panelClassName="component-picker-dialog-panel max-w-4xl"/,
  );
  assert.match(picker, /bodyClassName="component-picker-dialog-body"/);
  assert.doesNotMatch(
    picker,
    /Выберите элемент плана|Новый компонент сначала виден только преподавателю/,
  );
  assert.doesNotMatch(
    picker,
    /Заголовки, основной текст|Изображения, слайдшоу|Опросы и интерактивные задания|Внешние ссылки и материалы/,
  );
  assert.doesNotMatch(picker, /<h3|CATEGORY_ITEMS\.find/);

  assert.ok(panelStyles, "component picker panel styles must remain present");
  assert.match(panelStyles, /display: flex/);
  assert.match(panelStyles, /width: min\(56rem, calc\(100dvw - 2rem\)\)/);
  assert.match(panelStyles, /height: min\(42rem, calc\(100dvh - 2rem\)\)/);
  assert.match(panelStyles, /max-height: none/);
  assert.match(panelStyles, /overflow: hidden/);
  assert.ok(bodyStyles, "component picker body styles must remain present");
  assert.match(bodyStyles, /min-height: 0/);
  assert.match(bodyStyles, /flex: 1/);
  assert.ok(listStyles, "component picker list styles must remain present");
  assert.match(listStyles, /overflow-y: auto/);
  assert.match(listStyles, /scrollbar-gutter: stable/);
  assert.ok(closeStyles, "component picker close styles must remain present");
  assert.match(closeStyles, /height: 2\.5rem/);
  assert.match(closeStyles, /width: 2\.5rem/);
  assert.match(closeStyles, /border: 0/);
  assert.match(closeStyles, /background: transparent/);
});

test("component payload editor covers every active registry type without divider", () => {
  const editor = source(componentEditorPath);
  const payloadSwitchStart = editor.indexOf("switch (typeKey)");
  const placementStart = editor.indexOf("function PlacementFields");
  assert.ok(payloadSwitchStart >= 0 && placementStart > payloadSwitchStart);

  const payloadSwitch = editor.slice(payloadSwitchStart, placementStart);
  const editorKeys = Array.from(
    payloadSwitch.matchAll(/^\s{4}case "([a-z_]+)":/gm),
    (match) => match[1],
  );
  assert.deepEqual(editorKeys, componentTypeKeys);
  assert.doesNotMatch(editor, /case "divider"|typeKey === "divider"/);
  assert.match(editor, /HTTPS-ссылка на видео/);
  assert.match(editor, /Допустимые варианты разделяйте \|/);
  assert.match(editor, /элемент = точное название категории/);
});

test("component cards persist edit, delete, order, and ordered Student Screen placement", () => {
  const authoring = source(lessonAuthoringPath);

  assert.match(authoring, /Сохраняем компонент…/);
  assert.match(authoring, /Удаляем компонент…/);
  assert.match(authoring, /Меняем порядок компонентов…/);
  assert.match(authoring, /Обновляем экран ученика…/);
  assert.match(
    authoring,
    /\/api\/v2\/components\/\$\{component\.id\}\/student-screen/,
  );
  for (const mode of ['mode: "existing"', 'mode: "new"', 'mode: "hide"']) {
    assert.match(authoring, new RegExp(mode));
  }
  assert.match(authoring, /aria-haspopup="dialog"/);
  assert.match(authoring, /aria-expanded=\{studentScreenPopoverOpen\}/);
  assert.match(authoring, /показывается на слайде/);
  assert.match(authoring, /не показывается ученику/);
  assert.match(authoring, /getStudentSlidePlacementOptions/);
  assert.match(authoring, /Новый слайд/);
  assert.match(authoring, /Убрать с экрана/);
  assert.match(authoring, /group-hover:opacity-100/);
  assert.match(authoring, /if \(saved\) setEditing\(false\)/);
  assert.match(
    authoring,
    /learnerVisible[\s\S]*?border-sky-200 bg-sky-100 text-sky-800/,
  );
  assert.doesNotMatch(authoring, /На экране ученика|Только преподавателю/);
  assert.doesNotMatch(authoring, /border-b border-neutral-100 pb-3/);
});

test("Student Screen surfaces render one ordered slide without legacy step groups", () => {
  const authoring = source(lessonAuthoringPath);
  const preview = source(
    "src/components/course-builder/student-screen-preview.tsx",
  );
  const combined = [authoring, preview].join("\n");
  const inlineSurface =
    /function StudentLessonSurface[\s\S]*?function HomeworkSurface/.exec(
      authoring,
    )?.[0];

  assert.ok(inlineSurface, "inline Student Screen must remain discoverable");
  assert.match(authoring, /const components = lesson\.components/);
  assert.match(authoring, /\[\.\.\.lesson\.studentSlides\]/);
  assert.match(authoring, /lesson\.components\.filter/);
  assert.match(authoring, /component\.studentSlideId === slide\.id/);
  assert.match(preview, /\[\.\.\.activeLesson\.slides\]/);
  assert.match(combined, /activeSlide\.components\.map/);
  assert.match(combined, /mode="student"/);
  assert.match(combined, /Предыдущий слайд/);
  assert.match(combined, /Следующий слайд/);
  assert.match(combined, /Слайд \$\{safeActiveSlideIndex \+ 1\} из/);
  assert.doesNotMatch(combined, /component\.visibility/);
  assert.match(inlineSurface, /lesson\.title/);
  assert.doesNotMatch(inlineSurface, /lesson\.summary/);
  assert.ok(
    inlineSurface.indexOf("lesson.title") <
      inlineSurface.indexOf("activeSlide.components.map"),
    "Lesson title must render before the active slide",
  );
  assert.ok(
    preview.indexOf("activeLesson.title") <
      preview.indexOf("activeSlide.components.map"),
    "fullscreen Lesson title must render before the active slide",
  );
  assert.doesNotMatch(preview, /activeLesson\.summary|lesson\.summary/);
  assert.doesNotMatch(combined, /lesson\.steps|activeLesson\.steps/);
  assert.doesNotMatch(combined, /learnerGroups|indexInGroup|groupSize/);
  assert.doesNotMatch(combined, /предыдущей версией редактора/i);
  assert.doesNotMatch(combined, /learnerInstruction/);
  assert.doesNotMatch(combined, /teacherInstructions/);
  assert.doesNotMatch(preview, /Шаг|шага|шагом/);
});

test("course builder surfaces keep Russian product vocabulary", () => {
  const combined = [
    source(workspacePath),
    source(lessonAuthoringPath),
    source("src/components/course-builder/student-screen-preview.tsx"),
    source("src/components/course-builder/new-course-form.tsx"),
    source("src/components/course-builder/courses-index.tsx"),
  ].join("\n");

  for (const visibleEnglishPhrase of [
    "Course workspace",
    "Course builder",
    "Student Screen preview",
    "Teacher Side",
    "learner-visible",
    "Добавить Lesson",
  ]) {
    assert.doesNotMatch(combined, new RegExp(visibleEnglishPhrase));
  }
});
