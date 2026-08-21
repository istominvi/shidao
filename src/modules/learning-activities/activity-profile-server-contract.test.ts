import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "@/modules/course-builder/contracts";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import { learningActivityProfileApiError } from "./server-context";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const teacherRoute = source(
  "src/app/api/v2/learner-profiles/[learnerProfileId]/activity-profile/route.ts",
);
const correctionRoute = source(
  "src/app/api/v2/learner-profiles/[learnerProfileId]/activity-profile/corrections/route.ts",
);
const overrideRoute = source(
  "src/app/api/v2/learner-profiles/[learnerProfileId]/activity-profile/recommendation-overrides/route.ts",
);
const selfRoute = source(
  "src/app/api/v2/me/learning-profile/activity-profile/route.ts",
);
const observerRoute = source(
  "src/app/api/v2/observations/[learnerProfileId]/activity-profile/route.ts",
);
const serverContext = source(
  "src/modules/learning-activities/server-context.ts",
);

test("activity-profile APIs remain thin authenticated application-service adapters", () => {
  assert.match(teacherRoute, /export async function GET/);
  assert.match(
    teacherRoute,
    /resolveTeacherLearnerAlias[\s\S]*?getTeacherLearnerActivityProfile\(actor, resolvedLearnerProfileId\)/,
  );
  assert.match(correctionRoute, /export async function POST/);
  assert.match(correctionRoute, /resolveTeacherLearnerAlias/);
  assert.match(
    correctionRoute,
    /\.correctFinalizedObservation\([\s\S]*?actor,[\s\S]*?resolvedLearnerProfileId,[\s\S]*?await readJson\(request\)/,
  );
  assert.match(correctionRoute, /await readJson\(request\)/);
  assert.match(overrideRoute, /export async function PUT/);
  assert.match(overrideRoute, /resolveTeacherLearnerAlias/);
  assert.match(
    overrideRoute,
    /\.setRecommendationOverride\([\s\S]*?actor,[\s\S]*?resolvedLearnerProfileId,[\s\S]*?await readJson\(request\)/,
  );
  assert.match(overrideRoute, /await readJson\(request\)/);

  assert.match(selfRoute, /service\.getMyActivityProfile\(actor\)/);
  assert.match(
    observerRoute,
    /service\.getObservedActivityProfile\([\s\S]*?actor,[\s\S]*?learnerProfileId/,
  );
  for (const route of [
    teacherRoute,
    correctionRoute,
    overrideRoute,
    selfRoute,
    observerRoute,
  ]) {
    assert.match(route, /learningActivityProfileApiError/);
    assert.doesNotMatch(route, /courseBuilderApiError/);
  }
  assert.match(serverContext, /learning_activity_profile_not_found/);
  assert.match(serverContext, /learning_activity_profile_unavailable/);
  assert.match(serverContext, /status: 404/);
  assert.match(serverContext, /status: 503/);
  assert.match(serverContext, /status: 409/);
  assert.match(serverContext, /status: 401/);

  for (const route of [
    teacherRoute,
    correctionRoute,
    overrideRoute,
    selfRoute,
    observerRoute,
  ]) {
    assert.doesNotMatch(
      route,
      /\/rest\/v1|learning_evidence\?|learner_objective_state\?|recommendation_override\?/,
    );
  }
});

test("activity-profile error boundary keeps safe statuses without repository messages", async () => {
  const validation = await learningActivityProfileApiError(
    new CourseBuilderValidationError("Проверьте причину исправления."),
  );
  assert.equal(validation.status, 400);
  assert.deepEqual(await validation.json(), {
    error: "Проверьте причину исправления.",
    code: "validation_error",
  });

  const conflict = await learningActivityProfileApiError(
    new CourseBuilderConflictError(
      "duplicate key value violates unique constraint private_table_key",
      "raw_database_conflict",
    ),
  );
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), {
    error:
      "Учебный профиль уже изменился. Обновите данные и повторите действие.",
    code: "learning_activity_profile_conflict",
  });

  for (const accessError of [
    new CourseBuilderAccessError("select * from private_learning_activity"),
    new CourseBuilderRepositoryError(
      "permission denied for table private_learning_activity",
      403,
      "42501",
    ),
    new CourseBuilderRepositoryError(
      "relation private_learning_activity does not exist",
      404,
      "42P01",
    ),
  ]) {
    const response = await learningActivityProfileApiError(accessError);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      error: "Учебный профиль не найден или недоступен.",
      code: "learning_activity_profile_not_found",
    });
    assert.doesNotMatch(
      JSON.stringify(body),
      /private_learning_activity|42P01|42501/,
    );
  }

  for (const upstreamError of [
    new CourseBuilderRepositoryError(
      "invalid input syntax for type uuid: private-value",
      400,
      "22P02",
    ),
    new CourseBuilderRepositoryError(
      "PostgREST transaction conflict: private-value",
      409,
      "PGRST409",
    ),
    new Error("connect ECONNREFUSED private-database"),
  ]) {
    const response = await learningActivityProfileApiError(upstreamError);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.deepEqual(body, {
      error: "Учебный профиль временно недоступен.",
      code: "learning_activity_profile_unavailable",
    });
    assert.doesNotMatch(
      JSON.stringify(body),
      /private-value|private-database|22P02|PGRST409/,
    );
  }
});

test("teacher writes are explicit while learner and observer endpoints stay read-only", () => {
  assert.doesNotMatch(
    teacherRoute,
    /export async function (?:POST|PUT|PATCH|DELETE)/,
  );
  assert.doesNotMatch(
    selfRoute,
    /export async function (?:POST|PUT|PATCH|DELETE)/,
  );
  assert.doesNotMatch(
    observerRoute,
    /export async function (?:POST|PUT|PATCH|DELETE)/,
  );
  assert.match(correctionRoute, /result:/);
  assert.match(overrideRoute, /result:/);
});
