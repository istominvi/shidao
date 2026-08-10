import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const workspacePath = "src/components/course-builder/course-workspace.tsx";
const lessonAuthoringPath =
  "src/components/course-builder/lesson-authoring-workspace.tsx";

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
    /\.workspace-tabs\s*\{[^}]*--workspace-tabs-inline-offset: 12px;[^}]*padding-inline: var\(--workspace-tabs-inline-offset\);/,
  );
  assert.match(
    styles,
    /\.workspace-tabs::before\s*\{[^}]*right: var\(--workspace-tabs-inline-offset\);[^}]*left: var\(--workspace-tabs-inline-offset\);[^}]*height: 1px;[^}]*background: #141414;/,
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
    /\.site-header-shell-demo\s*\{[\s\S]*?height: 4\.25rem;[\s\S]*?border-radius: 1\.25rem;/,
  );
});

test("component picker is registry-driven and grouped into Russian categories", () => {
  const authoring = source(lessonAuthoringPath);

  assert.match(authoring, /componentDefinitions\.filter/);
  for (const category of [
    "Текст",
    "Изображения",
    "Игры и активности",
    "Оформление",
    "Файлы",
  ]) {
    assert.match(authoring, new RegExp(category));
  }
  assert.doesNotMatch(authoring, /visibility: "staff_only"/);
  assert.match(authoring, /сразу перейти к редактированию/);
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
