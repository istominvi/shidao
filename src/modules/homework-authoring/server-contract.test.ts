import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  "src/app/api/v2/lessons/[lessonId]/homework/route.ts",
  "utf8",
);
const context = readFileSync(
  "src/modules/homework-authoring/server-context.ts",
  "utf8",
);
const repository = readFileSync(
  "src/modules/homework-authoring/repository.ts",
  "utf8",
);

test("Homework route is a narrow authenticated GET/PUT/DELETE adapter", () => {
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PUT/);
  assert.match(route, /export async function DELETE/);
  assert.doesNotMatch(route, /export async function (?:POST|PATCH)/);
  assert.equal(route.match(/getHomeworkAuthoringContext\(\)/g)?.length, 3);
  assert.match(route, /service\.get\(actor, lessonId\)/);
  assert.match(route, /service\.replace\([\s\S]*?await readJson\(request\)/);
  assert.match(
    route,
    /service\.clear\(actor, lessonId, await readJson\(request\)\)/,
  );
  assert.equal(route.match(/private, no-store/g)?.length, 4);
  assert.doesNotMatch(
    route,
    /lesson_homework|supabase|service_role|accountId|authUserId/i,
  );
});

test("server context derives owner authority from the active Course context", () => {
  assert.match(context, /getActiveCourseBuilderContext\(\)/);
  assert.match(context, /actor\.accessToken/);
  assert.match(context, /createHomeworkAuthoringRepository/);
  assert.match(context, /courseService/);
  assert.match(repository, /^import "server-only";/);
  assert.match(repository, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.doesNotMatch(repository, /SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey/);
  assert.doesNotMatch(
    repository,
    /\/rest\/v1\/(?:lesson_homework|lesson_homework_item)/,
  );
});
