import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  componentTypeKeys,
  creatableComponentTypeKeys,
} from "../../modules/course-builder/registry/contracts";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const workspacePath = "src/components/course-builder/course-workspace.tsx";
const lessonAuthoringPath =
  "src/components/course-builder/lesson-authoring-workspace.tsx";
const componentEditorPath =
  "src/components/course-builder/component-payload-editor.tsx";
const componentPickerPreviewPath =
  "src/components/course-builder/component-picker-preview.tsx";
const courseWorkspaceNavigationPath =
  "src/components/course-builder/course-workspace-navigation.ts";

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
  const actionMenu = /const lessonActionItems =[\s\S]*?\n\s*];/.exec(
    panel,
  )?.[0];

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
  assert.doesNotMatch(
    projection,
    /courseBuilderJsonRequest|runMutation|method:/,
  );
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
  assert.match(panel, /triggerIcon=\{MoreVertical\}/);
  assert.match(panel, /triggerVariant="ghost"/);
  assert.match(panel, /\sportal\s/);
  assert.match(actionMenu, /id: "open"[\s\S]*?label: "Открыть урок"/);
  assert.match(actionMenu, /id: "schedule"[\s\S]*?label: scheduleActionLabel/);
  for (const contextualLabel of [
    "Назначить урок",
    "Изменить назначение",
    "Отметить результаты",
    "Продолжить проведение",
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

test("course About keeps child audience conditional while materials stay course-wide", () => {
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
  assert.match(workspace, /courseWorkspaceTabs/);
  assert.match(
    aboutPanel,
    /CourseBasicsForm[\s\S]*?CourseAudienceEditor[\s\S]*?CourseSourcesPanel/,
  );
  assert.match(
    aboutPanel,
    /educatorCourse[\s\S]*?"Настройки и источники курса"[\s\S]*?: "Настройки, аудитория и источники курса"/,
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

test("course uses audience-aware four-tab sets while lesson history is teaching-only", () => {
  const workspace = source(workspacePath);
  const authoring = source(lessonAuthoringPath);
  const tabs = source("src/components/ui/workspace-tabs.tsx");
  const navigation = source(
    "src/components/course-builder/course-workspace-navigation.ts",
  );

  for (const label of ["Уроки", "О курсе", "Материалы", "История"]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }
  assert.match(navigation, /EDUCATOR_COURSE_WORKSPACE_TABS/);
  assert.match(navigation, /label: "Аттестация"/);
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
    /courseWorkspaceTabs\([\s\S]*?searchParams\.get\("tab"\)/,
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
  assert.match(authoring, /<HomeworkAuthoringSurface/);
  assert.doesNotMatch(authoring, /Редактор домашнего задания будет/);
  assert.match(
    authoring,
    /CourseMaterialsPanel course=\{course\} context="lesson"/,
  );
  assert.match(
    authoring,
    /<LessonHistorySurface[\s\S]*?lesson=\{lesson\}[\s\S]*?runs=\{runs\}[\s\S]*?observations=\{observations\}/,
  );
  assert.match(authoring, /LessonRunStatusButton/);
  assert.match(
    authoring,
    /availableLessonTabs = LESSON_WORKSPACE_TABS\.filter\([\s\S]*?teachingEnabled/,
  );
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
    /back=\{\{[\s\S]*?type: "button"[\s\S]*?onClick: backToCourse[\s\S]*?label: course\.title/,
  );
  assert.match(authoring, /formatLessonWorkspaceTitle/);
  assert.match(authoring, /headingRef=\{lessonHeadingRef\}/);
  assert.match(authoring, /metric=\{`Компонентов:/);
  assert.doesNotMatch(
    authoring.slice(
      authoring.indexOf("<AppPageHeader"),
      authoring.indexOf("<WorkspaceTabs", authoring.indexOf("<AppPageHeader")),
    ),
    /lesson\.summary/,
  );
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

test("course routes use the flat app background and unified visual controls", () => {
  const styles = source("src/app/globals.css");
  const navigationStyles = source("src/app/styles/navigation.css");
  const appLayout = source("src/app/(app)/layout.tsx");
  const appManifest = source("src/app/manifest.ts");
  const siteHeader = source("src/components/site-header.tsx");
  const topNav = source("src/components/top-nav.tsx");
  const routeSources = [
    source("src/app/(app)/courses/page.tsx"),
    source("src/app/(app)/courses/new/page.tsx"),
    source("src/app/(app)/courses/[courseId]/page.tsx"),
  ].join("\n");
  const courseShellStyles = /\.app-page-shell\s*\{[\s\S]*?\n\}/.exec(
    styles,
  )?.[0];
  const appPageHeaderStyles =
    /\.app-page-shell \.app-page-header\s*\{[^}]*\}/.exec(styles)?.[0];
  const productHeaderStyles = /\.site-header-shell-app\s*\{[^}]*\}/.exec(
    navigationStyles,
  )?.[0];
  const productHeaderRowStyles =
    /\.site-header-shell-app \.site-header-content-row\s*\{[^}]*\}/.exec(
      navigationStyles,
    )?.[0];

  assert.ok(courseShellStyles, "Course shell styles must remain discoverable");
  assert.ok(
    appPageHeaderStyles,
    "App page-header styles must remain discoverable",
  );
  assert.ok(
    productHeaderStyles,
    "Product header styles must remain discoverable",
  );
  assert.ok(
    productHeaderRowStyles,
    "Product header content-row styles must remain discoverable",
  );
  const viewportExport =
    /export const viewport[^=]*=\s*\{[\s\S]*?\n\};/.exec(appLayout)?.[0] ?? "";
  assert.match(viewportExport, /themeColor: "#f5f1e8"/);
  assert.match(viewportExport, /viewportFit: "cover"/);
  assert.match(appManifest, /background_color: "#f5f1e8"/);
  assert.match(appManifest, /theme_color: "#f5f1e8"/);
  assert.match(styles, /:root\s*\{[^}]*--product-app-background: #f5f1e8;/);
  assert.match(
    styles,
    /html\s*\{[^}]*background-color: var\(--product-app-background\);/,
  );
  assert.match(
    styles,
    /body:has\(\.app-page-shell\)\s*\{[^}]*--document-background: var\(--product-app-background\);/,
  );
  assert.match(
    styles,
    /body\s*\{[^}]*background: var\(--document-background\);/,
  );
  assert.match(
    courseShellStyles,
    /background: var\(--product-app-background\);/,
  );
  assert.doesNotMatch(courseShellStyles, /gradient/i);
  assert.doesNotMatch(routeSources, /landing-noise/);

  assert.match(
    styles,
    /\.app-page-shell \.app-page-title\s*\{[\s\S]*?font-weight: 400;[\s\S]*?letter-spacing: -0\.055em;/,
  );
  assert.match(
    appPageHeaderStyles,
    /--app-page-header-title-size: clamp\(2rem, 3\.8vw, 3rem\);/,
  );
  assert.doesNotMatch(
    appPageHeaderStyles,
    /(?:^|\n)\s*(?:min-)?height:/,
    "The canonical header height must come only from content and padding",
  );
  assert.doesNotMatch(appPageHeaderStyles, /justify-content:/);
  assert.match(
    styles,
    /\.app-page-shell \.product-btn\s*\{[\s\S]*?--product-control-radius[\s\S]*?--product-control-font-weight/,
  );
  assert.match(
    styles,
    /\.workspace-tabs\s*\{[^}]*--workspace-tabs-inline-offset: 0px;[^}]*padding-inline: var\(--workspace-tabs-inline-offset\);/,
  );
  assert.match(
    styles,
    /\.workspace-tabs::before\s*\{[^}]*z-index: 1;[^}]*right: var\(--workspace-tabs-inline-offset\);[^}]*bottom: 0;[^}]*left: var\(--workspace-tabs-inline-offset\);[^}]*height: 3px;[^}]*background: var\(--product-workspace-tabs-divider-color\);[^}]*transform: scaleY\(0\.4\);[^}]*transform-origin: center bottom;/,
  );
  assert.match(
    styles,
    /\.workspace-tab\s*\{[\s\S]*?--product-control-height[\s\S]*?flex: 0 0 auto;[\s\S]*?border-radius: var\(--product-control-radius, 0\.75rem\)[\s\S]*?0 0;/,
  );
  assert.match(
    styles,
    /\.workspace-tab-active::after\s*\{[^}]*z-index: 2;[^}]*bottom: 0;[^}]*height: 4px;[^}]*border-radius: 0;[^}]*background: #141414;/,
  );
  assert.match(topNav, /container app-top-nav/);
  assert.match(
    appLayout,
    /<div className="app-product-chrome">[\s\S]*?<PersistentTopNav \/>[\s\S]*?\{children\}/,
  );
  assert.match(
    navigationStyles,
    /\.app-top-nav\s*\{[^}]*position: relative;[^}]*z-index: 60;[^}]*padding-top: 1rem;/,
  );
  assert.match(
    navigationStyles,
    /@media \(min-width: 768px\)\s*\{\s*\.app-product-chrome > \.app-top-nav\s*\{[^}]*width: min\(1240px, calc\(100% - 2rem\)\);/,
  );
  assert.match(
    navigationStyles,
    /@media \(min-width: 768px\)[\s\S]*?\.app-product-chrome > main\.app-page-shell\s*\{[^}]*min-height: calc\(100vh - 5rem\);[^}]*min-height: calc\(100dvh - 5rem\);/,
  );
  assert.match(
    navigationStyles,
    /@media \(max-width: 767px\)[\s\S]*?html:has\(\.app-page-shell\)\s*\{[^}]*--mobile-header-safe-top:[^;]*env\(safe-area-inset-top, 0px\)[^;]*;[^}]*--mobile-header-shell-height: 4rem;[^}]*--mobile-header-fade-depth: 0\.75rem;[^}]*--mobile-header-stack-height:[^;]*var\(--mobile-header-safe-top\)[^;]*var\(--mobile-header-shell-height\)[^;]*var\(--mobile-header-fade-depth\)[^;]*;[^}]*scroll-padding-block-start: var\(--mobile-header-stack-height\);/,
  );
  assert.match(
    navigationStyles,
    /\.app-page-shell\s*\{[^}]*padding-block-start: var\(--mobile-header-stack-height\);[^}]*\}[\s\S]*?\.app-page-shell \.app-page-header\s*\{[^}]*scroll-margin-top: 0;/,
  );
  assert.match(
    navigationStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.app-top-nav,\s*\.app-product-chrome > \.app-top-nav\s*\{[^}]*position: fixed;[^}]*inset-block-start: 0;[^}]*inset-inline: 0;[^}]*width: 100%;[^}]*height: var\(--mobile-header-stack-height\);[^}]*max-width: none;[^}]*margin-inline: 0;[^}]*isolation: isolate;[^}]*background-color: transparent;[^}]*background-image: none;[^}]*pointer-events: none;/,
  );
  assert.match(
    navigationStyles,
    /\.app-top-nav::before\s*\{[^}]*content: "";[^}]*position: absolute;[^}]*z-index: 0;[^}]*inset: 0;[^}]*background-image: linear-gradient\([\s\S]*?rgba\(245, 241, 232, 0\.92\) var\(--mobile-header-safe-top\)[\s\S]*?rgba\(245, 241, 232, 0\.22\)[\s\S]*?calc\(100% - var\(--mobile-header-fade-depth\)\)[\s\S]*?rgba\(245, 241, 232, 0\) 100%[^}]*pointer-events: none;/,
  );
  assert.match(
    navigationStyles,
    /\.app-top-nav > \.site-header\s*\{[^}]*position: relative;[^}]*z-index: 1;[^}]*pointer-events: auto;/,
  );
  assert.match(
    navigationStyles,
    /:root\s*\{[^}]*--product-header-shell-shadow: 0px 6px 12px oklch\(0 0 0 \/ 0\.05\);/,
  );
  assert.match(productHeaderStyles, /height: 4rem;/);
  assert.match(productHeaderStyles, /min-height: 4rem;/);
  assert.match(productHeaderStyles, /padding: 0\.75rem;/);
  assert.match(
    productHeaderStyles,
    /border-radius: var\(--product-card-radius, 1\.25rem\);/,
  );
  assert.match(
    productHeaderStyles,
    /background-color: var\(--product-surface-background, #fff\);/,
  );
  assert.match(productHeaderStyles, /background-image: none;/);
  assert.match(productHeaderStyles, /opacity: 1;/);
  assert.match(productHeaderStyles, /backdrop-filter: none;/);
  assert.match(productHeaderStyles, /-webkit-backdrop-filter: none;/);
  assert.match(
    productHeaderStyles,
    /box-shadow: var\(--product-header-shell-shadow\);/,
  );
  assert.doesNotMatch(productHeaderStyles, /inset|20px 44px/);
  assert.match(
    siteHeader,
    /<NavigationHeaderShell[\s\S]*?>\s*<div className="site-header-content-row">/,
  );
  assert.match(
    siteHeader,
    /<div className="site-header-actions">\{actions\}<\/div>\s*<\/div>\s*<\/NavigationHeaderShell>/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-content-row\s*\{[^}]*display: flex;[^}]*width: 100%;[^}]*min-width: 0;[^}]*align-items: center;/,
  );
  assert.match(productHeaderRowStyles, /box-sizing: border-box;/);
  assert.match(productHeaderRowStyles, /height: var\(--header-pill-height\);/);
  assert.match(
    productHeaderRowStyles,
    /min-height: var\(--header-pill-height\);/,
  );
  assert.match(
    productHeaderRowStyles,
    /max-height: var\(--header-pill-height\);/,
  );
  assert.match(
    navigationStyles,
    /@media \(min-width: 768px\)\s*\{[\s\S]*?\.site-header-content-row\s*\{[^}]*display: grid;[^}]*grid-template-columns: auto 1fr auto;[^}]*align-items: center;[^}]*\}[\s\S]*?\.site-header-shell-app \.site-header-content-row\s*\{[^}]*grid-template-rows: minmax\(0, var\(--header-pill-height\)\);[^}]*align-content: center;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-app \.site-header-brand,[\s\S]*?\.site-header-shell-app \.site-header-actions > \*\s*\{[^}]*box-sizing: border-box;[^}]*height: var\(--header-pill-height\);[^}]*min-height: var\(--header-pill-height\);[^}]*max-height: var\(--header-pill-height\);/,
  );
  assert.match(
    styles,
    /\.product-dropdown-surface\s*\{[^}]*border: 0;[^}]*border-radius: var\([^}]*--product-dropdown-radius,[^}]*background: var\(--product-dropdown-background, #fff\);[^}]*padding: var\(--product-dropdown-inset, 0\.375rem\);/,
  );
});

test("course workspaces keep the route empty until a real header or error is ready", () => {
  const workspace = source(workspacePath);
  const published = source(
    "src/components/course-builder/published-course-workspace.tsx",
  );

  assert.doesNotMatch(workspace, /WorkspaceSkeleton/);
  assert.doesNotMatch(
    workspace,
    /Загружаем курс, уроки и компоненты из баз[ы]/,
  );
  assert.match(
    workspace,
    /if \(!course\)[\s\S]*?if \(error\)[\s\S]*?return null;/,
  );
  assert.doesNotMatch(published, /Загружаем курс(?:…)/);
  assert.match(published, /if \(!course\) \{\s*if \(!error\) return null;/);
  assert.match(published, /role="alert"/);
});

test("product buttons share one animated raised-control elevation contract", () => {
  const styles = source("src/app/globals.css");
  const navigationStyles = source("src/app/styles/navigation.css");
  const teachingStyles = source("src/app/styles/teaching-hub.css");
  const segmentedControl = source("src/components/ui/segmented-control.tsx");
  const scheduleWorkspace = source(
    "src/components/teaching-hub/schedule-workspace.tsx",
  );
  const learningProfile = source(
    "src/components/learner-identity/learning-profile-workspace.tsx",
  );
  const forcedColorsStart = styles.indexOf("@media (forced-colors: active)");
  const forcedColorsEnd = styles.indexOf(
    ".course-action-inline-error",
    forcedColorsStart,
  );
  const forcedColorsStyles = styles.slice(forcedColorsStart, forcedColorsEnd);
  const reducedMotionStyles =
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/.exec(
      styles,
    )?.[0] ?? "";
  const touchMediaQuery =
    "@media (max-width: 767px), (hover: none) and (pointer: coarse)";
  const touchMediaStart = styles.indexOf(touchMediaQuery);
  const narrowMediaStart = styles.indexOf(
    "@media (max-width: 767px)",
    touchMediaStart + touchMediaQuery.length,
  );
  const touchStyles = styles.slice(touchMediaStart, narrowMediaStart);
  const productFocusStyles =
    /\.product-btn:focus-visible\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";

  assert.ok(touchMediaStart >= 0);
  assert.ok(narrowMediaStart > touchMediaStart);
  const segmentedForcedColorsStart = styles.lastIndexOf(
    "@media (forced-colors: active)",
    touchMediaStart,
  );
  assert.ok(segmentedForcedColorsStart >= 0);

  assert.match(
    styles,
    /:root\s*\{[\s\S]*?--product-element-radius: 0\.75rem;[\s\S]*?--product-card-radius: 1\.25rem;[\s\S]*?--product-row-height: 2\.5rem;[\s\S]*?--product-control-height: 2\.5rem;[\s\S]*?--product-control-radius: var\(--product-element-radius\);[\s\S]*?--product-control-padding-inline: 0\.75rem;[\s\S]*?--product-control-font-size: 0\.88rem;[\s\S]*?--product-control-font-weight: 400;[\s\S]*?--product-control-line-height: 1\.2;[\s\S]*?--product-control-foreground: #141414;[\s\S]*?--product-control-icon-size: 1rem;[\s\S]*?--product-table-radius: var\(--product-element-radius\);/,
  );
  assert.doesNotMatch(styles, /--product-([a-z-]+):\s*var\(--product-\1\)/);
  assert.doesNotMatch(
    styles,
    /--product-(?:touch-control-font-size|control-icon-stroke-width)/,
  );
  assert.match(
    styles,
    /:root\s*\{[\s\S]*?--product-segmented-control-height: var\(--product-control-height\);[\s\S]*?--product-segmented-control-radius: var\(--product-control-radius\);[\s\S]*?--product-segmented-control-option-size: calc\(\s*var\(--product-segmented-control-height\) -\s*var\(--product-surface-border-width\) - var\(--product-surface-border-width\)\s*\);[\s\S]*?--product-segmented-control-option-radius: calc\(\s*var\(--product-segmented-control-radius\) -\s*var\(--product-surface-border-width\)\s*\);[\s\S]*?--product-segmented-control-gap: calc\(\s*var\(--product-surface-border-width\) \+ var\(--product-surface-border-width\)\s*\);/,
  );
  assert.match(
    styles,
    /:root\s*\{[\s\S]*?--product-segmented-control-surface-shadow:\s*var\(\s*--product-raised-control-shadow\s*\);[\s\S]*?--product-segmented-control-surface-shadow-pressed:\s*var\(\s*--product-raised-control-shadow-pressed\s*\);/,
  );
  assert.doesNotMatch(styles, /--product-segmented-control-surface-boundary/);
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-raised-control-shadow:\s*0 1px 6px 0px oklch\(0% 0 0 \/ 0\.05\);[^}]*--product-raised-control-shadow-hover:\s*0 4px 10px -2px\s+oklch\(0% 0 0 \/ 0\.16\);[^}]*--product-raised-control-shadow-pressed:\s*0 1px 3px 0px\s+oklch\(0% 0 0 \/ 0\.14\);[^}]*--product-surface-background: #fff;[^}]*--product-surface-border-width: 1px;[^}]*--product-surface-border-color: oklch\(0 0 0 \/ 0\.1\);[^}]*--product-surface-border: var\(--product-surface-border-width\) solid\s+var\(--product-surface-border-color\);[^}]*--product-raised-control-hover-translate-y: -1px;[^}]*--product-raised-control-transition: 160ms\s+cubic-bezier\(0\.2, 0\.8, 0\.2, 1\);/,
  );
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-selection-motion-duration: 360ms;[^}]*--product-selection-motion-easing: cubic-bezier\(0\.22, 1, 0\.36, 1\);[^}]*--product-selection-motion-fade-duration: 120ms;/,
  );
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-raised-surface-shadow: var\(--product-raised-control-shadow\);[^}]*--product-entry-control-shadow: var\(--product-raised-surface-shadow\);[^}]*--product-control-focus-halo: rgba\(20, 20, 20, 0\.58\);/,
  );
  assert.match(
    styles,
    /\.product-btn\s*\{[^}]*height: var\(--product-control-height\);[^}]*border: var\(--product-surface-border\);[^}]*background: #fff;[^}]*background-clip: padding-box;[^}]*color: #171717;[^}]*box-shadow: var\(--product-raised-control-shadow\);[^}]*transform: none;[^}]*transition:\s*transform var\(--product-raised-control-transition\),\s*border-color var\(--product-raised-control-transition\),\s*box-shadow var\(--product-raised-control-transition\),\s*background-color var\(--product-raised-control-transition\);/,
  );
  assert.match(
    styles,
    /\.app-page-shell \.product-btn\s*\{[^}]*border-radius: var\(--product-control-radius\);[^}]*background-color: #fff;[^}]*font-size: var\(--product-control-font-size\);[^}]*font-weight: var\(--product-control-font-weight\);/,
  );
  const courseProductStyles =
    /\.app-page-shell \.product-btn\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";
  assert.doesNotMatch(
    courseProductStyles,
    /border:|box-shadow|transform|transition|background:/,
  );
  assert.match(
    styles,
    /\.app-page-shell\s+:is\([\s\S]*?\.product-btn,[\s\S]*?\.teaching-date-navigator,[\s\S]*?\.teaching-hub-search,[\s\S]*?\.product-search-wrap,[\s\S]*?\.workspace-tab,[\s\S]*?\.fade-chevron-control[\s\S]*?\)\s+svg\.lucide\s*\{[^}]*width: var\(--product-control-icon-size\);[^}]*height: var\(--product-control-icon-size\);[^}]*flex: 0 0 var\(--product-control-icon-size\);[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-option svg\.lucide\s*\{[^}]*width: var\(--product-control-icon-size\);[^}]*height: var\(--product-control-icon-size\);[^}]*flex: 0 0 var\(--product-control-icon-size\);[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.doesNotMatch(styles, /vector-effect:\s*non-scaling-stroke/);
  assert.match(
    styles,
    /\.app-page-shell \.product-search-icon\s*\{[^}]*color: var\(--product-control-foreground\);[^}]*opacity: 1;/,
  );
  assert.doesNotMatch(
    styles,
    /\.app-page-shell \.compact-toolbar-rail \[role="group"\] button\s*\{[^}]*color:/,
  );
  assert.match(
    styles,
    /\.product-btn:hover:not\(:disabled\):not\(\[aria-disabled="true"\]\)\s*\{[^}]*background-color: #fff;[^}]*box-shadow: var\(--product-raised-control-shadow-hover\);/,
  );
  assert.match(
    styles,
    /\.product-btn:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)\s*\{[^}]*background-color: #fff;[^}]*box-shadow: var\(--product-raised-control-shadow-pressed\);[^}]*transform: none;/,
  );
  assert.doesNotMatch(
    styles,
    /\.app-page-shell \.product-btn(?::hover|:active)/,
  );
  assert.match(
    styles,
    /\.app-page-shell \.product-btn-primary\s*\{[^}]*background-color: #fff;[^}]*color: var\(--product-control-foreground\);/,
  );
  assert.match(
    styles,
    /\.app-page-shell \.product-btn-secondary\s*\{[^}]*background-color: #fff;[^}]*color: var\(--product-control-foreground\);/,
  );
  assert.match(
    styles,
    /\.app-page-shell \.product-btn-ghost\s*\{[^}]*background-color: #fff;[^}]*color: var\(--product-control-foreground\);/,
  );
  assert.doesNotMatch(
    styles,
    /\.product-btn(?::hover|:active|-primary|-secondary|-ghost)[^{]*\{[^}]*border:\s*0;/,
  );
  assert.match(
    styles,
    /\.product-btn\.compact-toolbar-reset\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background: #fff;[^}]*background-clip: padding-box;/,
  );
  assert.match(
    productFocusStyles,
    /outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: 2px;/,
  );
  assert.doesNotMatch(productFocusStyles, /box-shadow/);
  assert.match(
    styles,
    /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.product-btn:hover:not\(:disabled\):not\(\[aria-disabled="true"\]\)\s*\{[^}]*transform: translateY\(var\(--product-raised-control-hover-translate-y\)\);[^}]*\}[\s\S]*?\.product-btn:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)\s*\{[^}]*transform: none;/,
  );
  assert.doesNotMatch(styles, /\.course-filter-(?:trigger|popover|actions)/);
  assert.match(reducedMotionStyles, /\.product-btn\.product-btn,/);
  assert.match(reducedMotionStyles, /transition: none;/);
  assert.match(reducedMotionStyles, /transform: none;/);
  assert.match(
    reducedMotionStyles,
    /\.product-segmented-control-option\s*\{[^}]*transition: none;/,
  );
  assert.match(
    reducedMotionStyles,
    /\.product-segmented-control-indicator,\s*\.product-segmented-control-indicator\[data-motion-ready="true"\]\s*\{[^}]*transition: none;/,
  );

  assert.match(
    styles,
    /\.product-btn\.component-card-action,[\s\S]*?\.product-btn\.component-card-visibility-action\s*\{[^}]*border: 0;[^}]*background: transparent;[^}]*box-shadow: none;/,
  );
  assert.match(
    styles,
    /\.action-menu-root\[data-trigger-size="compact"\][\s\S]*?> \.product-btn\.action-menu-trigger:hover:not\(:disabled\),[\s\S]*?> \.product-btn\.action-menu-trigger:active:not\(:disabled\)\s*\{[^}]*background: rgba\(20, 20, 20, 0\.07\);[^}]*box-shadow: none;[^}]*transform: none;/,
  );
  assert.doesNotMatch(
    teachingStyles,
    /teaching-run-action-menu|student-directory-action-menu/,
  );

  assert.match(
    styles,
    /\.product-segmented-control\s*\{[^}]*--segmented-option-width: auto;[^}]*position: relative;[^}]*display: inline-flex;[^}]*height: var\(--product-segmented-control-height\);[^}]*gap: var\(--product-segmented-control-gap\);[^}]*isolation: isolate;[^}]*overflow: visible;[^}]*border: var\(--product-surface-border\);[^}]*border-radius: var\(--product-segmented-control-radius\);[^}]*background: var\(--product-segmented-control-background\);[^}]*background-clip: padding-box;[^}]*padding: 0;[^}]*box-shadow: none;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-indicator\s*\{[^}]*position: absolute;[^}]*z-index: 0;[^}]*height: var\(--product-segmented-control-option-size\);[^}]*border-radius: var\(--product-segmented-control-option-radius\);[^}]*background-color: var\(--product-surface-background\);[^}]*background-image: none;[^}]*box-shadow: var\(--product-segmented-control-surface-shadow\);[^}]*pointer-events: none;[^}]*backdrop-filter: none;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-option\s*\{[^}]*position: relative;[^}]*z-index: 1;[^}]*display: inline-flex;[^}]*width: var\(--segmented-option-width\);[^}]*height: var\(--product-segmented-control-option-size\);[^}]*min-width: var\(--segmented-option-min-width\);[^}]*flex: var\(--segmented-option-flex\);[^}]*isolation: isolate;[^}]*border: 0;[^}]*border-radius: var\(--product-segmented-control-option-radius\);[^}]*background: transparent;[^}]*padding-inline: var\(--segmented-option-padding-inline\);/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-variant="icon"\]\s*\{[^}]*--segmented-option-width: var\(--product-segmented-control-option-size\);[^}]*--segmented-option-flex: 0 0 var\(--product-segmented-control-option-size\);[^}]*--segmented-option-padding-inline: 0;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-option\[aria-pressed="true"\]\s*\{[^}]*background: var\(--segmented-selected-background\);[^}]*background-clip: var\(--segmented-selected-background-clip\);[^}]*box-shadow: var\(--segmented-selected-shadow\);/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-indicator-ready="true"\]\s*\{[^}]*--segmented-selected-background: transparent;[^}]*--segmented-selected-background-clip: border-box;[^}]*--segmented-selected-shadow: none;/,
  );
  assert.match(
    styles,
    /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.product-segmented-control-option:hover:not\(:disabled\)\[aria-pressed="false"\]\s*\{[^}]*color: var\(--color-neutral-950, #0a0a0a\);/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-option:focus-visible\s*\{[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: -2px;/,
  );
  const segmentedSourceOrder = [
    styles.indexOf(".product-segmented-control {"),
    styles.indexOf(".product-segmented-control-indicator {"),
    styles.indexOf(".product-segmented-control-option {"),
    styles.indexOf("@media (hover: hover) and (pointer: fine)"),
    styles.indexOf(".product-segmented-control-option:focus-visible"),
    styles.indexOf('.product-segmented-control-option[aria-pressed="true"] {'),
    styles.indexOf('.product-segmented-control[data-indicator-ready="true"]'),
    styles.indexOf("@media (prefers-reduced-motion: reduce)"),
    segmentedForcedColorsStart,
    touchMediaStart,
  ];
  assert.ok(segmentedSourceOrder.every((index) => index >= 0));
  assert.match(
    segmentedControl,
    /classNames\("product-segmented-control", className\)/,
  );
  assert.equal(
    segmentedControl.match(/className="product-segmented-control-indicator"/g)
      ?.length,
    1,
  );
  assert.ok(
    segmentedControl.indexOf(
      'className="product-segmented-control-indicator"',
    ) < segmentedControl.indexOf("{items.map"),
  );
  assert.match(
    segmentedControl,
    /ref=\{groupRef\}[\s\S]*?data-indicator-ready=\{indicatorVisible \|\| undefined\}[\s\S]*?className="product-segmented-control-indicator"\s+aria-hidden="true"/,
  );
  assert.match(segmentedControl, /"product-segmented-control-option"/);
  assert.match(
    segmentedControl,
    /data-variant=\{iconOnly \? "icon" : "text"\}/,
  );
  assert.doesNotMatch(
    segmentedControl,
    /product-segmented-control-(?:icon-only|text|option-icon-only|option-selected)/,
  );
  assert.doesNotMatch(
    segmentedControl,
    /\bh-10\b|\bh-8\b|\bw-8\b|\bgap-1\b|\bp-1\b|\brounded-(?:xl|lg)\b|\bh-4\b|\bw-4\b|bg-neutral-950\/\[0\.05\]|shadow-\[inset|shadow-\[0_1px_3px|focus-visible:ring|focus-visible:outline-none|product-raised-control-shadow-hover|product-raised-control-shadow-pressed/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-indicator-ready="true"\]:has\([\s\S]*?\.product-segmented-control-option\[aria-pressed="true"\][\s\S]*?\)\s*\.product-segmented-control-indicator\s*\{[^}]*box-shadow: var\(--product-segmented-control-surface-shadow-pressed\);/,
  );
  assert.doesNotMatch(
    styles,
    /\.product-segmented-control(?:::before|[^\s,{]*::before)/,
  );
  assert.doesNotMatch(
    /@media \(max-width: 767px\), \(hover: none\) and \(pointer: coarse\)[\s\S]*?@media \(max-width: 767px\)/.exec(
      styles,
    )?.[0] ?? "",
    /transform: scale\(/,
  );
  assert.doesNotMatch(
    touchStyles,
    /--product-touch-control-font-size|--product-control-icon-size|vector-effect:\s*non-scaling-stroke/,
  );
  assert.match(
    touchStyles,
    /\.workspace-tab\s*\{[^}]*touch-action: manipulation;/,
  );
  assert.match(
    touchStyles,
    /\.app-page-shell \.product-segmented-control-option\s*\{[^}]*touch-action: manipulation;/,
  );
  assert.doesNotMatch(
    touchStyles,
    /\.app-page-shell \.product-segmented-control-option\s*\{[^}]*(?:height|min-height|width|min-width|gap|border|border-radius|background|padding|color|font-size|box-shadow|transform):/,
  );
  assert.match(
    touchStyles,
    /\.app-page-shell \.product-segmented-control\[data-variant="text"\]\s*\{[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*flex-shrink: 1;[^}]*--segmented-option-min-width: 0;[^}]*--segmented-option-flex: 1 1 0;/,
  );
  assert.match(
    touchStyles,
    /\.product-segmented-control\[data-variant="text"\][\s\S]*?> \.product-segmented-control-option\s*> \.product-segmented-control-option-label\s*\{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/,
  );
  assert.match(
    learningProfile,
    /variant="secondary"\s+className="product-btn-danger mt-4"[\s\S]*?>\s*Проверить, что будет удалено/,
  );
  assert.doesNotMatch(learningProfile, /bg-rose-700 text-white/);
  assert.match(
    scheduleWorkspace,
    /<SegmentedControl[\s\S]*?className="teaching-schedule-view-toggle"[\s\S]*?ariaLabel="Вид занятий"[\s\S]*?value=\{viewMode\}[\s\S]*?onChange=\{setViewMode\}[\s\S]*?iconOnly/,
  );
  assert.doesNotMatch(
    teachingStyles,
    /\.teaching-schedule-view-toggle button|button\.is-active/,
  );
  assert.doesNotMatch(
    scheduleWorkspace,
    /className=\{viewMode === "(?:table|cards)" \? "is-active"/,
  );

  assert.match(forcedColorsStyles, /\.product-btn\.product-btn,/);
  assert.match(forcedColorsStyles, /\.product-btn\.product-btn:hover:not/);
  assert.match(forcedColorsStyles, /\.product-btn\.product-btn:active:not/);
  assert.match(
    forcedColorsStyles,
    /\.product-btn\.product-btn:focus-visible:not/,
  );
  assert.match(
    forcedColorsStyles,
    /border: 1px solid ButtonText;[^}]*background: ButtonFace;[^}]*color: ButtonText;[^}]*box-shadow: none;[^}]*transform: none;/,
  );
  assert.match(
    forcedColorsStyles,
    /\.product-segmented-control\s*\{[^}]*background: ButtonFace !important;[^}]*border: var\(--product-surface-border-width\) solid CanvasText;[^}]*outline: 0;[^}]*box-shadow: none;[^}]*forced-color-adjust: none;/,
  );
  assert.match(
    forcedColorsStyles,
    /\.product-segmented-control-option\s*\{[^}]*color: ButtonText !important;/,
  );
  assert.match(
    forcedColorsStyles,
    /\.product-segmented-control-indicator\s*\{[^}]*display: none !important;/,
  );
  assert.match(
    forcedColorsStyles,
    /\.product-segmented-control-option\[aria-pressed="true"\]\s*\{[^}]*border: 1px solid Highlight !important;[^}]*background: Highlight !important;[^}]*color: HighlightText !important;[^}]*box-shadow: none !important;[^}]*forced-color-adjust: none;/,
  );
  assert.match(
    forcedColorsStyles,
    /\.product-segmented-control-option:focus-visible\s*\{[^}]*outline: 2px solid Highlight !important;[^}]*outline-offset: -2px;[^}]*box-shadow: none !important;[^}]*\}[\s\S]*?\.product-segmented-control-option\[aria-pressed="true"\]:focus-visible\s*\{[^}]*outline-color: HighlightText !important;/,
  );
  assert.match(
    styles,
    /\.action-menu-item\s*\{[^}]*min-height: var\([^}]*--product-row-height[^}]*align-items: center;[^}]*gap: 0\.5rem;[^}]*border: 0;[^}]*padding: 0 var\(--product-control-padding-inline, 0\.75rem\);[^}]*font-size: var\(--product-control-font-size, 0\.88rem\);[^}]*font-weight: var\(--product-control-font-weight, 400\);/,
  );

  const lessonAuthoring = source(lessonAuthoringPath);
  assert.match(lessonAuthoring, /<AppPageHeaderActions/);
  assert.match(lessonAuthoring, /primary=\{/);
  assert.match(lessonAuthoring, /overflowItems=\{/);
  assert.match(
    lessonAuthoring,
    /id: "delete"[\s\S]*?label: "Удалить"[\s\S]*?icon: Trash2[\s\S]*?destructive: true/,
  );

  assert.match(
    navigationStyles,
    /\.site-header-shell-app \.site-header-nav-pill,[\s\S]*?\.site-header-shell-app \.header-action-btn\s*\{[^}]*height: 2\.5rem;[^}]*font-size: var\(--product-control-font-size, 0\.88rem\);[^}]*font-weight: var\(--product-control-font-weight, 400\);/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-app \.nav-user-trigger\s*\{[^}]*width: 2\.5rem;[^}]*height: 2\.5rem;[^}]*padding: 0;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-app \.nav-user-trigger-avatar\s*\{[^}]*width: 2\.5rem;[^}]*height: 2\.5rem;[^}]*border-radius: var\(--product-control-radius, 0\.75rem\);/,
  );
  assert.doesNotMatch(navigationStyles, /nav-user-trigger-name/);
  assert.match(
    navigationStyles,
    /\.site-header-shell-app \.nav-pill-active\s*\{[^}]*box-shadow: none;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-app \.nav-pill-icon,[\s\S]*?\.site-header-shell-app \.nav-user-trigger > span > svg\s*\{[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-app \.nav-pill-active \.nav-pill-icon\s*\{[^}]*opacity: 1;/,
  );
  assert.match(
    navigationStyles,
    /\.site-header-shell-app \.nav-dropdown-item\s*\{[^}]*border: 0;[^}]*font-weight: var\(--product-control-font-weight, 400\);/,
  );

  assert.match(
    teachingStyles,
    /\.teaching-date-trigger\s*\{[^}]*font-size: var\(--product-control-font-size\);[^}]*font-weight: var\(--product-control-font-weight\);[^}]*line-height: var\(--product-control-line-height\);/,
  );
});

test("component picker is registry-driven and grouped into Russian categories", () => {
  const authoring = source(lessonAuthoringPath);
  const presentations = source(componentPickerPreviewPath);
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
  const categoryStyles = /\.component-picker-categories\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const categoryButtonStyles = /\.component-picker-category\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const cardStyles = /\.component-picker-card\s*\{[^}]*\}/.exec(styles)?.[0];
  const enabledCardStyles =
    /\.component-picker-card:not\(:disabled\)\s*\{[^}]*\}/.exec(styles)?.[0];
  const closeStyles =
    /\.component-picker-dialog \.dialog-shell-close,\s*\.component-picker-dialog \.dialog-shell-close:hover\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const presentationMapStart = presentations.indexOf(
    "export const componentPickerPresentations = {",
  );
  const presentationMapEnd = presentations.indexOf(
    "} satisfies Record<CreatableComponentTypeKey, ComponentPickerPresentation>;",
    presentationMapStart,
  );
  const addStart = picker.indexOf("async function add(");
  const addEnd = picker.indexOf("function returnToCatalog", addStart);
  const addFlow = picker.slice(addStart, addEnd);
  const typeCardStart = picker.lastIndexOf(
    "<button",
    picker.indexOf("data-component-type-key={definition.key}"),
  );
  const typeCardEnd = picker.indexOf("</button>", typeCardStart);
  const typeCard = picker.slice(typeCardStart, typeCardEnd);

  assert.ok(
    presentationMapStart >= 0 && presentationMapEnd > presentationMapStart,
    "component picker presentations must remain a discoverable exhaustive map",
  );
  const presentationMap = presentations.slice(
    presentationMapStart,
    presentationMapEnd,
  );
  const presentationEntries = Array.from(
    presentationMap.matchAll(
      /^  ([a-z_]+): \{\n\s{4}description: "([^"]+)",\n\s{4}preview: \(/gm,
    ),
    (match) => ({ key: match[1], description: match[2] }),
  );
  assert.deepEqual(
    presentationEntries.map(({ key }) => key),
    creatableComponentTypeKeys,
  );
  assert.ok(
    presentationEntries.every(
      ({ description }) => description.trim().length > 0,
    ),
    "every component picker presentation must explain its purpose",
  );
  assert.match(presentations, /data-component-preview=\{typeKey\}/);
  assert.match(authoring, /componentPickerPresentations/);
  assert.match(
    authoring,
    /<ComponentPickerPreview typeKey=\{definition\.key\} \/>/,
  );
  assert.match(
    picker,
    /className="component-picker-card-description"[\s\S]*?componentPickerPresentations\[definition\.key\]\.description/,
  );

  assert.match(authoring, /creatableComponentDefinitions\.filter/);
  assert.doesNotMatch(presentations, /^  heading:/m);
  assert.ok(pickerStart >= 0 && pickerEnd > pickerStart);
  for (const category of [
    "Текст",
    "Медиа",
    "Игры и активности",
    "Ссылки",
    "Файлы",
  ]) {
    assert.match(authoring, new RegExp(category));
  }
  assert.match(
    authoring,
    /category === "link"[\s\S]*?definition\.key === "external_link"[\s\S]*?category === "file"[\s\S]*?definition\.key === "file"/,
  );
  assert.doesNotMatch(authoring, /Разделители и структура плана/);
  assert.match(
    picker,
    /const \[selectedTypeKey, setSelectedTypeKey\] =\s*useState<CreatableComponentTypeKey \| null>\(null\)/,
  );
  assert.match(
    picker,
    /useMemo<Pick<[\s\S]*?LessonComponent,[\s\S]*?"typeKey"[\s\S]*?"payload"[\s\S]*?"placement"[\s\S]*?"primaryLearningObjectiveId"[\s\S]*?"activityRole"[\s\S]*?> \| null>/,
  );
  assert.match(picker, /typeKey: selectedTypeKey/);
  assert.match(
    picker,
    /payload: structuredClone\(selectedDefinition\.defaultPayload\)/,
  );
  assert.match(
    picker,
    /placement: structuredClone\(selectedDefinition\.defaultPlacement\)/,
  );
  assert.match(picker, /primaryLearningObjectiveId: null/);
  assert.match(picker, /activityRole: null/);
  assert.doesNotMatch(
    picker.slice(
      picker.indexOf("const draftComponent"),
      picker.indexOf("useEffect", picker.indexOf("const draftComponent")),
    ),
    /\bid:|\bposition:|\bvisibility:|\bcreatedAt:|\bupdatedAt:/,
    "a local draft must not impersonate a persisted LessonComponent",
  );
  assert.match(
    picker,
    /selectedDefinition && draftComponent \? \([\s\S]*?<ComponentPayloadEditor[\s\S]*?component=\{draftComponent\}[\s\S]*?onCancel=\{returnToCatalog\}[\s\S]*?onSave=\{add\}/,
  );
  assert.match(
    picker,
    /selectedDefinition[\s\S]*?`Новый компонент · \$\{selectedDefinition\.title\}`[\s\S]*?: "Компоненты"/,
  );
  assert.ok(
    typeCardStart >= 0 && typeCardEnd > typeCardStart,
    "component type selection must remain a bounded picker-card action",
  );
  assert.match(
    typeCard,
    /onClick=\{\(\) => \{[\s\S]*?setSelectedTypeKey\(definition\.key\);[\s\S]*?\}\}/,
  );
  assert.doesNotMatch(
    typeCard,
    /runMutation|courseBuilderJsonRequest|"POST"|onClose/,
    "choosing a type must only open a local draft editor",
  );
  assert.ok(addStart >= 0 && addEnd > addStart, "draft save flow must exist");
  assert.equal(
    picker.match(/\/api\/v2\/lessons\/\$\{lessonId\}\/components/g)?.length,
    1,
    "the picker must expose exactly one persisted create path",
  );
  assert.match(
    addFlow,
    /courseBuilderJsonRequest<[\s\S]*?`\/api\/v2\/lessons\/\$\{lessonId\}\/components`[\s\S]*?"POST"[\s\S]*?\{ typeKey: selectedTypeKey, \.\.\.input \}/,
  );
  assert.match(addFlow, /setSaveAttempted\(true\)/);
  assert.match(addFlow, /committed = true/);
  assert.match(addFlow, /if \(saved \|\| committed\) onClose\(\)/);
  assert.doesNotMatch(picker, /onCreated|createdComponentId/);
  assert.match(picker, /component-picker-dialog \$\{/);
  assert.match(
    picker,
    /panelClassName="component-picker-dialog-panel max-w-4xl"/,
  );
  assert.match(picker, /bodyClassName="component-picker-dialog-body"/);
  assert.match(picker, /className="component-picker-categories"/);
  assert.match(picker, /className={`component-picker-category/);
  assert.match(picker, /className="component-picker-card"/);
  assert.doesNotMatch(picker, /border-b border-neutral-200/);
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
  assert.match(listStyles, /display: grid/);
  assert.match(listStyles, /grid-auto-rows: auto/);
  assert.match(listStyles, /align-content: start/);
  assert.match(listStyles, /align-items: start/);
  assert.match(listStyles, /overflow-y: auto/);
  assert.match(listStyles, /scrollbar-gutter: stable/);
  assert.ok(categoryStyles, "component picker category rail must be styled");
  assert.match(categoryStyles, /border: 0/);
  assert.ok(
    categoryButtonStyles,
    "component picker category buttons must be styled",
  );
  assert.match(categoryButtonStyles, /cursor: pointer/);
  assert.ok(cardStyles, "component picker cards must be styled");
  assert.match(cardStyles, /align-self: start/);
  assert.ok(enabledCardStyles, "enabled picker card styles must be explicit");
  assert.match(enabledCardStyles, /cursor: pointer/);
  assert.ok(closeStyles, "component picker close styles must remain present");
  assert.match(closeStyles, /height: 2\.5rem/);
  assert.match(closeStyles, /width: 2\.5rem/);
  assert.match(closeStyles, /border: 0/);
  assert.match(closeStyles, /background: transparent/);
});

test("component editor creates, selects, archives, and reloads Course objectives", () => {
  const editor = source(componentEditorPath);
  const authoring = source(lessonAuthoringPath);
  const workspace = source(workspacePath);

  assert.match(editor, /aria-label="Учебная цель компонента"/);
  assert.match(editor, /Чему помогает научиться/);
  assert.match(editor, /Выберите одно проверяемое умение/);
  assert.match(editor, /<option value="">Без цели<\/option>/);
  assert.match(editor, /objective\.archivedAt === null/);
  assert.match(editor, /objective\.id === primaryLearningObjectiveId/);
  assert.match(editor, /Создать и выбрать/);
  assert.match(editor, />\s*В архив\s*</);
  assert.match(editor, /definition\.activityFacet\.supportedRoles\.map/);
  assert.match(editor, /primaryLearningObjectiveId,[\s\S]*?activityRole,/);

  assert.match(
    authoring,
    /`\/api\/v2\/courses\/\$\{courseId\}\/learning-objectives`[\s\S]*?"POST"/,
  );
  assert.match(
    authoring,
    /`\/api\/v2\/courses\/\$\{courseId\}\/learning-objectives\/\$\{objectiveId\}`,[\s\S]*?"DELETE"/,
  );
  assert.match(authoring, /learningObjectives=\{course\.learningObjectives\}/);
  assert.match(
    workspace,
    /const reload = useCallback[\s\S]*?setCourse\(workspace\)[\s\S]*?await action\(\);[\s\S]*?await reload\(\)/,
  );
});

test("component payload editor covers every active registry type without divider", () => {
  const editor = source(componentEditorPath);
  const payloadSwitchStart = editor.indexOf("switch (typeKey)");
  const placementStart = editor.indexOf("function PlacementFields");
  assert.ok(payloadSwitchStart >= 0 && placementStart > payloadSwitchStart);

  const payloadSwitch = editor.slice(payloadSwitchStart, placementStart);
  const richTextStart = payloadSwitch.indexOf('case "rich_text":');
  const calloutStart = payloadSwitch.indexOf('case "callout":', richTextStart);
  const richTextEditor = payloadSwitch.slice(richTextStart, calloutStart);
  const editorKeys = Array.from(
    payloadSwitch.matchAll(/^\s{4}case "([a-z_]+)":/gm),
    (match) => match[1],
  );
  assert.deepEqual(editorKeys, componentTypeKeys);
  assert.doesNotMatch(editor, /case "divider"|typeKey === "divider"/);
  assert.match(
    payloadSwitch,
    /case "rich_text":[\s\S]*?<Field label="Заголовок">[\s\S]*?<input[\s\S]*?delete next\.title[\s\S]*?<Field label="Текст">[\s\S]*?<textarea[\s\S]*?delete next\.content/,
  );
  assert.doesNotMatch(
    richTextEditor,
    /Заголовок \(необязательно\)|Текст \(необязательно\)/,
  );
  assert.match(editor, /HTTPS-ссылка на видео/);
  assert.match(editor, /Допустимые варианты разделяйте \|/);
  assert.match(editor, /элемент = точное название категории/);
});

test("component editor keeps canonical scoped typography and compact control geometry", () => {
  const editor = source(componentEditorPath);
  const styles = source("src/app/globals.css");
  const editorStyles = /\.component-payload-editor\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const labelStyles =
    /\.component-payload-editor \.field-label\s*\{[^}]*\}/.exec(styles)?.[0];
  const inputStyles =
    /\.component-payload-editor \.field-input\s*\{[^}]*\}/.exec(styles)?.[0];
  const textareaStyles =
    /\.component-payload-editor \.component-editor-textarea\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];

  assert.match(editor, /className="component-payload-editor"/);
  assert.match(editor, /className="component-editor-field"/);
  assert.match(editor, /component-editor-select/);
  assert.match(editor, /component-editor-textarea/);
  assert.ok(editorStyles, "component editor styles must remain scoped");
  assert.match(editorStyles, /gap: 1rem/);
  assert.match(
    editorStyles,
    /font-size: var\(--product-control-font-size, 0\.88rem\)/,
  );
  assert.match(
    editorStyles,
    /font-weight: var\(--product-control-font-weight, 400\)/,
  );
  assert.ok(labelStyles, "component editor label styles must remain scoped");
  assert.match(
    labelStyles,
    /font-size: var\(--product-control-font-size, 0\.88rem\)/,
  );
  assert.match(
    labelStyles,
    /font-weight: var\(--product-control-font-weight, 400\)/,
  );
  assert.ok(inputStyles, "component editor input styles must remain scoped");
  assert.match(
    inputStyles,
    /min-height: var\(--product-control-height, 2\.5rem\)/,
  );
  assert.match(inputStyles, /height: var\(--product-control-height, 2\.5rem\)/);
  assert.match(
    inputStyles,
    /font-size: var\(--product-control-font-size, 0\.88rem\)/,
  );
  assert.match(
    inputStyles,
    /font-weight: var\(--product-control-font-weight, 400\)/,
  );
  assert.ok(
    textareaStyles,
    "multiline component fields must override compact control height",
  );
  assert.match(textareaStyles, /height: auto/);
});

test("component cards render content with accessible overlay actions and modal editing", () => {
  const authoring = source(lessonAuthoringPath);
  const navigation = source(courseWorkspaceNavigationPath);
  const styles = source("src/app/globals.css");
  const cardStyles = /\.lesson-component-card\s*\{[^}]*\}/.exec(styles)?.[0];
  const cardHoverStyles = /\.lesson-component-card:hover\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const cardFocusStyles =
    /\.lesson-component-card:focus-within\s*\{[^}]*\}/.exec(styles)?.[0];
  const cardActionStyles = /\.lesson-component-card-actions\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const componentActionStyles =
    /\.product-btn\.component-card-action,[\s\S]*?\.product-btn\.component-card-visibility-action\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const componentActionFocusStyles =
    /\.lesson-component-card-actions[\s\S]*?\.product-btn\.component-card-action:focus-visible:not\(:disabled\),[\s\S]*?\.product-btn\.component-card-visibility-action:focus-visible:not\(:disabled\)\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const visibleActionStyles =
    /\.lesson-component-card:hover \.lesson-component-card-actions,[\s\S]*?\.lesson-component-card:focus-within \.lesson-component-card-actions\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const persistentActionRailStyles =
    /\.lesson-component-card-actions\.has-student-screen-component\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const persistentHiddenActionStyles =
    /\.lesson-component-card-actions\.has-student-screen-component\s*> \.component-card-action\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const persistentStudentScreenControlStyles =
    /\.lesson-component-card-actions\.has-student-screen-component\s*> \.component-card-student-screen-control\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const revealedPersistentActionStyles =
    /\.lesson-component-card:hover\s+\.lesson-component-card-actions\.has-student-screen-component\s*> \.component-card-action,[\s\S]*?\.lesson-component-card:focus-within\s+\.lesson-component-card-actions\.has-student-screen-component\s*> \.component-card-action\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const activeStudentScreenActionStyles =
    /\.lesson-component-card-actions \.component-card-visibility-action-active\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const cardContentStyles = /\.lesson-component-card-content\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];
  const modalEditorStyles =
    /\.component-editor-dialog \.component-payload-editor\s*\{[^}]*\}/.exec(
      styles,
    )?.[0];
  const editorDialogStart = authoring.indexOf("function ComponentEditorDialog");
  const componentCardStart = authoring.indexOf("function ComponentCard");
  const componentCardEnd = authoring.indexOf(
    "function ComponentPickerDialog",
    componentCardStart,
  );
  const editorDialog = authoring.slice(editorDialogStart, componentCardStart);
  const componentCard = authoring.slice(componentCardStart, componentCardEnd);
  const studentScreenControlStart = componentCard.indexOf(
    '<div className="component-card-student-screen-control">',
  );
  const studentScreenControlEnd = componentCard.indexOf(
    '<div className="lesson-component-card-content">',
    studentScreenControlStart,
  );
  const studentScreenControl = componentCard.slice(
    studentScreenControlStart,
    studentScreenControlEnd,
  );

  assert.ok(
    editorDialogStart >= 0 && componentCardStart > editorDialogStart,
    "persisted component editing must remain a separate dialog",
  );
  assert.match(
    componentCard,
    /<article[\s\S]*?className="lesson-component-card group"[\s\S]*?aria-labelledby=\{accessibleLabelId\}[\s\S]*?data-component-type-key=\{component\.typeKey\}/,
  );
  assert.match(
    componentCard,
    /<h3[\s\S]*?id=\{accessibleLabelId\}[\s\S]*?className="lesson-component-card-label sr-only"[\s\S]*?>[\s\S]*?\{displayPosition\}\. \{definition\.title\}[\s\S]*?<\/h3>/,
  );
  assert.doesNotMatch(
    componentCard,
    /lesson-component-card-header|lesson-component-card-title|lesson-component-card-position|<header/,
    "technical component meta must not render as a visible card header",
  );
  assert.match(
    componentCard,
    /className=\{`lesson-component-card-actions \$\{[\s\S]*?role="group"[\s\S]*?aria-label=\{`Управление компонентом \$\{displayPosition\} «\$\{definition\.title\}»`\}/,
  );
  assert.match(
    componentCard,
    /learnerVisible \? "has-student-screen-component" : ""/,
  );
  assert.match(
    componentCard,
    /<div className="lesson-component-card-content">[\s\S]*?<CourseComponentRenderer[\s\S]*?mode="teacher"/,
  );
  assert.doesNotMatch(
    componentCard,
    /<ComponentPayloadEditor/,
    "the card must keep rendering content while editing happens in a modal",
  );
  assert.match(
    componentCard,
    /aria-haspopup="dialog"[\s\S]*?aria-label=\{`Редактировать «\$\{definition\.title\}»`\}[\s\S]*?onClick=\{\(\) => setEditing\(true\)\}/,
  );
  assert.match(
    componentCard,
    /\{editing \? \([\s\S]*?<ComponentEditorDialog[\s\S]*?onClose=\{closeEditor\}/,
  );
  assert.match(
    componentCard,
    /function closeEditor\(\)[\s\S]*?setEditing\(false\)[\s\S]*?editTriggerRef\.current\?\.focus\(\)/,
  );
  assert.match(
    componentCard,
    /ref=\{editTriggerRef\}[\s\S]*?aria-haspopup="dialog"/,
  );
  assert.match(
    editorDialog,
    /<DialogShell[\s\S]*?title=\{`\$\{displayPosition\}\. \$\{definition\.title\}`\}[\s\S]*?description="Редактирование компонента: настройте содержимое и отображение\."/,
  );
  assert.match(
    editorDialog,
    /<ComponentPayloadEditor[\s\S]*?onSave=\{async \(input\) => \{/,
  );
  assert.match(
    editorDialog,
    /courseBuilderJsonRequest\([\s\S]*?`\/api\/v2\/components\/\$\{component\.id\}`,[\s\S]*?"PATCH",[\s\S]*?input,[\s\S]*?\)/,
  );
  assert.match(editorDialog, /committed = true/);
  assert.match(editorDialog, /if \(saved \|\| committed\) onClose\(\)/);
  assert.match(authoring, /Сохраняем компонент…/);
  assert.match(authoring, /Удаляем компонент…/);
  assert.match(authoring, /Меняем порядок компонентов…/);
  assert.match(authoring, /Обновляем экран ученика…/);
  assert.match(
    authoring,
    /\/api\/v2\/components\/\$\{component\.id\}\/student-screen/,
  );
  assert.match(
    componentCard,
    /getStudentScreenToggleInput\([\s\S]*?lessonComponents,[\s\S]*?component\.id,[\s\S]*?studentSlides/,
  );
  assert.match(
    componentCard,
    /async function toggleStudentScreen\([\s\S]*?studentScreenToggleInput[\s\S]*?courseBuilderJsonRequest\([\s\S]*?studentScreenToggleInput/,
  );
  assert.ok(
    studentScreenControlStart >= 0 &&
      studentScreenControlEnd > studentScreenControlStart,
    "the Student Screen toggle must remain an explicit component-card control",
  );
  assert.match(studentScreenControl, /aria-pressed=\{learnerVisible\}/);
  assert.match(
    studentScreenControl,
    /Убрать «\$\{definition\.title\}» с экрана ученика/,
  );
  assert.match(
    studentScreenControl,
    /Показать «\$\{definition\.title\}» на экране ученика/,
  );
  assert.match(
    studentScreenControl,
    /onClick=\{\(event\) =>[\s\S]*?toggleStudentScreen\(event\.detail > 0\)/,
  );
  assert.match(
    studentScreenControl,
    /<MonitorPlay className="h-4 w-4" aria-hidden="true" \/>/,
  );
  assert.doesNotMatch(studentScreenControl, /<Eye(?:Off)?\b/);
  assert.doesNotMatch(
    studentScreenControl,
    /aria-haspopup|aria-expanded|role="dialog"/,
  );
  assert.match(
    navigation,
    /value: "student", label: "Экран ученика", icon: MonitorPlay/,
    "the card toggle and Student Screen tab must use the same MonitorPlay icon",
  );
  assert.match(
    authoring,
    /learnerVisible[\s\S]*?component-card-visibility-action-active bg-sky-100 text-sky-800/,
  );
  assert.doesNotMatch(authoring, /border-sky-200/);
  assert.doesNotMatch(authoring, /На экране ученика|Только преподавателю/);
  assert.doesNotMatch(authoring, /border-b border-neutral-100 pb-3/);
  assert.ok(cardStyles, "lesson component card styles must remain present");
  assert.match(
    cardStyles,
    /border-radius: var\([\s\S]*?--product-element-radius/,
  );
  assert.doesNotMatch(cardStyles, /--product-card-radius/);
  assert.match(cardStyles, /padding: 0/);
  assert.match(cardStyles, /border: var\(--product-surface-border\)/);
  assert.match(cardStyles, /background: #fff/);
  assert.match(cardStyles, /background-clip: padding-box/);
  assert.match(
    cardStyles,
    /box-shadow: var\(--product-raised-surface-shadow\)/,
  );
  assert.doesNotMatch(cardStyles, /transition|transform/);
  assert.doesNotMatch(cardStyles, /border-color/);
  assert.equal(cardHoverStyles, undefined);
  assert.ok(cardFocusStyles, "keyboard focus must outline the component card");
  assert.match(
    cardFocusStyles,
    /outline: 2px solid rgba\(20, 20, 20, 0\.34\);[^}]*outline-offset: 2px;[^}]*box-shadow: var\(--product-raised-surface-shadow\);/,
  );
  assert.ok(
    cardActionStyles,
    "component action rail styles must remain present",
  );
  assert.match(cardActionStyles, /border: 0/);
  assert.match(cardActionStyles, /background: rgba\(255, 255, 255, 0\.5\)/);
  assert.match(cardActionStyles, /box-shadow: none/);
  assert.ok(
    componentActionStyles,
    "component action styles must remain present",
  );
  assert.match(
    componentActionStyles,
    /width: var\(--product-inner-control-size\);[^}]*height: var\(--product-inner-control-size\);[^}]*min-height: var\(--product-inner-control-size\);/,
  );
  assert.match(componentActionStyles, /border: 0/);
  assert.match(componentActionStyles, /background: transparent/);
  assert.match(componentActionStyles, /box-shadow: none/);
  assert.ok(
    componentActionFocusStyles,
    "component actions must keep a borderless keyboard focus indicator",
  );
  assert.match(componentActionFocusStyles, /border: 0/);
  assert.match(componentActionFocusStyles, /box-shadow: none/);
  assert.match(
    componentActionFocusStyles,
    /outline: 2px solid rgba\(20, 20, 20, 0\.55\)/,
  );
  assert.match(cardActionStyles, /position: absolute/);
  assert.match(cardActionStyles, /z-index: 10/);
  assert.match(
    cardActionStyles,
    /top: var\(--product-inner-control-inset, 0\.25rem\)/,
  );
  assert.match(
    cardActionStyles,
    /right: var\(--product-inner-control-inset, 0\.25rem\)/,
  );
  assert.match(cardActionStyles, /display: flex/);
  assert.match(cardActionStyles, /flex-wrap: nowrap/);
  assert.match(cardActionStyles, /opacity: 0/);
  assert.match(cardActionStyles, /pointer-events: none/);
  assert.match(cardActionStyles, /backdrop-filter: blur\(8px\)/);
  assert.ok(
    visibleActionStyles,
    "hover and focus must reveal the overlay action rail",
  );
  assert.match(visibleActionStyles, /opacity: 1/);
  assert.match(visibleActionStyles, /pointer-events: auto/);
  assert.ok(
    persistentActionRailStyles,
    "a learner-visible component must keep its Student Screen action rail mounted outside hover",
  );
  assert.match(persistentActionRailStyles, /background: transparent/);
  assert.match(persistentActionRailStyles, /opacity: 1/);
  assert.match(persistentActionRailStyles, /pointer-events: none/);
  assert.match(persistentActionRailStyles, /backdrop-filter: none/);
  assert.ok(
    persistentHiddenActionStyles,
    "non-Student-Screen actions must remain hidden outside hover",
  );
  assert.match(persistentHiddenActionStyles, /opacity: 0/);
  assert.match(persistentHiddenActionStyles, /pointer-events: none/);
  assert.ok(
    persistentStudentScreenControlStyles,
    "the active Student Screen control must remain interactive outside hover",
  );
  assert.match(persistentStudentScreenControlStyles, /pointer-events: auto/);
  assert.ok(
    revealedPersistentActionStyles,
    "hover and keyboard focus must restore the other actions",
  );
  assert.match(revealedPersistentActionStyles, /opacity: 1/);
  assert.match(revealedPersistentActionStyles, /pointer-events: auto/);
  assert.ok(
    activeStudentScreenActionStyles,
    "the persistent Student Screen action must retain its blue selected state",
  );
  assert.match(activeStudentScreenActionStyles, /background: #e0f2fe/);
  assert.ok(
    cardContentStyles,
    "component content spacing must remain explicit",
  );
  assert.match(cardContentStyles, /padding: 0\.75rem/);
  assert.doesNotMatch(cardContentStyles, /margin-top/);
  assert.ok(modalEditorStyles, "modal component editor reset must be scoped");
  assert.match(modalEditorStyles, /border-top: 0/);
  assert.match(modalEditorStyles, /padding-top: 0/);
});

test("lesson plan uses a transparent toolbar and filters authored components by title", () => {
  const authoring = source(lessonAuthoringPath);
  const styles = source("src/app/globals.css");
  const planStart = authoring.indexOf('{active && item.value === "plan" ? (');
  const studentStart = authoring.indexOf(
    '{active && item.value === "student" ? (',
  );
  const plan = authoring.slice(planStart, studentStart);
  const toolbarStyles = /\.lesson-plan-toolbar\s*\{[^}]*\}/.exec(styles)?.[0];
  const actionStyles = /\.lesson-plan-toolbar-actions\s*\{[^}]*\}/.exec(
    styles,
  )?.[0];

  assert.ok(planStart >= 0 && studentStart > planStart);
  assert.match(plan, /className="lesson-plan-workspace"/);
  assert.match(plan, /className="lesson-plan-toolbar"/);
  assert.doesNotMatch(plan, /workspace-surface/);
  assert.doesNotMatch(plan, /Структура урока|<h2>\s*План\s*<\/h2>/);
  assert.match(plan, /lesson\.components\.length > 0/);
  assert.match(plan, /type="search"/);
  assert.match(plan, /value=\{componentQuery\}/);
  assert.match(plan, /setComponentQuery\(event\.target\.value\)/);
  assert.match(plan, /placeholder="Найти компонент"/);
  assert.match(plan, />\s*Заполнить с ИИ\s*</);
  assert.match(plan, />\s*Компонент\s*</);
  assert.match(plan, /query=\{componentQuery\}/);

  assert.match(authoring, /query\.trim\(\)\.toLocaleLowerCase\("ru-RU"\)/);
  assert.match(
    authoring,
    /getComponentDefinition\(component\.typeKey\)[\s\S]*?\.title\.toLocaleLowerCase\("ru-RU"\)[\s\S]*?\.includes\(normalizedQuery\)/,
  );
  assert.match(authoring, /if \(!normalizedQuery\) return true/);
  assert.match(
    authoring,
    /components\.length > 0 && visibleComponents\.length === 0/,
  );
  assert.match(authoring, /Компоненты не найдены/);
  assert.match(authoring, /setComponentQuery\(""\)[\s\S]*?\[lesson\.id\]/);

  assert.ok(toolbarStyles, "lesson plan toolbar styles must remain present");
  assert.match(toolbarStyles, /border: 0/);
  assert.match(toolbarStyles, /background: transparent/);
  assert.match(toolbarStyles, /box-shadow: none/);
  assert.ok(actionStyles, "lesson plan action rail must remain present");
  assert.match(actionStyles, /justify-content: flex-end/);
  assert.match(actionStyles, /margin-left: auto/);
});

test("Student Screen surfaces render one ordered slide without legacy step groups", () => {
  const authoring = source(lessonAuthoringPath);
  const preview = source(
    "src/components/course-builder/student-screen-preview.tsx",
  );
  const combined = [authoring, preview].join("\n");
  const inlineSurface =
    /function StudentLessonSurface[\s\S]*?function LessonHistorySurface/.exec(
      authoring,
    )?.[0];

  assert.ok(inlineSurface, "inline Student Screen must remain discoverable");
  assert.match(authoring, /const components = lesson\.components/);
  assert.match(authoring, /\[\.\.\.lesson\.studentSlides\]/);
  assert.match(authoring, /lesson\.components[\s\S]*?\.filter/);
  assert.match(authoring, /component\.studentSlideId === slide\.id/);
  assert.match(
    inlineSurface,
    /projectLearnerComponentPayload\([\s\S]*?component\.typeKey,[\s\S]*?component\.payload/,
  );
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
