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
const actionsPath = "src/components/course-builder/course-actions.tsx";
const actionMenuPath = "src/components/ui/action-menu.tsx";

test("courses index exposes My and Catalog tabs with shareable catalog URLs", () => {
  const page = source(pagePath);
  const index = source(indexPath);

  assert.match(page, />\s*Создать курс\s*</);
  assert.match(page, /query\.tab === "catalog"/);
  assert.match(page, /initialCatalogCourseId/);
  assert.match(index, /value: "mine", label: "Мои"/);
  assert.match(index, /value: "catalog", label: "Каталог"/);
  assert.match(index, /ariaLabel="Разделы курсов"/);
  assert.match(index, /role="tabpanel"/);
  assert.match(index, /workspaceTabId/);
  assert.match(index, /workspaceTabPanelId/);
  assert.match(index, /\/courses\?tab=catalog/);
  assert.match(index, /query\.set\("course", courseId\)/);
});

test("catalog shows published lessons and safe material links before copying", () => {
  const catalog = source(catalogPath);

  assert.match(catalog, />Готовые курсы</);
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
  assert.match(
    catalog,
    /\/api\/v2\/course-catalog\/\$\{encodeURIComponent\(courseId\)\}/,
  );
  assert.match(catalog, /course\.lessons\.map/);
  assert.match(catalog, /course\.materials\.map/);
  assert.match(catalog, /material\.originalFilename/);
  assert.match(catalog, /href=\{material\.downloadUrl\}/);
  assert.match(
    catalog,
    /aria-label=\{`Открыть материал «\$\{material\.originalFilename\}»`\}/,
  );
  assert.match(catalog, /target="_blank"/);
  assert.match(catalog, /rel="noreferrer"/);
  assert.match(catalog, />\s*Открыть мой курс\s*</);
  assert.match(catalog, /Добавить в мои курсы/);
  assert.match(catalog, /\/copy/);
  assert.match(catalog, /router\.push\(toCourseRoute\(payload\.courseId\)\)/);
  assert.doesNotMatch(catalog, /Адаптировать под группу/);
});

test("owned course actions cover copy and publication states", () => {
  const actions = source(actionsPath);
  const owned = source(ownedPath);

  for (const label of [
    "Дублировать",
    "Опубликовать в каталоге",
    "Обновить публикацию",
    "Открыть в каталоге",
    "Снять с публикации",
  ]) {
    assert.match(actions, new RegExp(label));
  }
  assert.match(actions, /course\.lessonCount === 0/);
  assert.match(actions, /Сначала добавьте хотя бы один урок/);
  assert.match(actions, /\/duplicate/);
  assert.match(actions, /method: "POST"/);
  assert.match(owned, /<CourseActions course=\{course\}/);
  assert.match(owned, /CoursePublicationBadges/);
});

test("publish and update share one concise rights confirmation dialog", () => {
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
