import assert from "node:assert/strict";
import test from "node:test";
import {
  CoursePublicationMutationInFlightError,
  CoursePublicationMutationRateLimitError,
} from "./errors";
import { createCoursePublicationMutationGuard } from "./mutation-guard";

const ACTOR_A = "aaaaaaaa-0000-4000-8000-000000000101";
const ACTOR_B = "bbbbbbbb-0000-4000-8000-000000000102";

test("publication writes are exclusive per Account but independent across Accounts", async () => {
  const guard = createCoursePublicationMutationGuard();
  let release: (() => void) | undefined;
  const pending = guard.run(
    ACTOR_A,
    () =>
      new Promise<string>((resolve) => {
        release = () => resolve("published");
      }),
  );

  await assert.rejects(
    guard.run(ACTOR_A.toUpperCase(), async () => "duplicate"),
    CoursePublicationMutationInFlightError,
  );
  assert.equal(await guard.run(ACTOR_B, async () => "copied"), "copied");

  release?.();
  assert.equal(await pending, "published");
  assert.equal(await guard.run(ACTOR_A, async () => "retry"), "retry");
});

test("publication mutation rate follows the authenticated Account and resets", async () => {
  let currentTime = 1_000;
  const guard = createCoursePublicationMutationGuard({
    limit: 2,
    windowMs: 60_000,
    now: () => currentTime,
  });

  await guard.run(ACTOR_A, async () => undefined);
  await guard.run(ACTOR_A, async () => undefined);
  const blocked = await guard
    .run(ACTOR_A, async () => undefined)
    .catch((error: unknown) => error);
  assert.ok(blocked instanceof CoursePublicationMutationRateLimitError);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.equal(await guard.run(ACTOR_B, async () => "other"), "other");

  currentTime += 60_000;
  assert.equal(await guard.run(ACTOR_A, async () => "reset"), "reset");
});

test("publication mutation buckets stay bounded and fail closed at capacity", async () => {
  let currentTime = 5_000;
  const guard = createCoursePublicationMutationGuard({
    maxActors: 1,
    windowMs: 10_000,
    now: () => currentTime,
  });

  await guard.run(ACTOR_A, async () => undefined);
  await assert.rejects(
    guard.run(ACTOR_B, async () => undefined),
    CoursePublicationMutationRateLimitError,
  );
  currentTime += 10_000;
  assert.equal(await guard.run(ACTOR_B, async () => "admitted"), "admitted");
});
