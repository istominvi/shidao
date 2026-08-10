import assert from "node:assert/strict";
import test from "node:test";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import {
  CoursePublicationMutationInFlightError,
  CoursePublicationMutationRateLimitError,
  publicationRepositoryFailure,
} from "./errors";

test("raw stale snapshot database tokens become a friendly conflict", () => {
  const error = publicationRepositoryFailure({
    message: "course_publication_publish_snapshot_mismatch",
    status: 400,
    databaseCode: "P0001",
    definitelyNotCommitted: true,
  });
  assert.equal(error.status, 409);
  assert.equal(error.code, "course_publication_source_changed");
  assert.match(error.message, /Курс изменился/);
  assert.doesNotMatch(error.message, /snapshot_mismatch/);
});

test("live idempotent and component payload mismatches use the stale-course conflict", () => {
  for (const message of [
    "course_publication_idempotent_assets_mismatch",
    "course_publication_component_payload_mismatch",
  ]) {
    const error = publicationRepositoryFailure({
      message,
      status: 400,
      databaseCode: "P0001",
      definitelyNotCommitted: true,
    });
    assert.equal(error.status, 409);
    assert.equal(error.code, "course_publication_source_changed");
    assert.match(error.message, /Курс изменился/);
    assert.doesNotMatch(error.message, /mismatch|course_publication_/);
  }
});

test("network ambiguity is not marked safe for Storage cleanup", () => {
  const error = publicationRepositoryFailure({
    message: "course_publication_network_error",
    status: 503,
    databaseCode: "repository_network_error",
  });
  assert.equal(error.definitelyNotCommitted, false);
});

test("account publication quota becomes a friendly conflict", () => {
  const error = publicationRepositoryFailure({
    message: "course_publication_account_quota_exceeded",
    status: 400,
    databaseCode: "P0001",
    definitelyNotCommitted: true,
  });
  assert.equal(error.status, 409);
  assert.equal(error.code, "course_publication_account_quota_exceeded");
  assert.match(error.message, /Лимит хранения/);
  assert.doesNotMatch(error.message, /quota_exceeded|course_publication_/);
});

test("course API exposes stable mutation rate and in-flight responses", async () => {
  const limited = await courseBuilderApiError(
    new CoursePublicationMutationRateLimitError(17),
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "17");
  assert.deepEqual(await limited.json(), {
    error: "Слишком много операций с публикациями. Попробуйте немного позже.",
    code: "course_publication_mutation_rate_limited",
  });

  const inFlight = await courseBuilderApiError(
    new CoursePublicationMutationInFlightError(),
  );
  assert.equal(inFlight.status, 409);
  assert.equal(inFlight.headers.get("Retry-After"), null);
  assert.deepEqual(await inFlight.json(), {
    error: "Для этого аккаунта уже выполняется операция с публикацией.",
    code: "course_publication_mutation_in_flight",
  });
});

test("course API maps publication database failures without exposing SQL tokens", async () => {
  for (const [message, expectedStatus] of [
    ["course_publication_source_changed", 409],
    ["course_publication_not_found", 404],
    ["course_publication_asset_manifest_invalid", 400],
  ] as const) {
    const response = await courseBuilderApiError(
      publicationRepositoryFailure({
        message,
        status: 400,
        databaseCode: "P0001",
        definitelyNotCommitted: true,
      }),
    );
    const payload = (await response.json()) as {
      error: string;
      code: string;
    };
    assert.equal(response.status, expectedStatus);
    assert.doesNotMatch(payload.error, /course_publication_|source_changed/);
    assert.match(payload.error, /[А-Яа-яЁё]/);
  }
});
