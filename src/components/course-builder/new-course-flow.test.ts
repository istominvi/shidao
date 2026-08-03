import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clientSource = readFileSync(
  "src/components/course-builder/course-builder-client.ts",
  "utf8",
);
const formSource = readFileSync(
  "src/components/course-builder/new-course-form.tsx",
  "utf8",
);
const coursesPageSource = readFileSync(
  "src/app/(app)/courses/page.tsx",
  "utf8",
);
const coursesIndexSource = readFileSync(
  "src/components/course-builder/courses-index.tsx",
  "utf8",
);
const newCoursePageSource = readFileSync(
  "src/app/(app)/courses/new/page.tsx",
  "utf8",
);
const appLayoutSource = readFileSync("src/app/(app)/layout.tsx", "utf8");
const primaryNavSource = readFileSync(
  "src/lib/navigation/primary-nav.ts",
  "utf8",
);

test("course builder client shares JSON request and workspace contracts", () => {
  assert.match(
    clientSource,
    /export async function courseBuilderRequest<T>[\s\S]*Content-Type[\s\S]*application\/json/,
  );
  assert.match(clientSource, /errorPayload\?\.loginRequired/);
  assert.match(
    clientSource,
    /export async function loadCourseWorkspace[\s\S]*Promise<CourseWorkspace>/,
  );
});

test("signed upload follows private Storage multipart contract", () => {
  assert.match(clientSource, /formData\.append\("cacheControl", "3600"\)/);
  assert.match(clientSource, /formData\.append\("", file, file\.name\)/);
  assert.match(clientSource, /"x-upsert": "false"/);
  assert.match(clientSource, /method: "PUT"/);
});

test("new course form exposes the complete persisted milestone flow", () => {
  for (const field of [
    "title",
    "subject",
    "goal",
    "level",
    "audienceDescription",
    "targetLessonCount",
    "teacherPreferences",
  ]) {
    assert.match(formSource, new RegExp(`name="${field}"`));
  }
  assert.match(formSource, /type="file"[\s\S]*multiple/);
  assert.match(formSource, /globalThis\.crypto\.subtle\.digest/);
  assert.match(formSource, />\s*Создать курс\s*</);
  assert.match(formSource, /Собрать черновик/);
  assert.match(formSource, /Прикреплён, не проанализирован/);
  assert.match(formSource, /assembleCourseDraft\(courseId\)/);
});

test("new course creation resumes the persisted Course after a partial failure", () => {
  const submitStart = formSource.indexOf("async function handleSubmit");
  const validateAt = formSource.indexOf(
    "const validatedFiles = selectedFiles.map(validateSelectedCourseFile);",
    submitStart,
  );
  const createAt = formSource.indexOf(
    "createCourseDraft(draftInput)",
    submitStart,
  );

  assert.ok(submitStart >= 0, "handleSubmit must remain present");
  assert.ok(validateAt >= submitStart, "selected files must be validated");
  assert.ok(
    validateAt < createAt,
    "file validation must run before Course persistence",
  );
  assert.match(
    formSource,
    /let courseId = createdCourseId;[\s\S]*?if \(!courseId\) \{[\s\S]*?createCourseDraft\(draftInput\)[\s\S]*?setCreatedCourseId\(courseId\)/,
  );
  assert.match(
    formSource,
    /for \(const selectedFile of validatedFiles\) \{[\s\S]*?uploadProgress\[selectedFile\.localId\]\?\.status === "ready"[\s\S]*?continue;[\s\S]*?uploadFile\(courseId, selectedFile\)/,
  );
  assert.match(formSource, /if \(isSubmitting\) return;/);
  assert.doesNotMatch(
    formSource,
    /if \(isSubmitting \|\| createdCourseId\) return;/,
  );

  const submitButtons = Array.from(
    formSource.matchAll(/<Button[\s\S]*?<\/Button>/g),
    (match) => match[0],
  ).filter((button) => /value="(?:create|assemble)"/.test(button));
  assert.equal(submitButtons.length, 2);
  for (const button of submitButtons) {
    assert.match(button, /disabled=\{isSubmitting\}/);
    assert.doesNotMatch(button, /createdCourseId/);
  }

  assert.match(
    formSource,
    /createdCourseId \? \([\s\S]*?toCourseRoute\(createdCourseId\)/,
  );
});

test("courses pages read persisted data inside the roleless Account tree", () => {
  assert.match(coursesPageSource, /<CoursesIndex \/>/);
  assert.match(coursesIndexSource, /courseBuilderRequest/);
  assert.match(coursesIndexSource, /\/api\/v2\/courses/);
  assert.match(coursesIndexSource, /toCourseRoute\(course\.id\)/);
  assert.match(newCoursePageSource, /<NewCourseForm \/>/);
  assert.match(appLayoutSource, /resolveAppLayoutRedirect/);
  assert.doesNotMatch(appLayoutSource, /activeProfile !== "teacher"/);
  assert.match(primaryNavSource, /label: "Курсы"/);
  assert.match(primaryNavSource, /href: ROUTES\.courses/);

  const combined = `${clientSource}\n${formSource}\n${coursesPageSource}\n${coursesIndexSource}`;
  assert.doesNotMatch(combined, /localStorage/);
  assert.doesNotMatch(combined, /fixtures?/i);
});
