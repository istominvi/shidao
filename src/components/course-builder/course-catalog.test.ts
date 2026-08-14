import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CourseSummary } from "@/modules/course-builder/domain";
import {
  DEFAULT_COURSE_CATALOG_FILTERS,
  courseCountLabel,
  filterAndSortCourses,
  getCourseCatalogOptions,
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
const courseFilterMenuSource = readFileSync(
  "src/components/course-builder/course-filter-menu.tsx",
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

test("course catalog combines subject, level, and content filters", () => {
  assert.deepEqual(
    filterAndSortCourses(COURSES, {
      ...DEFAULT_COURSE_CATALOG_FILTERS,
      subject: "Китайский язык",
      level: "Начальный",
      content: "assembled",
    }).map((item) => item.id),
    ["course-1"],
  );
  assert.deepEqual(
    filterAndSortCourses(COURSES, {
      ...DEFAULT_COURSE_CATALOG_FILTERS,
      content: "empty",
    }).map((item) => item.id),
    ["course-3"],
  );
  assert.deepEqual(
    filterAndSortCourses(COURSES, {
      ...DEFAULT_COURSE_CATALOG_FILTERS,
      content: "with-lessons",
    }).map((item) => item.id),
    ["course-1", "course-2"],
  );
});

test("course catalog derives stable options and deterministic sorts", () => {
  assert.deepEqual(getCourseCatalogOptions(COURSES), {
    subjects: ["Английский язык", "Китайский язык"],
    levels: ["Начальный", "Продвинутый"],
  });
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

test("course catalog UI exposes accessible search, filters, views, and states", () => {
  const source = `${coursesIndexSource}\n${ownedCoursesPanelSource}\n${courseCatalogPanelSource}`;

  for (const panelSource of [
    ownedCoursesPanelSource,
    courseCatalogPanelSource,
  ]) {
    assert.match(panelSource, /type="search"/);
    assert.match(panelSource, /className="compact-page-toolbar/);
    assert.match(panelSource, /<CourseFilterMenu/);
    assert.match(panelSource, /Ничего не найдено/);
    assert.doesNotMatch(panelSource, /className="compact-toolbar-result"/);
    assert.match(panelSource, /className="sr-only" role="status"/);
    assert.match(panelSource, /aria-live="polite"/);
  }

  assert.match(ownedCoursesPanelSource, /content=\{filters\.content\}/);
  assert.match(ownedCoursesPanelSource, /onContentChange=/);
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

test("shared course controls preserve pressed-button and native-filter semantics", () => {
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
  assert.match(segmentedControlSource, /inline-flex h-10[^"\n]*p-1/);
  assert.match(segmentedControlSource, /h-8 min-h-8/);
  assert.match(segmentedControlSource, /product-segmented-control/);
  assert.match(segmentedControlSource, /product-segmented-control-option/);
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-segmented-control-background: oklch\(0\.19 0 0 \/ 0\.1\);/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control\s*\{[^}]*border: 0;[^}]*background: var\(--product-segmented-control-background\);[^}]*box-shadow: none;/,
  );
  assert.match(
    globalStyles,
    /\.product-segmented-control-option:focus-visible\s*\{[^}]*outline: 2px solid rgba\(20, 20, 20, 0\.58\);[^}]*outline-offset: -2px;/,
  );
  assert.doesNotMatch(
    segmentedControlSource,
    /bg-neutral-950\/\[0\.05\]|shadow-\[inset|shadow-\[0_1px_3px|focus-visible:ring|focus-visible:outline-none/,
  );
  assert.match(
    segmentedControlSource,
    /isSelected[\s\S]*?bg-white text-neutral-950/,
  );
  assert.match(
    segmentedControlSource,
    /!iconOnly && item\.count !== undefined/,
  );

  assert.match(courseFilterMenuSource, /<details/);
  assert.match(courseFilterMenuSource, /<summary/);
  assert.match(courseFilterMenuSource, /Button, productButtonClassName/);
  assert.match(
    courseFilterMenuSource,
    /className=\{productButtonClassName\(\s*"secondary",\s*"course-filter-trigger",?\s*\)\}/,
  );
  assert.match(courseFilterMenuSource, /aria-controls=\{panelId\}/);
  assert.match(courseFilterMenuSource, /aria-expanded=\{open\}/);
  assert.match(
    courseFilterMenuSource,
    /aria-disabled=\{disabled \|\| undefined\}/,
  );
  assert.match(
    courseFilterMenuSource,
    /if \(disabled\) event\.preventDefault\(\)/,
  );
  assert.match(courseFilterMenuSource, /role="group"/);
  assert.match(courseFilterMenuSource, /aria-label=\{label\}/);
  assert.match(
    courseFilterMenuSource,
    /<label className="course-filter-field">/,
  );
  assert.match(courseFilterMenuSource, /<Select/);
  assert.match(courseFilterMenuSource, /event\.key !== "Escape"/);
  assert.match(courseFilterMenuSource, /summaryRef\.current\?\.focus\(\)/);
  assert.match(courseFilterMenuSource, /contains\(event\.target as Node\)/);
  assert.match(courseFilterMenuSource, /onSubjectChange\("all"\)/);
  assert.match(courseFilterMenuSource, /onLevelChange\("all"\)/);
  assert.match(courseFilterMenuSource, /onContentChange\?\.\("all"\)/);
  assert.match(courseFilterMenuSource, /Сбросить фильтры/);
  assert.doesNotMatch(courseFilterMenuSource, /role="menu/);
});

test("course tables and filter CTA adopt canonical raised surfaces", () => {
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-raised-surface-shadow: var\(--product-raised-control-shadow\);/,
  );
  assert.match(
    globalStyles,
    /\.course-index-table-wrap\s*\{[^}]*box-shadow: var\(--product-raised-surface-shadow\);/,
  );
  assert.match(
    globalStyles,
    /\.course-filter-trigger\s*\{[^}]*border: 0;[^}]*background: #fff;[^}]*box-shadow: var\(--product-raised-control-shadow\);[^}]*transform: none;/,
  );
  assert.match(
    globalStyles,
    /\.course-filter-trigger:focus-visible\s*\{[^}]*outline: 2px solid rgba\(20, 20, 20, 0\.58\);[^}]*outline-offset: 2px;[^}]*box-shadow: var\(--product-raised-control-shadow\);/,
  );
});
