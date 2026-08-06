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

test("course navigation keeps settings persisted and materials course-wide", () => {
  const workspace = source(workspacePath);
  const materials = source(
    "src/components/course-builder/course-materials-panel.tsx",
  );

  assert.match(workspace, />\s*Настройки\s*</);
  assert.match(workspace, /title="Настройки курса"/);
  assert.match(workspace, /COURSE_WORKSPACE_TABS/);
  assert.match(workspace, /CourseMaterialsPanel course=\{course\}/);
  assert.match(materials, /course\.attachments\.map/);
  assert.match(materials, /прикреплены ко всему курсу/);
  assert.match(materials, /Урок не получает собственную копию файла/);
  assert.match(materials, /содержимое пока не анализировалось/);
  assert.match(
    workspace,
    /const saved = await runMutation\("Сохраняем настройки курса…"[\s\S]*?if \(saved\) onSaved\(\)/,
  );
});

test("course and lesson use the requested five-tab hierarchy", () => {
  const workspace = source(workspacePath);
  const authoring = source(lessonAuthoringPath);
  const tabs = source("src/components/ui/workspace-tabs.tsx");
  const navigation = source(
    "src/components/course-builder/course-workspace-navigation.ts",
  );

  for (const label of [
    "Уроки",
    "Описание",
    "Источники",
    "Материалы",
    "История",
  ]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }
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
});

test("lesson metadata moves into a transparent page header and remains editable", () => {
  const workspace = source(workspacePath);
  const authoring = source(lessonAuthoringPath);
  const styles = source("src/app/globals.css");

  assert.match(authoring, /<AppPageHeader/);
  assert.match(authoring, /backLabel=\{course\.title\}/);
  assert.match(authoring, /formatLessonWorkspaceTitle/);
  assert.match(authoring, /onBack=\{onBackToCourse\}/);
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
    /\.workspace-page-header\s*\{[\s\S]*?background: transparent;[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?box-shadow: none;/,
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

  assert.ok(courseShellStyles, "Course shell styles must remain discoverable");
  assert.match(courseShellStyles, /background: #f5f1e8;/);
  assert.doesNotMatch(courseShellStyles, /gradient/i);
  assert.doesNotMatch(routeSources, /landing-noise/);

  assert.match(
    styles,
    /\.course-demo-shell \.app-page-title\s*\{[\s\S]*?font-weight: 400;[\s\S]*?letter-spacing: -0\.045em;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.workspace-page-header\s*\{[\s\S]*?clamp\(2rem, 4\.3vw, 3\.55rem\)[\s\S]*?0\.96/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-btn\s*\{[\s\S]*?--course-demo-control-radius[\s\S]*?--course-demo-control-font-weight/,
  );
  assert.match(
    styles,
    /\.workspace-tab\s*\{[\s\S]*?--course-demo-control-height[\s\S]*?--course-demo-control-radius/,
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
