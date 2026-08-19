import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CourseSummary } from "@/modules/course-builder/domain";
import {
  DEFAULT_COURSE_CATALOG_FILTERS,
  courseCountLabel,
  filterAndSortCourses,
  hasActiveCourseCatalogFilters,
} from "./course-catalog";

const coursesIndexSource = readFileSync(
  "src/components/course-builder/courses-index.tsx",
  "utf8",
);
const ownedCoursesPanelSource = readFileSync(
  "src/components/course-builder/owned-courses-panel.tsx",
  "utf8",
);
const courseCatalogPanelSource = readFileSync(
  "src/components/course-builder/course-catalog-panel.tsx",
  "utf8",
);
const segmentedControlSource = readFileSync(
  "src/components/ui/segmented-control.tsx",
  "utf8",
);
const globalStyles = readFileSync("src/app/globals.css", "utf8");

function course(
  overrides: Partial<CourseSummary> & Pick<CourseSummary, "id" | "title">,
): CourseSummary {
  return {
    ownerAccountId: "account-1",
    subject: "Английский язык",
    goal: "Развить разговорные навыки",
    level: "Начальный",
    audienceDescription: "Взрослые ученики",
    targetLessonCount: 8,
    teacherPreferences: "Приватная заметка",
    status: "draft",
    lessonCount: 0,
    publication: null,
    assembledAt: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    publicationContentUpdatedAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
    learningAudience: overrides.learningAudience ?? "children",
    id: overrides.id,
    title: overrides.title,
  };
}

const COURSES = [
  course({
    id: "course-1",
    title: "Китайский для путешествий",
    subject: "Китайский язык",
    level: "Начальный",
    goal: "Общаться в поездке",
    lessonCount: 4,
    assembledAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-03T10:00:00.000Z",
  }),
  course({
    id: "course-2",
    title: "Английский B2",
    level: "Продвинутый",
    goal: "Подготовка к собеседованию",
    lessonCount: 7,
    updatedAt: "2026-08-02T10:00:00.000Z",
  }),
  course({
    id: "course-3",
    title: "Английский с нуля",
    teacherPreferences: "Секретное кодовое слово",
    updatedAt: "2026-08-04T10:00:00.000Z",
  }),
];

test("course catalog searches visible metadata and excludes private preferences", () => {
  assert.deepEqual(
    filterAndSortCourses(COURSES, {
      ...DEFAULT_COURSE_CATALOG_FILTERS,
      query: "  СОБЕСЕДОВАНИЮ ",
    }).map((item) => item.id),
    ["course-2"],
  );
  assert.deepEqual(
    filterAndSortCourses(COURSES, {
      ...DEFAULT_COURSE_CATALOG_FILTERS,
      query: "секретное кодовое",
    }),
    [],
  );
});

test("course catalog applies deterministic sorts", () => {
  assert.deepEqual(
    filterAndSortCourses(COURSES, {
      ...DEFAULT_COURSE_CATALOG_FILTERS,
      sort: "updated-asc",
    }).map((item) => item.id),
    ["course-2", "course-1", "course-3"],
  );
  assert.deepEqual(
    filterAndSortCourses(COURSES, DEFAULT_COURSE_CATALOG_FILTERS).map(
      (item) => item.id,
    ),
    ["course-3", "course-1", "course-2"],
  );
  assert.deepEqual(
    COURSES.map((item) => item.id),
    ["course-1", "course-2", "course-3"],
    "filtering must not mutate the API response",
  );
});

test("course catalog reports active filters and Russian result labels", () => {
  assert.equal(
    hasActiveCourseCatalogFilters(DEFAULT_COURSE_CATALOG_FILTERS),
    false,
  );
  assert.equal(
    hasActiveCourseCatalogFilters({
      ...DEFAULT_COURSE_CATALOG_FILTERS,
      query: "курс",
    }),
    true,
  );
  assert.equal(courseCountLabel(1), "1 курс");
  assert.equal(courseCountLabel(3), "3 курса");
  assert.equal(courseCountLabel(12), "12 курсов");
});

test("course catalog UI exposes accessible search, views, and states without filter menus", () => {
  const source = `${coursesIndexSource}\n${ownedCoursesPanelSource}\n${courseCatalogPanelSource}`;

  for (const panelSource of [
    ownedCoursesPanelSource,
    courseCatalogPanelSource,
  ]) {
    assert.match(panelSource, /type="search"/);
    assert.match(panelSource, /className="compact-page-toolbar/);
    assert.match(panelSource, /aria-label="Очистить поиск"/);
    assert.doesNotMatch(panelSource, /CourseFilterMenu|course-filter/);
    assert.match(panelSource, /Ничего не найдено/);
    assert.doesNotMatch(panelSource, /className="compact-toolbar-result"/);
    assert.match(panelSource, /className="sr-only" role="status"/);
    assert.match(panelSource, /aria-live="polite"/);
  }

  assert.doesNotMatch(
    ownedCoursesPanelSource,
    /filters\.(?:content|subject|level)|setContent|setSubject|setLevel/,
  );
  assert.doesNotMatch(
    courseCatalogPanelSource,
    /filters\.(?:content|subject|level)|setContent|setSubject|setLevel/,
  );
  assert.match(
    ownedCoursesPanelSource,
    /useState<CourseCatalogView>\("table"\)/,
  );
  assert.match(ownedCoursesPanelSource, /ariaLabel="Вид списка курсов"/);
  assert.match(
    ownedCoursesPanelSource,
    /ariaLabel="Вид списка курсов"[\s\S]*?items=\{\[\s*\{[\s\S]*?value: "table"[\s\S]*?\},\s*\{[\s\S]*?value: "grid"/,
  );
  assert.match(ownedCoursesPanelSource, /label: "Карточки"/);
  assert.match(ownedCoursesPanelSource, /label: "Таблица"/);
  assert.match(ownedCoursesPanelSource, /ariaLabel: "Показать карточками"/);
  assert.match(ownedCoursesPanelSource, /ariaLabel: "Показать таблицей"/);
  assert.match(ownedCoursesPanelSource, /iconOnly/);
  assert.match(ownedCoursesPanelSource, /<caption className="sr-only"/);
  assert.match(ownedCoursesPanelSource, /role="region"/);
  assert.match(ownedCoursesPanelSource, /tabIndex=\{0\}/);
  assert.match(ownedCoursesPanelSource, /className="product-table-wrap/);
  assert.match(courseCatalogPanelSource, /className="product-table-wrap/);
  assert.match(
    ownedCoursesPanelSource,
    /className="product-table-wrap course-index-table-wrap/,
  );
  assert.match(
    ownedCoursesPanelSource,
    /className="course-index-table course-index-owned-table"/,
  );
  assert.match(
    courseCatalogPanelSource,
    /className="course-index-table course-index-catalog-table"/,
  );
  assert.match(
    courseCatalogPanelSource,
    /useState<CourseCatalogView>\("table"\)/,
  );
  assert.match(courseCatalogPanelSource, /ariaLabel="Вид каталога курсов"/);
  assert.match(
    courseCatalogPanelSource,
    /ariaLabel="Вид каталога курсов"[\s\S]*?items=\{\[\s*\{[\s\S]*?value: "table"[\s\S]*?\},\s*\{[\s\S]*?value: "grid"/,
  );
  assert.match(courseCatalogPanelSource, /label: "Карточки"/);
  assert.match(courseCatalogPanelSource, /label: "Таблица"/);
  assert.match(courseCatalogPanelSource, /<CatalogCourseTable/);
  assert.match(
    courseCatalogPanelSource,
    /aria-label="Таблица курсов каталога"/,
  );
  assert.match(courseCatalogPanelSource, /<caption className="sr-only">/);
  assert.equal(
    ownedCoursesPanelSource.match(/<ProductTableSortableHeaderCell/g)?.length,
    5,
  );
  for (const key of ["title", "subject", "lessons", "publication", "updated"]) {
    assert.match(
      ownedCoursesPanelSource,
      new RegExp(`onSort=\\{\\(\\) => onSort\\("${key}"\\)\\}`),
    );
  }
  assert.match(
    ownedCoursesPanelSource,
    /setTableSort\(\(current\) => nextProductTableSort\(current, key\)\)/,
  );
  assert.match(ownedCoursesPanelSource, /return \[\.\.\.courses\]\.sort/);
  assert.match(
    ownedCoursesPanelSource,
    /return left\.id\.localeCompare\(right\.id\)/,
  );
  assert.match(
    ownedCoursesPanelSource,
    /<ProductTableHeaderCell aria-label="Действия" \/>/,
  );
  assert.doesNotMatch(ownedCoursesPanelSource, /course-index-table-col-level/);
  assert.doesNotMatch(courseCatalogPanelSource, /course-index-table-col-level/);
  assert.doesNotMatch(
    ownedCoursesPanelSource,
    /<ProductTableSortableHeaderCell[\s\S]*?>\s*Уровень\s*<\/ProductTableSortableHeaderCell>/,
  );
  assert.doesNotMatch(
    courseCatalogPanelSource,
    /<ProductTableHeaderCell>Уровень<\/ProductTableHeaderCell>/,
  );
  assert.match(ownedCoursesPanelSource, /variant="table"/);
  assert.doesNotMatch(
    ownedCoursesPanelSource,
    /aria-label="Сортировка"|<Select\b/,
  );
  assert.doesNotMatch(
    courseCatalogPanelSource,
    /ProductTableSortableHeaderCell/,
  );
  assert.doesNotMatch(courseCatalogPanelSource, />Готовые курсы</);
  assert.doesNotMatch(courseCatalogPanelSource, />Каталог<\/p>/);
  assert.doesNotMatch(
    courseCatalogPanelSource,
    /Добавьте курс себе и измените уроки/,
  );
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("shared course controls preserve pressed-button semantics", () => {
  assert.match(segmentedControlSource, /role="group"/);
  assert.match(segmentedControlSource, /aria-label=\{ariaLabel\}/);
  assert.match(segmentedControlSource, /aria-pressed=\{isSelected\}/);
  assert.match(
    segmentedControlSource,
    /aria-label=\{item\.ariaLabel \?\? \(iconOnly \? item\.label : undefined\)\}/,
  );
  assert.match(
    segmentedControlSource,
    /title=\{iconOnly \? item\.label : undefined\}/,
  );
  assert.match(
    segmentedControlSource,
    /aria-busy=\{item\.busy \|\| undefined\}/,
  );
  assert.match(segmentedControlSource, /disabled=\{isDisabled\}/);
  assert.match(segmentedControlSource, /product-segmented-control/);
  assert.match(segmentedControlSource, /product-segmented-control-option/);
  assert.equal(
    segmentedControlSource.match(
      /className="product-segmented-control-indicator"/g,
    )?.length,
    1,
  );
  assert.ok(
    segmentedControlSource.indexOf(
      'className="product-segmented-control-indicator"',
    ) < segmentedControlSource.indexOf("{items.map"),
  );
  assert.match(
    segmentedControlSource,
    /ref=\{groupRef\}[\s\S]*?data-indicator-ready=\{indicatorVisible \|\| undefined\}/,
  );
  assert.match(
    segmentedControlSource,
    /className="product-segmented-control-indicator"\s+aria-hidden="true"/,
  );
  assert.match(
    segmentedControlSource,
    /data-variant=\{iconOnly \? "icon" : "text"\}/,
  );
  assert.doesNotMatch(
    segmentedControlSource,
    /product-segmented-control-(?:icon-only|text|option-icon-only|option-selected)/,
  );
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-control-height: 2\.5rem;[^}]*--product-control-radius: var\(--product-element-radius\);[^}]*--product-control-icon-size: 1rem;[^}]*--product-surface-background: #fff;[^}]*--product-surface-border-width: 1px;[^}]*--product-surface-border-color: oklch\(0 0 0 \/ 0\.1\);[^}]*--product-surface-border: var\(--product-surface-border-width\) solid\s+var\(--product-surface-border-color\);[^}]*--product-selection-motion-duration: 360ms;[^}]*--product-selection-motion-easing: cubic-bezier\(0\.22, 1, 0\.36, 1\);[^}]*--product-selection-motion-fade-duration: 120ms;[^}]*--product-segmented-control-background: var\(--product-surface-border-color\);/,
  );
  assert.doesNotMatch(
    globalStyles,
    /--product-(?:touch-control-font-size|control-icon-stroke-width)/,
  );
  assert.match(
    globalStyles,
    /:root\s*\{[\s\S]*?--product-segmented-control-height: var\(--product-control-height\);[\s\S]*?--product-segmented-control-radius: var\(--product-control-radius\);[\s\S]*?--product-segmented-control-option-size: calc\(\s*var\(--product-segmented-control-height\) -\s*var\(--product-surface-border-width\) - var\(--product-surface-border-width\)\s*\);[\s\S]*?--product-segmented-control-option-radius: calc\(\s*var\(--product-segmented-control-radius\) -\s*var\(--product-surface-border-width\)\s*\);[\s\S]*?--product-segmented-control-gap: calc\(\s*var\(--product-surface-border-width\) \+ var\(--product-surface-border-width\)\s*\);/,
  );
  assert.match(
    globalStyles,
    /:root\s*\{[\s\S]*?--product-segmented-control-surface-shadow:\s*var\(\s*--product-raised-control-shadow\s*\);[\s\S]*?--product-segmented-control-surface-shadow-pressed:\s*var\(\s*--product-raised-control-shadow-pressed\s*\);/,
  );
  assert.doesNotMatch(
    globalStyles,
    /--product-segmented-control-surface-boundary/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control\s*\{[^}]*--segmented-option-width: auto;[^}]*display: inline-flex;[^}]*height: var\(--product-segmented-control-height\);[^}]*gap: var\(--product-segmented-control-gap\);[^}]*overflow: visible;[^}]*border: var\(--product-surface-border\);[^}]*border-radius: var\(--product-segmented-control-radius\);[^}]*background: var\(--product-segmented-control-background\);[^}]*background-clip: padding-box;[^}]*padding: 0;[^}]*box-shadow: none;/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control-option\s*\{[^}]*width: var\(--segmented-option-width\);[^}]*height: var\(--product-segmented-control-option-size\);[^}]*min-width: var\(--segmented-option-min-width\);[^}]*flex: var\(--segmented-option-flex\);[^}]*border: 0;[^}]*border-radius: var\(--product-segmented-control-option-radius\);[^}]*background: transparent;[^}]*padding-inline: var\(--segmented-option-padding-inline\);/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control\[data-variant="icon"\]\s*\{[^}]*--segmented-option-width: var\(--product-segmented-control-option-size\);[^}]*--segmented-option-flex: 0 0 var\(--product-segmented-control-option-size\);[^}]*--segmented-option-padding-inline: 0;/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control-indicator\s*\{[^}]*z-index: 0;[^}]*height: var\(--product-segmented-control-option-size\);[^}]*border-radius: var\(--product-segmented-control-option-radius\);[^}]*background-color: var\(--product-surface-background\);[^}]*background-image: none;[^}]*box-shadow: var\(--product-segmented-control-surface-shadow\);[^}]*pointer-events: none;[^}]*backdrop-filter: none;/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control-option\s*\{[^}]*z-index: 1;/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control-option\[aria-pressed="true"\]\s*\{[^}]*background: var\(--segmented-selected-background\);[^}]*background-clip: var\(--segmented-selected-background-clip\);[^}]*box-shadow: var\(--segmented-selected-shadow\);/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control\[data-indicator-ready="true"\]\s*\{[^}]*--segmented-selected-background: transparent;[^}]*--segmented-selected-background-clip: border-box;[^}]*--segmented-selected-shadow: none;/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control\[data-indicator-ready="true"\]:has\([\s\S]*?\.product-segmented-control-option\[aria-pressed="true"\][\s\S]*?\)\s*\.product-segmented-control-indicator\s*\{[^}]*box-shadow: var\(--product-segmented-control-surface-shadow-pressed\);/,
  );
  assert.match(
    globalStyles,
    /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.product-segmented-control-option:hover:not\(:disabled\)\[aria-pressed="false"\]\s*\{[^}]*color: var\(--color-neutral-950, #0a0a0a\);/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control-option:focus-visible\s*\{[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: -2px;/,
  );
  assert.match(
    globalStyles,
    /@media \(forced-colors: active\)[\s\S]*?\.product-segmented-control\s*\{[^}]*background: ButtonFace !important;[^}]*border: var\(--product-surface-border-width\) solid CanvasText;[^}]*outline: 0;[^}]*box-shadow: none;[^}]*forced-color-adjust: none;[^}]*\}[\s\S]*?\.product-segmented-control-option\s*\{[^}]*color: ButtonText !important;[^}]*\}[\s\S]*?\.product-segmented-control-indicator\s*\{[^}]*display: none !important;[^}]*\}[\s\S]*?\.product-segmented-control-option\[aria-pressed="true"\]\s*\{[^}]*border: 1px solid Highlight !important;[^}]*background: Highlight !important;[^}]*color: HighlightText !important;[^}]*box-shadow: none !important;[^}]*forced-color-adjust: none;/,
  );
  assert.match(
    globalStyles,
    /@media \(forced-colors: active\)[\s\S]*?\.product-segmented-control-option:focus-visible\s*\{[^}]*outline: 2px solid Highlight !important;[^}]*outline-offset: -2px;[^}]*box-shadow: none !important;[^}]*\}[\s\S]*?\.product-segmented-control-option\[aria-pressed="true"\]:focus-visible\s*\{[^}]*outline-color: HighlightText !important;/,
  );
  assert.match(
    globalStyles,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.product-segmented-control-option\s*\{[^}]*transition: none;[^}]*\}[\s\S]*?\.product-segmented-control-indicator,\s*\.product-segmented-control-indicator\[data-motion-ready="true"\]\s*\{[^}]*transition: none;/,
  );
  assert.doesNotMatch(
    segmentedControlSource,
    /bg-neutral-950\/\[0\.05\]|shadow-\[inset|shadow-\[0_1px_3px|focus-visible:ring|focus-visible:outline-none/,
  );
  assert.match(segmentedControlSource, /aria-pressed=\{isSelected\}/);
  assert.doesNotMatch(
    segmentedControlSource,
    /\bh-10\b|\bh-8\b|\bw-8\b|\bgap-1\b|\bp-1\b|\brounded-(?:xl|lg)\b|\bh-4\b|\bw-4\b/,
  );
  assert.match(
    segmentedControlSource,
    /!iconOnly && item\.count !== undefined/,
  );
});

test("course tables adopt canonical raised surfaces", () => {
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-surface-border-width: 1px;[^}]*--product-surface-border-color: oklch\(0 0 0 \/ 0\.1\);[^}]*--product-surface-border: var\(--product-surface-border-width\) solid\s+var\(--product-surface-border-color\);[^}]*--product-raised-surface-shadow: var\(--product-raised-control-shadow\);/,
  );
  assert.match(
    globalStyles,
    /\.product-table-wrap\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background-clip: padding-box;/,
  );
  assert.match(
    globalStyles,
    /\.course-index-table-wrap\s*\{[^}]*box-shadow: var\(--product-raised-surface-shadow\);/,
  );
  assert.doesNotMatch(
    globalStyles,
    /\.course-filter-(?:trigger|popover|actions)/,
  );
  assert.doesNotMatch(ownedCoursesPanelSource, /border-white\/80/);
  assert.doesNotMatch(courseCatalogPanelSource, /border-white\/80/);
});

test("course index keeps ergonomic mobile cards and one segmented geometry", () => {
  const touchMediaQuery =
    "@media (max-width: 767px), (hover: none) and (pointer: coarse)";
  const touchMediaStart = globalStyles.indexOf(touchMediaQuery);
  const narrowMediaStart = globalStyles.indexOf(
    "@media (max-width: 767px)",
    touchMediaStart + touchMediaQuery.length,
  );
  assert.ok(touchMediaStart >= 0);
  assert.ok(narrowMediaStart > touchMediaStart);

  const touchStyles = globalStyles.slice(touchMediaStart, narrowMediaStart);

  for (const panelSource of [
    ownedCoursesPanelSource,
    courseCatalogPanelSource,
  ]) {
    assert.match(panelSource, /className="[^"]*course-index-mobile-list[^"]*"/);
    assert.match(panelSource, /role="list"/);
    assert.match(panelSource, /className="[^"]*course-index-mobile-card[^"]*"/);
    assert.match(panelSource, /role="listitem"/);
  }

  assert.match(
    globalStyles,
    /\.course-index-mobile-list\s*\{[^}]*display: none;/,
  );
  assert.match(
    globalStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.courses-index-shell \.course-index-table-wrap\s*\{[^}]*display: none;[^}]*\}[\s\S]*?\.course-index-mobile-list\s*\{[^}]*display: grid;/,
  );
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-control-padding-inline: 0\.75rem;[^}]*--product-control-font-size: 0\.88rem;[^}]*--product-control-icon-size: 1rem;/,
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
  assert.match(
    globalStyles,
    /\.product-segmented-control-option svg\.lucide\s*\{[^}]*width: var\(--product-control-icon-size\);[^}]*height: var\(--product-control-icon-size\);[^}]*flex: 0 0 var\(--product-control-icon-size\);/,
  );
  assert.doesNotMatch(globalStyles, /vector-effect:\s*non-scaling-stroke/);
  assert.match(
    globalStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.course-catalog-audience-control[\s\S]*?\.product-segmented-control\s*\{[^}]*width: 100%;/,
  );
  assert.doesNotMatch(
    globalStyles,
    /\.product-segmented-control(?:::before|[^\s,{]*::before)/,
  );
  assert.doesNotMatch(touchStyles, /transform: scale\(/);
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
});
