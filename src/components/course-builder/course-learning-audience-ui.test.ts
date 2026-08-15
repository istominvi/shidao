import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const coursesPage = source("src/app/(app)/courses/page.tsx");
const coursesIndex = source("src/components/course-builder/courses-index.tsx");
const catalog = source(
  "src/components/course-builder/course-catalog-panel.tsx",
);
const publishedCourse = source(
  "src/components/course-builder/published-course-workspace.tsx",
);
const newCourse = source("src/components/course-builder/new-course-form.tsx");
const courseWorkspace = source(
  "src/components/course-builder/course-workspace.tsx",
);

test("catalog learning audience is shareable, server-filtered, and resets list state", () => {
  assert.match(coursesPage, /query\.audience === "educators"/);
  assert.match(
    coursesPage,
    /initialLearningAudience=\{initialLearningAudience\}/,
  );
  assert.match(coursesIndex, /query\.set\("audience", "educators"\)/);
  assert.doesNotMatch(coursesIndex, /setSelectedCatalogCourseId/);
  assert.match(coursesIndex, /onLearningAudienceChange=/);

  assert.match(catalog, /ariaLabel="Направление обучения"/);
  assert.match(catalog, /label: "Обучение детей"/);
  assert.match(catalog, /label: "Обучение педагогов"/);
  assert.match(
    catalog,
    /className="compact-page-toolbar course-catalog-toolbar"[\s\S]*?className="course-catalog-toolbar-main"[\s\S]*?className="compact-toolbar-search product-search-wrap"[\s\S]*?className="compact-toolbar-rail"[\s\S]*?\{learningAudienceControl\}[\s\S]*?<SegmentedControl[\s\S]*?ariaLabel="Вид каталога курсов"/,
  );
  assert.doesNotMatch(catalog, /CourseFilterMenu/);
  assert.equal(
    catalog.match(/\{learningAudienceControl\}/g)?.length,
    1,
    "the audience switch belongs to the catalog toolbar only",
  );
  assert.doesNotMatch(publishedCourse, /CatalogLearningAudienceControl/);
  assert.match(catalog, /params\.set\("learningAudience", learningAudience\)/);
  assert.match(
    catalog,
    /function changeLearningAudience[\s\S]*?setQuery\(""\)[\s\S]*?setDebouncedQuery\(""\)[\s\S]*?setCourses\(null\)[\s\S]*?setNextCursor\(null\)[\s\S]*?onLearningAudienceChange\(nextAudience\)/,
  );
  assert.doesNotMatch(catalog, /setSubject|setLevel/);
});

test("only authorized creators choose educator audience and persisted audience is immutable", () => {
  assert.match(
    newCourse,
    /learningAudience: String\(formData\.get\("learningAudience"\)/,
  );
  assert.match(newCourse, /name="learningAudience"/);
  assert.match(newCourse, /useState<CourseLearningAudience>\("children"\)/);
  assert.match(newCourse, /ariaLabel="Направление обучения"/);
  assert.match(newCourse, /label: "Обучение детей"/);
  assert.match(newCourse, /label: "Обучение педагогов"/);
  assert.match(newCourse, /canAuthorEducatorCourses \? \(/);
  assert.match(
    newCourse,
    /value=\{canAuthorEducatorCourses \? learningAudience : "children"\}/,
  );

  assert.match(courseWorkspace, /course\.learningAudience/);
  assert.doesNotMatch(
    courseWorkspace,
    /jsonRequest\([\s\S]*?"PATCH"[\s\S]*?learningAudience,/,
  );
  assert.doesNotMatch(courseWorkspace, /ariaLabel="Направление обучения"/);
});

test("educator published workspace tracks lessons and gates server-backed attestation", () => {
  assert.match(
    catalog,
    /import type \{ CourseAttestationState \} from "@\/modules\/course-attestations\/domain"/,
  );
  assert.match(publishedCourse, /course\.learningAudience === "educators"/);
  assert.match(
    publishedCourse,
    /value: "lessons"[\s\S]*?label: "Уроки"[\s\S]*?icon: ListChecks/,
  );
  assert.match(
    publishedCourse,
    /value: "about"[\s\S]*?label: "О курсе"[\s\S]*?icon: Info/,
  );
  assert.match(
    publishedCourse,
    /value: "attestation"[\s\S]*?label: "Аттестация"[\s\S]*?icon: BadgeCheck/,
  );
  assert.match(publishedCourse, /ariaLabel="Разделы опубликованного курса"/);
  assert.match(
    publishedCourse,
    /\/api\/v2\/course-catalog\/\$\{encodeURIComponent\(publicationId\)\}\/progress/,
  );
  assert.match(
    publishedCourse,
    /method: "PUT"[\s\S]*?expectedRevisionId: revisionId[\s\S]*?lessonRef,[\s\S]*?completed/,
  );
  assert.match(publishedCourse, /createPublishedCourseProgressQueue/);
  assert.match(
    publishedCourse,
    /progressQueue\.enqueue\(\{[\s\S]*?kind: "open",[\s\S]*?lessonRef: lesson\.id/,
  );
  assert.match(
    publishedCourse,
    /progressQueue\.activate\(null\)[\s\S]*?setActiveSurface\("lessons"\)/,
  );
  assert.match(
    publishedCourse,
    /<h2 ref=\{lessonHeadingRef\} tabIndex=\{-1\}>/,
  );
  assert.match(
    publishedCourse,
    /aria-pressed=\{completedRefs\.has\(selectedLesson\.id\)\}/,
  );
  assert.match(publishedCourse, /Снять отметку о прохождении урока/);
  assert.match(publishedCourse, /!progress\?\.complete/);
  assert.match(publishedCourse, /Аттестация откроется после курса/);
  assert.match(
    publishedCourse,
    /course\?\.learningAudience !== "educators" \|\|[\s\S]*?!progress\?\.complete/,
  );
  assert.match(publishedCourse, /<Chip icon=\{BadgeCheck\} tone="emerald">/);
  assert.match(publishedCourse, />\s*Аттестован\s*</);
  assert.match(
    publishedCourse,
    /className="published-course-header-summary"[\s\S]*?className="published-course-header-status"[\s\S]*?Аттестован[\s\S]*?className="published-course-header-author"[\s\S]*?Автор: \{authorLogin\}/,
  );
  assert.match(
    publishedCourse,
    /course\.author\.isCurrentUser && sessionState\.kind === "account"[\s\S]*?sessionState\.email \?\? course\.author\.displayName/,
  );
  assert.doesNotMatch(publishedCourse, /tone="inverse"/);
  assert.doesNotMatch(publishedCourse, />\s*ShiDao\s*</);
  assert.match(publishedCourse, /resumeLesson/);
  assert.match(publishedCourse, />\s*Продолжить\s*</);
  assert.match(catalog, /attestation\.certified && attestation\.attempt/);
  assert.match(catalog, /Правильный ответ/);
  assert.match(catalog, /question\.explanation/);
  assert.match(catalog, /type="radio"/);
  assert.match(
    publishedCourse,
    /method: "POST"[\s\S]*?expectedRevisionId,[\s\S]*?selectedOptionByQuestionId/,
  );
});
