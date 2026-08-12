import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CourseAttestationRepositoryError } from "./repository";
import { courseAttestationApiError } from "./server-context";

test("stale attestation revision becomes a reloadable conflict", async () => {
  const response = await courseAttestationApiError(
    new CourseAttestationRepositoryError(
      "course_attestation_revision_stale",
      400,
      "40001",
    ),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Курс обновлён, загрузите аттестацию заново.",
    code: "attestation_revision_stale",
  });
});

test("attestation attempt throttle preserves a bounded retry contract", async () => {
  const response = await courseAttestationApiError(
    new CourseAttestationRepositoryError(
      "course_attestation_attempt_rate_limited",
      400,
      "P0004",
    ),
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "900");
  assert.deepEqual(await response.json(), {
    error: "Слишком много попыток аттестации. Попробуйте снова через 15 минут.",
    code: "attestation_attempt_rate_limited",
  });
});

test("incomplete lessons stay a product conflict for attestation GET and POST", async () => {
  const route = readFileSync(
    "src/app/api/v2/course-catalog/[publicationId]/attestation/route.ts",
    "utf8",
  );

  for (const method of ["GET", "POST"] as const) {
    const methodStart = route.indexOf(`export async function ${method}`);
    assert.notEqual(methodStart, -1, `${method} route is missing`);
    const nextMethodStart = route.indexOf(
      "export async function",
      methodStart + 1,
    );
    const methodSource = route.slice(
      methodStart,
      nextMethodStart === -1 ? undefined : nextMethodStart,
    );
    assert.match(methodSource, /return courseAttestationApiError\(error\)/);

    const response = await courseAttestationApiError(
      new CourseAttestationRepositoryError(
        "course_attestation_lessons_incomplete",
        500,
        "55000",
      ),
    );
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "Завершите все уроки курса перед аттестацией.",
      code: "attestation_lessons_incomplete",
    });
  }
});

test("revoked educator authoring capability stays a stable forbidden response", async () => {
  const response = await courseAttestationApiError(
    new CourseAttestationRepositoryError(
      "educator_course_authoring_not_allowed",
      403,
      "42501",
    ),
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Редактирование аттестации недоступно этому аккаунту.",
    code: "educator_course_authoring_denied",
  });
});

test("invalid attestation RPC output stays inside the attestation error contract", async () => {
  const response = await courseAttestationApiError(
    new CourseAttestationRepositoryError(
      "list_my_course_publication_attestations_response_invalid",
      502,
      null,
    ),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Сервис аттестации временно недоступен.",
    code: "attestation_unavailable",
  });
});
