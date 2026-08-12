import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalStyles = readFileSync("src/app/globals.css", "utf8");
const teachingHubStyles = readFileSync(
  "src/app/styles/teaching-hub.css",
  "utf8",
);
const scheduleWorkspace = readFileSync(
  "src/components/teaching-hub/schedule-workspace.tsx",
  "utf8",
);
const studentsWorkspace = readFileSync(
  "src/components/teaching-hub/students-workspace.tsx",
  "utf8",
);
const ownedCoursesPanel = readFileSync(
  "src/components/course-builder/owned-courses-panel.tsx",
  "utf8",
);
const courseCatalogPanel = readFileSync(
  "src/components/course-builder/course-catalog-panel.tsx",
  "utf8",
);
const courseWorkspace = readFileSync(
  "src/components/course-builder/course-workspace.tsx",
  "utf8",
);

test("Schedule, Students, Courses, and Course Lessons toolbars are full-width", () => {
  assert.match(
    globalStyles,
    /\.course-demo-shell\s*\{[^}]*--course-demo-content-inset: 0\.75rem;/,
  );
  assert.match(
    globalStyles,
    /\.compact-page-toolbar\s*\{[^}]*width: 100%;[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*background: transparent;[^}]*padding-block: 0;[^}]*padding-inline: 0;/,
  );
  assert.match(
    teachingHubStyles,
    /\.teaching-hub-toolbar\s*\{[^}]*min-width: 0;[^}]*justify-content: flex-end;[^}]*padding-inline: 0;/,
  );
  assert.match(
    teachingHubStyles,
    /\.student-directory-toolbar\s*\{[^}]*width: 100%;[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*background: transparent;[^}]*padding-block: 0;[^}]*padding-inline: 0;/,
  );
  assert.match(
    teachingHubStyles,
    /\.student-directory-toolbar\.compact-page-toolbar\s*\{[^}]*padding-inline: 0;/,
  );

  assert.match(scheduleWorkspace, /className="teaching-hub-toolbar"/);
  assert.match(
    studentsWorkspace,
    /className="student-directory-toolbar compact-page-toolbar"/,
  );
  assert.match(
    ownedCoursesPanel,
    /className="compact-page-toolbar course-index-toolbar"/,
  );
  assert.match(
    courseCatalogPanel,
    /className="compact-page-toolbar course-catalog-toolbar"/,
  );
  assert.match(
    courseCatalogPanel,
    /className="course-catalog-toolbar-main"[\s\S]*?\{learningAudienceControl\}[\s\S]*?className="compact-toolbar-search product-search-wrap"/,
  );
  assert.match(
    globalStyles,
    /\.course-catalog-toolbar-main\s*\{[^}]*display: flex;[^}]*min-width: 0;[^}]*flex: 1 1 auto;[^}]*align-items: center;/,
  );
  assert.match(
    courseWorkspace,
    /className="compact-page-toolbar course-lessons-toolbar"[\s\S]*?aria-label="Управление уроками"/,
  );
  assert.match(
    courseWorkspace,
    /className="compact-toolbar-search product-search-wrap"[\s\S]*?Поиск уроков[\s\S]*?placeholder="Название или описание урока…"/,
  );
  assert.match(
    courseWorkspace,
    /className="compact-toolbar-rail"[\s\S]*?>\s*Добавить урок\s*</,
  );
  assert.doesNotMatch(
    globalStyles,
    /\.compact-page-toolbar\s*\{[^}]*padding-inline: var\(--course-demo-content-inset/,
  );
});

test("full-width toolbars preserve contained responsive control rails", () => {
  assert.match(
    globalStyles,
    /@media \(max-width: 900px\)[\s\S]*?\.compact-page-toolbar\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(
    globalStyles,
    /@media \(max-width: 900px\)[\s\S]*?\.course-catalog-toolbar-main\s*\{[^}]*width: 100%;[^}]*flex-wrap: wrap;/,
  );
  assert.match(
    teachingHubStyles,
    /@media \(max-width: 900px\)[\s\S]*?\.teaching-schedule-toolbar-actions\s*\{[^}]*width: 100%;[^}]*max-width: 100%;[^}]*flex-wrap: nowrap;/,
  );
  assert.match(
    teachingHubStyles,
    /@media \(max-width: 900px\)[\s\S]*?\.student-directory-toolbar \.student-directory-controls\s*\{[^}]*width: 100%;[^}]*justify-content: flex-start;[^}]*overflow: visible;[^}]*flex-wrap: wrap;[^}]*padding: 0;/,
  );
});
