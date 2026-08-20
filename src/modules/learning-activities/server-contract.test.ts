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
});

test("history adapters can reuse one authenticated actor without a second session context", () => {
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
    assert.doesNotMatch(
      historyRoute,
      /createLearningActivitiesRepository|lesson_component_observation|\/rest\/v1/,
    );
  }
});
