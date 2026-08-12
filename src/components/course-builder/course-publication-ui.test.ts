import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const pagePath = "src/app/(app)/courses/page.tsx";
const indexPath = "src/components/course-builder/courses-index.tsx";
const ownedPath = "src/components/course-builder/owned-courses-panel.tsx";
const catalogPath = "src/components/course-builder/course-catalog-panel.tsx";
const publishedCoursePath =
  "src/components/course-builder/published-course-workspace.tsx";
const publishedCoursePagePath =
  "src/app/(app)/courses/catalog/[publicationId]/page.tsx";
const actionsPath = "src/components/course-builder/course-actions.tsx";
const actionMenuPath = "src/components/ui/action-menu.tsx";
const courseRoutePath = "src/app/api/v2/courses/[courseId]/route.ts";
const courseServicePath = "src/modules/course-builder/service.ts";
const courseRepositoryPath = "src/modules/course-builder/repository.ts";
const courseServerContextPath = "src/modules/course-builder/server-context.ts";

test("courses index exposes list tabs and sends course details to a standalone route", () => {
  const page = source(pagePath);
  const index = source(indexPath);
  const publishedPage = source(publishedCoursePagePath);

  assert.match(page, />\s*Создать курс\s*</);
  assert.match(
    page,
    /description="Создавайте свои курсы с нуля или добавляйте готовые из каталога"/,
  );
  assert.doesNotMatch(
    page,
    /description="Создавайте свои курсы с нуля или добавляйте готовые из каталога\."/,
  );
  assert.match(page, /query\.tab === "catalog"/);
  assert.match(page, /typeof query\.course === "string"/);
  assert.match(page, /redirect\(/);
  assert.match(
    page,
    /\/courses\/catalog\/\$\{encodeURIComponent\(query\.course\)\}/,
  );
  assert.doesNotMatch(page, /initialCatalogCourseId/);
  assert.match(index, /value: "mine", label: "Мои"/);
  assert.match(index, /value: "catalog", label: "Каталог"/);
  assert.match(index, /ariaLabel="Разделы курсов"/);
  assert.match(index, /role="tabpanel"/);
  assert.match(index, /workspaceTabId/);
  assert.match(index, /workspaceTabPanelId/);
  assert.match(index, /\/courses\?tab=catalog/);
  assert.match(
    index,
    /router\.push\(\s*`\/courses\/catalog\/\$\{encodeURIComponent\(courseId\)\}\$\{query\}`/,
  );
  assert.doesNotMatch(index, /query\.set\("course", courseId\)/);
  assert.match(publishedPage, /<PublishedCourseWorkspace/);
});

test("catalog list opens a full read-only published-course workspace", () => {
  const catalog = source(catalogPath);
  const published = source(publishedCoursePath);

  assert.match(catalog, />\s*Каталог курсов\s*</);
  assert.doesNotMatch(catalog, />Готовые курсы</);
  assert.doesNotMatch(catalog, />Каталог<\/p>/);
  assert.doesNotMatch(catalog, /Добавьте курс себе и измените уроки/);
  assert.match(catalog, /new URLSearchParams\(\{ limit: "50" \}\)/);
  assert.match(catalog, /params\.set\("q", normalizedQuery\)/);
  assert.match(catalog, /params\.set\("subject", subject\)/);
  assert.match(catalog, /params\.set\("level", level\)/);
  assert.match(catalog, /params\.set\("cursor", cursor\)/);
  assert.match(
    catalog,
    /setTimeout\(\(\) => setDebouncedQuery\(query\), 300\)/,
  );
  assert.match(catalog, /Показать ещё/);
  assert.match(catalog, /onOpenCourse\(course\.id\)/);
  assert.doesNotMatch(catalog, /CatalogCourseDetailView/);
  assert.doesNotMatch(catalog, /selectedCourseId/);
  assert.match(
    published,
    /\/api\/v2\/course-catalog\/\$\{encodeURIComponent\(publicationId\)\}/,
  );
  assert.match(published, /value: "lessons", label: "Уроки"/);
  assert.match(published, /value: "about", label: "О курсе"/);
  assert.match(published, /value: "materials", label: "Материалы"/);
  assert.match(published, /value: "attestation", label: "Аттестация"/);
  assert.match(published, /course\.lessons\.map/);
  assert.match(published, /course\.materials\.map/);
  assert.match(published, /material\.originalFilename/);
  assert.match(published, /href=\{materialUrl\}/);
  assert.match(
    published,
    /aria-label=\{`Открыть материал «\$\{material\.originalFilename\}»`\}/,
  );
  assert.match(published, /target="_blank"/);
  assert.match(published, /rel="noreferrer"/);
  assert.match(published, />\s*Открыть мой курс\s*</);
  assert.match(published, /Добавить в мои курсы/);
  assert.match(published, /\/copy/);
  assert.match(published, /router\.push\(toCourseRoute\(payload\.courseId\)\)/);
  assert.match(published, /!educatorCourse && ownSourceCourseId/);
  assert.match(
    published,
    /if \(!course \|\| course\.learningAudience === "educators" \|\| copyBusy\)/,
  );
  assert.match(
    published,
    /!educatorCourse && ownSourceCourseId[\s\S]*?: !educatorCourse \? \(/,
  );
  assert.doesNotMatch(published, /Адаптировать под группу/);
});

test("owned course actions cover copy, publication, and safe archive states", () => {
  const actions = source(actionsPath);
  const owned = source(ownedPath);
  const route = source(courseRoutePath);
  const service = source(courseServicePath);
  const repository = source(courseRepositoryPath);
  const serverContext = source(courseServerContextPath);
  const deleteRoute = route.slice(
    route.indexOf("export async function DELETE"),
  );

  for (const label of [
    "Дублировать",
    "Опубликовать",
    "Обновить публикацию",
    "Открыть в каталоге",
    "Снять с публикации",
    "Удалить",
  ]) {
    assert.match(actions, new RegExp(label));
  }
  assert.match(actions, /course\.lessonCount === 0/);
  assert.match(actions, /Сначала добавьте хотя бы один урок/);
  assert.match(actions, /\/duplicate/);
  assert.match(actions, /method: "POST"/);
  assert.match(owned, /<CourseActions course=\{course\}/);
  assert.match(
    owned,
    /<CourseActions[\s\S]*?course=\{course\}[\s\S]*?variant="table"/,
  );
  assert.match(owned, /CoursePublicationBadges/);
  assert.match(actions, /triggerIcon=\{variant === "table" \? MoreVertical/);
  assert.match(actions, /portal=\{variant === "table"\}/);
  assert.match(actions, /id: "delete"[\s\S]*?destructive: true/);
  assert.match(
    actions,
    /disabled: Boolean\(busyAction\) \|\| publicationLocked/,
  );
  assert.match(actions, /const pendingReview = reviewStatus === "pending"/);
  assert.match(
    actions,
    /const publicationLocked = published \|\| pendingReview/,
  );
  assert.match(actions, /label: "Отозвать с проверки"/);
  assert.match(
    actions,
    /label: educatorCourse[\s\S]*?\? "Отправить новую редакцию"/,
  );
  assert.match(actions, /reviewStatus === "rejected"/);
  assert.match(actions, /approvedRevisionId/);
  assert.match(actions, /const rejectedInitialPublication =/);
  assert.match(actions, /if \(!educatorCourse \|\| published\)/);
  assert.match(actions, /Снять отклонённую публикацию/);
  assert.match(
    actions,
    /Отклонённая редакция перестанет считаться опубликованной/,
  );
  assert.match(actions, /Сначала снимите отклонённую публикацию/);
  assert.match(actions, /Сначала снимите курс с публикации/);
  assert.match(
    actions,
    /\/api\/v2\/courses\/\$\{encodeURIComponent\(course\.id\)\}`,[\s\S]*?method: "DELETE"/,
  );
  assert.match(deleteRoute, /export async function DELETE/);
  assert.match(deleteRoute, /await getActiveCourseBuilderContext\(\)/);
  assert.doesNotMatch(
    deleteRoute,
    /publication\?\.status === "published"|getPublicationForCourse/,
  );
  assert.match(deleteRoute, /service\.archiveCourse\(actor, courseId\)/);
  assert.doesNotMatch(service, /repository\.hasOpenLessonRuns/);
  assert.match(service, /repository\.archiveCourse\(course\.id\)/);
  assert.match(service, /case "course_is_published"/);
  assert.match(service, /"course_has_open_lesson_runs"/);
  assert.match(service, /case "not_found"/);
  assert.match(repository, /"\/rest\/v1\/rpc\/archive_course"/);
  assert.match(repository, /body: \{ p_course_id: courseId \}/);
  assert.doesNotMatch(repository, /async hasOpenLessonRuns/);
  assert.match(
    serverContext,
    /error instanceof CourseBuilderAccessError[\s\S]*?status: 404/,
  );
  assert.match(
    serverContext,
    /error instanceof CourseBuilderConflictError[\s\S]*?status: 409/,
  );
});

test("publish, update, and archive share one explicit confirmation dialog", () => {
  const actions = source(actionsPath);
  const dialogCount = actions.match(/<DialogShell/g)?.length ?? 0;

  assert.equal(dialogCount, 1);
  assert.match(actions, /type="checkbox"/);
  assert.match(
    actions,
    /Я подтверждаю, что имею права на материалы и разрешаю\s+пользователям ShiDao копировать, изменять и использовать их в\s+своих курсах\./,
  );
  assert.match(actions, /уроками и прикреплёнными материалами/);
  assert.match(
    actions,
    /Группы, ученики, расписание, история занятий и личные пожелания не публикуются/,
  );
  assert.match(actions, /JSON\.stringify\(\{ rightsConfirmed: true \}\)/);
  assert.match(actions, /title: "Удалить курс из списка\?"/);
  assert.match(
    actions,
    /Его уроки, материалы, расписание и история занятий не удаляются безвозвратно/,
  );
  assert.match(
    actions,
    /dialogMode === "publish" \|\| dialogMode === "update"/,
  );
  assert.match(
    actions,
    /Boolean\(busyAction\) \|\| \(requiresRights && !rightsConfirmed\)/,
  );
  assert.doesNotMatch(actions, /предпросмотр|сканир|проверяем назван/i);
});

test("action menu exposes menu semantics and keyboard navigation", () => {
  const menu = source(actionMenuPath);

  assert.match(menu, /aria-haspopup="menu"/);
  assert.match(menu, /aria-expanded=\{open\}/);
  assert.match(menu, /role="menu"/);
  assert.match(menu, /role="menuitem"/);
  assert.match(menu, /event\.key === "ArrowDown"/);
  assert.match(menu, /event\.key === "ArrowUp"/);
  assert.match(menu, /event\.key === "Home"/);
  assert.match(menu, /event\.key === "End"/);
  assert.match(menu, /event\.key !== "Escape"/);
});

test("course catalog UI does not introduce a separate template concept", () => {
  const combined = [
    source(pagePath),
    source(indexPath),
    source(ownedPath),
    source(catalogPath),
    source(actionsPath),
  ].join("\n");

  assert.doesNotMatch(combined, /шаблон/i);
});
