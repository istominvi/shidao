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

test("Schedule and Students are full-width while Courses keep the 12px inset", () => {
  assert.match(
    globalStyles,
    /\.course-demo-shell\s*\{[^}]*--course-demo-content-inset: 0\.75rem;/,
  );
  assert.match(
    globalStyles,
    /\.compact-page-toolbar\s*\{[^}]*width: 100%;[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*background: transparent;[^}]*padding-block: 0;[^}]*padding-inline: var\(--course-demo-content-inset, 0\.75rem\);/,
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
});

test("full-width toolbars preserve contained responsive control rails", () => {
  assert.match(
    globalStyles,
    /@media \(max-width: 900px\)[\s\S]*?\.compact-page-toolbar\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/,
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
