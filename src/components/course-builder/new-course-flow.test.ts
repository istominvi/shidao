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
const materialFileSource = readFileSync(
  "src/components/course-builder/course-material-file.ts",
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
const ownedCoursesSource = readFileSync(
  "src/components/course-builder/owned-courses-panel.tsx",
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

test("new course form exposes audience-aware pre-persistence workspaces", () => {
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
  assert.match(
    materialFileSource,
    /export async function calculateCourseFileSha256[\s\S]*globalThis\.crypto\.subtle\.digest/,
  );
  assert.match(formSource, /calculateCourseFileSha256\(normalizedFile\)/);
  assert.match(formSource, /useState<CourseWorkspaceSurface>\("about"\)/);
  assert.match(
    formSource,
    /<WorkspaceTabs[\s\S]*?ariaLabel="Разделы нового курса"[\s\S]*?items=\{workspaceTabs\}/,
  );
  for (const surface of ["lessons", "about", "materials", "history"]) {
    assert.match(
      formSource,
      new RegExp(
        `workspaceTabPanelId\\(NEW_COURSE_WORKSPACE_TABS_ID, "${surface}"\\)`,
      ),
    );
  }
  assert.match(formSource, /Уроки появятся после сохранения/);
  assert.match(formSource, /История появится после сохранения/);
  assert.match(formSource, /Аттестация появится после сохранения/);
  assert.match(formSource, /EDUCATOR_COURSE_WORKSPACE_TABS/);
  assert.match(formSource, /canAuthorEducatorCourses \? \(/);
  assert.match(
    formSource,
    /<form[\s\S]*?hidden=\{activeSurface !== "about"\}[\s\S]*?onSubmit=\{handleSubmit\}/,
  );
  assert.match(
    formSource,
    /hidden=\{activeSurface !== "materials"\}[\s\S]*?Выбрать файлы или изображения/,
  );
  assert.match(formSource, />\s*Сохранить курс\s*</);
  assert.match(formSource, /Собрать черновик/);
  assert.match(formSource, /Создать с ИИ/);
  assert.match(formSource, /Прикреплён, не проанализирован/);
  assert.match(formSource, /assembleCourseDraft\(courseId\)/);
  assert.match(formSource, /generateAiCoursePlan\(courseId/);
  assert.match(formSource, /applyAiCoursePlan\(createdCourseId, aiPreview\)/);
  assert.match(formSource, /updateCourseDraft\(courseId, draftInput\)/);
  assert.match(
    formSource,
    /const href =[\s\S]*?intent === "create"[\s\S]*?`\$\{toCourseRoute\(courseId\)\}\?tab=about`[\s\S]*?: toCourseRoute\(courseId\)[\s\S]*?pageTransition\.navigate\(href, \{ direction: "forward", replace: true \}\)[\s\S]*?router\.replace\(href\)/,
  );
  assert.match(
    formSource,
    /applyAiCoursePlan\(createdCourseId, aiPreview\)[\s\S]*?const href = toCourseRoute\(createdCourseId\)[\s\S]*?pageTransition\.navigate\(href, \{ direction: "forward", replace: true \}\)[\s\S]*?router\.replace\(href\)/,
  );
  assert.doesNotMatch(formSource, /router\.push\(/);
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
  ).filter((button) => /value="(?:create|assemble|ai)"/.test(button));
  assert.equal(submitButtons.length, 3);
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
  assert.match(
    coursesPageSource,
    /<CoursesIndex[\s\S]*?initialTab=\{initialTab\}/,
  );
  assert.match(ownedCoursesSource, /courseBuilderRequest/);
  assert.match(ownedCoursesSource, /\/api\/v2\/courses/);
  assert.match(ownedCoursesSource, /toCourseRoute\(course\.id\)/);
  assert.match(newCoursePageSource, /resolveAccessPolicy\(\)/);
  assert.match(
    newCoursePageSource,
    /<NewCourseForm[\s\S]*?canAuthorEducatorCourses=\{canAuthorEducatorCourses\}/,
  );
  assert.match(appLayoutSource, /resolveAppLayoutRedirect/);
  assert.doesNotMatch(appLayoutSource, /activeProfile !== "teacher"/);
  assert.match(primaryNavSource, /label: "Курсы"/);
  assert.match(primaryNavSource, /href: ROUTES\.courses/);

  const combined = `${clientSource}\n${formSource}\n${coursesPageSource}\n${coursesIndexSource}\n${ownedCoursesSource}`;
  assert.doesNotMatch(combined, /localStorage/);
  assert.doesNotMatch(combined, /fixtures?/i);
});
