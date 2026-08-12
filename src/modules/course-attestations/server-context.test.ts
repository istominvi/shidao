import assert from "node:assert/strict";
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
