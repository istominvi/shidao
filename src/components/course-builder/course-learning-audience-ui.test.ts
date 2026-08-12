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
  assert.match(coursesIndex, /setSelectedCatalogCourseId\(null\)/);
  assert.match(coursesIndex, /onLearningAudienceChange=/);

  assert.match(catalog, /ariaLabel="Направление обучения"/);
  assert.match(catalog, /label: "Обучение детей"/);
  assert.match(catalog, /label: "Обучение педагогов"/);
  assert.match(catalog, /params\.set\("learningAudience", learningAudience\)/);
  assert.match(
    catalog,
    /function changeLearningAudience[\s\S]*?setQuery\(""\)[\s\S]*?setDebouncedQuery\(""\)[\s\S]*?setSubject\("all"\)[\s\S]*?setLevel\("all"\)[\s\S]*?setCourses\(\[\]\)[\s\S]*?setNextCursor\(null\)[\s\S]*?onLearningAudienceChange\(nextAudience\)/,
  );
});

test("new and existing course forms persist the learning audience", () => {
  assert.match(
    newCourse,
    /learningAudience: String\(formData\.get\("learningAudience"\)/,
  );
  assert.match(newCourse, /name="learningAudience"/);
  assert.match(newCourse, /useState<CourseLearningAudience>\("children"\)/);
  assert.match(newCourse, /ariaLabel="Направление обучения"/);
  assert.match(newCourse, /label: "Обучение детей"/);
  assert.match(newCourse, /label: "Обучение педагогов"/);

  assert.match(courseWorkspace, /course\.learningAudience/);
  assert.match(
    courseWorkspace,
    /jsonRequest\([\s\S]*?"PATCH"[\s\S]*?learningAudience,/,
  );
  assert.match(courseWorkspace, /ariaLabel="Направление обучения"/);
  assert.match(courseWorkspace, /label: "Обучение детей"/);
  assert.match(courseWorkspace, /label: "Обучение педагогов"/);
});

test("educator catalog detail uses server-backed attestation and locks passed review", () => {
  assert.match(
    catalog,
    /import type \{ CourseAttestationState \} from "@\/modules\/course-attestations\/domain"/,
  );
  assert.match(catalog, /course\.learningAudience === "educators"/);
  assert.match(catalog, /value: "overview", label: "О курсе"/);
  assert.match(catalog, /value: "attestation", label: "Аттестация"/);
  assert.match(catalog, /ariaLabel="Разделы курса для педагогов"/);
  assert.match(
    catalog,
    /\/api\/v2\/course-catalog\/\$\{encodeURIComponent\(courseId\)\}\/attestation/,
  );
  assert.match(catalog, /method: "POST"/);
  assert.match(
    catalog,
    /body: JSON\.stringify\(\{[\s\S]*?expectedRevisionId,[\s\S]*?selectedOptionByQuestionId,[\s\S]*?\}\)/,
  );
  assert.match(catalog, /<Chip icon=\{BadgeCheck\} tone="emerald">/);
  assert.match(catalog, />\s*Аттестован\s*</);
  assert.match(catalog, /attestation\.certified && attestation\.attempt/);
  assert.match(catalog, /Правильный ответ/);
  assert.match(catalog, /question\.explanation/);
  assert.match(catalog, /type="radio"/);
  assert.match(
    catalog,
    /educatorCourse && !attestation\?\.certified[\s\S]*?Сначала пройдите аттестацию[\s\S]*?setActiveTab\("attestation"\)[\s\S]*?Перейти к аттестации/,
  );
});
