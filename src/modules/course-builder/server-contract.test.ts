import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collectionRoute = readFileSync(
  "src/app/api/v2/courses/[courseId]/learning-objectives/route.ts",
  "utf8",
);
const itemRoute = readFileSync(
  "src/app/api/v2/courses/[courseId]/learning-objectives/[objectiveId]/route.ts",
  "utf8",
);

test("LearningObjective API routes are thin application-service adapters", () => {
  assert.match(collectionRoute, /export const runtime = "nodejs"/);
  assert.match(collectionRoute, /export async function POST/);
  assert.match(collectionRoute, /await getActiveCourseBuilderContext\(\)/);
  assert.match(
    collectionRoute,
    /service\.createLearningObjective\([\s\S]*?actor,[\s\S]*?courseId,[\s\S]*?await readJson\(request\)/,
  );
  assert.match(collectionRoute, /status: 201/);
  assert.match(collectionRoute, /courseBuilderApiError\(error\)/);

  assert.match(itemRoute, /export async function PATCH/);
  assert.match(itemRoute, /export async function DELETE/);
  assert.equal(
    itemRoute.match(/await getActiveCourseBuilderContext\(\)/g)?.length,
    2,
  );
  assert.match(
    itemRoute,
    /service\.updateLearningObjective\([\s\S]*?actor,[\s\S]*?courseId,[\s\S]*?objectiveId,[\s\S]*?await readJson\(request\)/,
  );
  assert.match(
    itemRoute,
    /service\.archiveLearningObjective\([\s\S]*?actor,[\s\S]*?courseId,[\s\S]*?objectiveId/,
  );
  assert.equal(itemRoute.match(/courseBuilderApiError\(error\)/g)?.length, 2);

  const combined = `${collectionRoute}\n${itemRoute}`;
  assert.doesNotMatch(combined, /repository|supabase|postgres|fetch\(/i);
  assert.doesNotMatch(combined, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
