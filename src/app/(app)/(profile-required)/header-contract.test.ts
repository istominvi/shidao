import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const studentNewPageSource = readFileSync(
  "src/app/(app)/(profile-required)/students/new/page.tsx",
  "utf8",
);

const communicationPageSource = readFileSync(
  "src/app/(app)/(profile-required)/groups/[groupId]/students/[studentId]/communication/page.tsx",
  "utf8",
);

const methodologyLessonPageSource = readFileSync(
  "src/app/(app)/(profile-required)/methodologies/[methodologySlug]/lessons/[lessonId]/page.tsx",
  "utf8",
);
const scheduledLessonPageSource = readFileSync(
  "src/app/(app)/(profile-required)/lessons/[scheduledLessonId]/page.tsx",
  "utf8",
);
const teacherWorkspaceSource = readFileSync(
  "src/components/lessons/teacher-lesson-workspace.tsx",
  "utf8",
);
const learnerViewSource = readFileSync(
  "src/components/lessons/scheduled-lesson-learner-view.tsx",
  "utf8",
);
const dashboardPageSource = readFileSync(
  "src/app/(app)/(profile-required)/dashboard/page.tsx",
  "utf8",
);
const teacherDashboardSource = readFileSync(
  "src/components/dashboard/teacher-dashboard.tsx",
  "utf8",
);
const lessonsPageSource = readFileSync(
  "src/app/(app)/(profile-required)/lessons/page.tsx",
  "utf8",
);
const teacherLessonsHubSource = readFileSync(
  "src/components/lessons/teacher-lessons-hub.tsx",
  "utf8",
);
const lessonsDemoPageSource = readFileSync(
  "src/app/(app)/(profile-required)/lessons/demo/page.tsx",
  "utf8",
);

function countOccurrences(source: string, token: string) {
  return source.split(token).length - 1;
}

test("methodology lesson page uses shared canonical AppPageHeader", () => {
  assert.equal(methodologyLessonPageSource.includes("<AppPageHeader"), true);
  assert.equal(methodologyLessonPageSource.includes("<h1"), false);
  assert.equal(methodologyLessonPageSource.includes('eyebrow="Урок методики"'), true);
  assert.equal(methodologyLessonPageSource.includes("lessonEssence"), true);
});

test("student creation page uses shared canonical AppPageHeader", () => {
  assert.equal(studentNewPageSource.includes("<AppPageHeader"), true);
  assert.equal(studentNewPageSource.includes("text-3xl font-black"), false);
  assert.equal(
    studentNewPageSource.includes("text-[11px] font-semibold uppercase"),
    false,
  );
});

test("student communication page removes manual header hero and uses shared header", () => {
  assert.equal(communicationPageSource.includes("<AppPageHeader"), true);
  assert.equal(
    communicationPageSource.includes('<header className="landing-surface'),
    false,
  );
  assert.equal(communicationPageSource.includes("<h1"), false);
});

test("scheduled lesson route owns canonical headers for teacher/student/parent/preview contexts", () => {
  assert.equal(countOccurrences(scheduledLessonPageSource, "<AppPageHeader"), 4);
  assert.equal(
    scheduledLessonPageSource.includes("teacherView.workspace.presentation.hero.lessonTitle"),
    true,
  );
  assert.equal(scheduledLessonPageSource.includes("backHref={ROUTES.dashboard}"), true);
  assert.equal(scheduledLessonPageSource.includes("toMethodologyLessonRoute"), true);
});

test("nested lesson components are headerless body surfaces", () => {
  assert.equal(teacherWorkspaceSource.includes("AppPageHeader"), false);
  assert.equal(teacherWorkspaceSource.includes("<h1"), false);
  assert.equal(learnerViewSource.includes("AppPageHeader"), false);
  assert.equal(learnerViewSource.includes("<h1"), false);
});

test("dashboard and lessons index pages own headers at route level", () => {
  assert.equal(dashboardPageSource.includes("<AppPageHeader"), true);
  assert.equal(teacherDashboardSource.includes("AppPageHeader"), false);
  assert.equal(lessonsPageSource.includes("<AppPageHeader"), true);
  assert.equal(teacherLessonsHubSource.includes("AppPageHeader"), false);
});

test("lessons demo route uses canonical header in failure surface", () => {
  assert.equal(lessonsDemoPageSource.includes("<AppPageHeader"), true);
  assert.equal(lessonsDemoPageSource.includes("<h1"), false);
});
