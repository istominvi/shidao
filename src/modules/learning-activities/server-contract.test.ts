import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  "src/app/api/v2/lesson-runs/[lessonRunId]/observations/route.ts",
  "utf8",
);
const clientBoundary = readFileSync(
  "src/modules/learning-activities/repository.ts",
  "utf8",
);
const serverContext = readFileSync(
  "src/modules/learning-activities/server-context.ts",
  "utf8",
);
const historyRoutes = [
  "src/app/api/v2/courses/[courseId]/history/route.ts",
  "src/app/api/v2/lessons/[lessonId]/history/route.ts",
  "src/app/api/v2/learner-profiles/[learnerProfileId]/history/route.ts",
].map((path) => readFileSync(path, "utf8"));

test("run observation API is a thin authenticated application-service adapter", () => {
  assert.match(route, /export async function GET/);
  assert.match(route, /service\.getRunWorkspace\(actor, lessonRunId\)/);
  assert.match(route, /export async function PUT/);
  assert.match(route, /service\.saveRunObservations\(/);
  assert.match(route, /await readJson\(request\)/);
  assert.match(route, /courseBuilderApiError\(error\)/);
  assert.doesNotMatch(
    route,
    /\/rest\/v1|lesson_component_observation\?|save_lesson_component_observations/,
  );
});

test("browser-facing code cannot write the observation table directly", () => {
  assert.match(
    clientBoundary,
    /\/rest\/v1\/rpc\/save_lesson_component_observations/,
  );
  assert.doesNotMatch(
    clientBoundary,
    /request<[^>]+>\(\s*`?\/rest\/v1\/lesson_component_observation[^\n]*\{\s*method:\s*"(?:POST|PATCH|DELETE)"/,
  );
  for (const column of [
    "learning_objective_id",
    "source_learning_objective_id_at_time",
    "learning_objective_title_at_time",
  ]) {
    assert.match(clientBoundary, new RegExp(`"${column}"`));
  }
  const saveBoundary =
    /async saveRunObservations\(input\)[\s\S]*?\n\s*},\n\n\s*correctFinalizedObservation/.exec(
      clientBoundary,
    )?.[0] ?? "";
  assert.ok(saveBoundary);
  assert.doesNotMatch(
    saveBoundary,
    /p_(?:learning_objective_id|source_learning_objective_id_at_time|learning_objective_title_at_time)/,
  );
});

test("history adapters preserve existing observations when evidence is unavailable", () => {
  assert.match(
    serverContext,
    /export function createLearningActivitiesServiceForActor/,
  );
  assert.match(
    serverContext,
    /createLearningActivitiesRepository\(actor\.accessToken\)/,
  );
  assert.match(
    serverContext,
    /service: createLearningActivitiesServiceForActor\(actor\)/,
  );
  for (const historyRoute of historyRoutes) {
    assert.match(historyRoute, /\.listHistoryObservations\(/);
    assert.match(historyRoute, /\.listHistoryCorrections\(/);
    assert.match(historyRoute, /\.listHistoryEvidence\(/);
    assert.match(historyRoute, /const learningActivities =/);
    assert.match(historyRoute, /Promise\.allSettled\(/);
    assert.match(
      historyRoute,
      /observationsResult\.status === "rejected"[\s\S]*?throw observationsResult\.reason/,
    );
    assert.match(
      historyRoute,
      /const evidenceUnavailable = evidenceResult\.status === "rejected"/,
    );
    assert.match(
      historyRoute,
      /const correctionsUnavailable = correctionsResult\.status === "rejected"/,
    );
    assert.match(
      historyRoute,
      /const evidence =[\s\S]*?evidenceResult\.status === "fulfilled" \? evidenceResult\.value : \[\]/,
    );
    assert.match(
      historyRoute,
      /observations: observationsResult\.value,[\s\S]*?corrections:[\s\S]*?correctionsTruncated:[\s\S]*?correctionsUnavailable,[\s\S]*?evidence,[\s\S]*?evidenceUnavailable,/,
    );
    assert.doesNotMatch(
      historyRoute,
      /correctionsResult\.status === "rejected"[\s\S]*?throw correctionsResult\.reason/,
    );
    assert.doesNotMatch(
      historyRoute,
      /createLearningActivitiesRepository|lesson_component_observation|\/rest\/v1/,
    );
  }
});
