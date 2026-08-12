import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const routePath = "src/app/api/v2/courses/[courseId]/attestation/route.ts";

test("educator owner attestation exposes capability-checked GET and PUT only", () => {
  assert.equal(existsSync(routePath), true);
  const route = readFileSync(routePath, "utf8");
  const context = readFileSync(
    "src/modules/course-attestations/server-context.ts",
    "utf8",
  );
  const service = readFileSync(
    "src/modules/course-attestations/service.ts",
    "utf8",
  );

  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PUT/);
  assert.doesNotMatch(route, /export async function POST/);
  assert.match(route, /getAuthoredCourseAttestation\(courseId\)/);
  assert.match(route, /replaceAuthoredCourseAttestation/);
  assert.match(route, /CourseAttestationApplicationError/);
  assert.match(context, /actor\.canAuthorEducatorCourses !== true/);
  assert.match(context, /course\.learningAudience !== "educators"/);
  assert.match(service, /requireAuthoredEducatorCourse/);
});
