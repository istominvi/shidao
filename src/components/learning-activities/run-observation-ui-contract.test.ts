import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source(
  "src/app/(app)/courses/[courseId]/runs/[lessonRunId]/page.tsx",
);
const pageClient = source(
  "src/components/learning-activities/run-observation-page-client.tsx",
);
const client = source(
  "src/components/learning-activities/run-observation-client.ts",
);
const workspace = source(
  "src/components/learning-activities/run-observation-workspace.tsx",
);
const format = source(
  "src/components/learning-activities/observation-format.ts",
);
const styles = source(
  "src/components/learning-activities/run-observation-workspace.module.css",
);
const runHistory = source("src/components/lesson-runs/run-history-list.tsx");
const learnerHistory = source(
  "src/components/lesson-runs/learner-history-dialog.tsx",
);

test("LessonRun route loads the teacher-only observation workspace", () => {
  assert.match(route, /className="app-page-shell pb-12"/);
  assert.match(route, /<RunObservationPageClient/);
  assert.match(pageClient, /<AppPageHeader/);
  assert.match(pageClient, /<RunObservationWorkspace/);
  assert.match(pageClient, /ref=\{workspaceRef\}/);
  assert.match(
    pageClient,
    /await workspaceRef\.current\?\.flushPendingChanges/,
  );
  assert.match(pageClient, /type: "button"/);
  assert.match(pageClient, /<LessonRunDialog/);
  assert.match(pageClient, /workspace\.run\.courseId !== courseId/);

  assert.match(
    client,
    /\/api\/v2\/lesson-runs\/\$\{encodeURIComponent\(lessonRunId\)\}\/observations/,
  );
  assert.match(client, /method: "PUT"/);
  assert.match(client, /Promise<RunObservationWorkspace>/);
  assert.match(client, /Promise<LessonComponentObservation\[]>/);
  assert.doesNotMatch(
    client + pageClient + workspace,
    /localStorage|indexedDB/i,
  );
});

test("workspace preserves canonical component order and gates writes to a real active Run", () => {
  assert.match(
    workspace,
    /workspace\.lesson\.components[\s\S]*?left\.position - right\.position/,
  );
  assert.match(workspace, /<CourseComponentRenderer/);
  assert.match(workspace, /mode="teacher"/);
  assert.match(workspace, /workspace\.attachments\.map/);
  assert.match(
    workspace,
    /workspace\.run\.startedAt && workspace\.run\.startedAtIsActual === true/,
  );
  assert.match(
    workspace,
    /workspace\.run\.endedAt \|\| workspace\.run\.cancelledAt/,
  );
  assert.match(workspace, /aria-current=\{active \? "true" : undefined\}/);
  assert.doesNotMatch(workspace, /aria-current=\{active \? "step"/);
});

test("criterion, direct saves, notes, and confirmed bulk draft are explicit", () => {
  assert.match(workspace, /Что именно наблюдаем\?/);
  assert.match(workspace, /Подтвердить/);
  assert.match(workspace, /criterionIsConfirmed/);
  assert.match(workspace, /entryMethod: "direct"/);
  assert.match(workspace, /setTimeout\(\(\) =>/);
  assert.match(workspace, /Заметка ожидает сохранения/);
  assert.match(workspace, /onBlur=\{\(\) => \{/);
  assert.match(workspace, /void flushPendingNote\(key\)/);
  assert.match(workspace, /await flushPendingChanges\(\)/);
  assert.match(workspace, /useImperativeHandle/);
  assert.match(workspace, /window\.addEventListener\("beforeunload"/);
  assert.match(workspace, /pendingMutationCountRef\.current/);
  assert.doesNotMatch(
    workspace,
    /onBlur[\s\S]{0,300}scheduleNoteSave\([\s\S]{0,100},\s*0\s*,?\s*\)/,
  );
  assert.match(workspace, /Массовый черновик — ещё не сохранён/);
  assert.match(workspace, /entryMethod: "bulk_confirmed"/);
  assert.match(workspace, /Подтвердить \{records\.length\} отметок/);

  for (const rating of [
    "independent",
    "with_support",
    "not_yet",
    "Не наблюдал",
  ]) {
    assert.match(format, new RegExp(rating));
  }
});

test("teacher workspace and histories expose objective context without trusting save input", () => {
  assert.match(workspace, /workspace\.learningObjectives\.find/);
  assert.match(workspace, /Учебная цель компонента/);
  assert.match(workspace, /только в контексте компонента/);
  assert.doesNotMatch(workspace, /learningObjectiveId:\s*activeComponent/);
  assert.match(runHistory, /observationObjectiveTitleAtTime/);
  assert.match(learnerHistory, /observationObjectiveTitleAtTime/);
  assert.match(runHistory, /Учебная цель в момент наблюдения/);
  assert.match(learnerHistory, /Учебная цель в момент наблюдения/);
  assert.match(runHistory, /objectiveTitle \?/);
  assert.match(learnerHistory, /objectiveTitle \?/);
});

test("summary precedes completion and the control surface remains tablet accessible", () => {
  assert.ok(
    workspace.indexOf("<ObservationHistorySummary") <
      workspace.indexOf("<footer className={styles.completionPanel}"),
  );
  assert.match(workspace, /role="status"/);
  assert.match(workspace, /aria-live="polite"/);
  assert.match(workspace, /Повторить/);
  assert.match(styles, /\.ratingOption[\s\S]*?min-height: 3\.25rem/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /:has\(input:focus-visible\)/);
  assert.match(styles, /@media \(max-width: 1024px\)/);
  assert.match(styles, /@media \(max-width: 767px\)/);
});
