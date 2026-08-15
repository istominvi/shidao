import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function between(value: string, start: string, end: string) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `Missing source boundary: ${start}`);
  assert.ok(endIndex > startIndex, `Missing source boundary: ${end}`);
  return value.slice(startIndex, endIndex);
}

test("Schedule resolves its local date after hydration and then reuses a warm summary", () => {
  const schedule = source("src/components/teaching-hub/schedule-workspace.tsx");

  assert.match(schedule, /useState<Date \| null>\(null\)/);
  assert.match(
    schedule,
    /useEffect\(\(\) => \{\s*setSelectedDate\(atLocalNoon\(new Date\(\)\)\);\s*\}, \[\]\);/,
  );
  assert.match(
    schedule,
    /useEffect\(\(\) => \{\s*if \(!selectedDate\) return;/,
  );
  assert.match(
    schedule,
    /const selectedScheduleRange = selectedDate\s*\? schedulePeriodRange\(selectedDate, period\)\s*: null;/,
  );
  assert.match(
    schedule,
    /selectedDate && cachedScheduleSummary[\s\S]*?cachedScheduleSummary\.visibleRunCount/,
  );
  assert.match(
    schedule,
    /const headerMetricPending =[\s\S]*?selectedDate === null \|\| runs === null \|\| primaryHeaderSummaryPending/,
  );
  assert.match(
    schedule,
    /\{selectedDate \? \([\s\S]*?<ScheduleDatePicker[\s\S]*?selectedDate=\{selectedDate\}[\s\S]*?\) : null\}/,
  );
  assert.doesNotMatch(schedule, /useState<Date>\(\(\) =>/);
  assert.doesNotMatch(
    schedule,
    /selectedDate \?\? atLocalNoon\(new Date\(\)\)/,
  );
  assert.ok(
    schedule.indexOf("<AppPageHeader") <
      schedule.indexOf("{selectedDate ? (\n            <ScheduleDatePicker"),
    "The known Schedule title and action must render before the hydrated date control",
  );
});

test("Course LessonRun changes refresh header summaries without coupling generic edits", () => {
  const workspace = source(
    "src/components/course-builder/course-workspace.tsx",
  );
  const authoring = source(
    "src/components/course-builder/lesson-authoring-workspace.tsx",
  );
  const dialog = source("src/components/lesson-runs/lesson-run-dialog.tsx");

  assert.match(workspace, /usePrimaryHeaderSummary\(\)/);
  assert.equal(
    workspace.match(/onScheduleSummaryChanged=\{refreshPrimaryHeaderSummary\}/g)
      ?.length,
    2,
  );
  assert.match(
    workspace,
    /function CourseLessonsPanel[\s\S]*?onScheduleSummaryChanged: \(\) => void;[\s\S]*?<LessonRunDialog[\s\S]*?onScheduleSummaryChanged=\{onScheduleSummaryChanged\}/,
  );
  assert.match(
    authoring,
    /onScheduleSummaryChanged\?: \(\) => void;[\s\S]*?<LessonRunDialog[\s\S]*?onScheduleSummaryChanged=\{onScheduleSummaryChanged\}/,
  );

  const saveSchedule = between(
    dialog,
    "async function saveSchedule()",
    "async function start()",
  );
  const start = between(
    dialog,
    "async function start()",
    "async function cancel()",
  );
  const cancel = between(
    dialog,
    "async function cancel()",
    "async function complete()",
  );
  const complete = between(dialog, "async function complete()", "return (");

  for (const summaryChangingMutation of [saveSchedule, cancel, complete]) {
    assert.match(summaryChangingMutation, /onScheduleSummaryChanged\?\.\(\)/);
  }
  assert.doesNotMatch(start, /onScheduleSummaryChanged/);

  const genericCourseMutation = between(
    workspace,
    "const runMutation = useCallback<RunMutation>",
    "const selectedLesson =",
  );
  assert.doesNotMatch(genericCourseMutation, /refreshPrimaryHeaderSummary/);
});
