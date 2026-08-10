import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  AiApplyInFlightError,
  AiRequestLimitError,
  runBoundedAiRequest,
  runExclusiveAiApply,
  runIdempotentAiAssistantAction,
} from "./server-context";

test("AI rate limit follows the authenticated actor across IP changes", async () => {
  const actorAuthUserId = "99999999-9999-4999-8999-999999999999";
  const firstRequest = new NextRequest("https://v2.shidao.ru/api/test", {
    headers: { "x-forwarded-for": "192.0.2.1" },
  });
  const secondRequest = new NextRequest("https://v2.shidao.ru/api/test", {
    headers: { "x-forwarded-for": "198.51.100.2" },
  });

  assert.equal(
    await runBoundedAiRequest(
      firstRequest,
      {
        actorAuthUserId,
        scope: "assistant",
        limit: 1,
        windowMs: 60_000,
      },
      async () => "ok",
    ),
    "ok",
  );
  await assert.rejects(
    runBoundedAiRequest(
      secondRequest,
      {
        actorAuthUserId,
        scope: "assistant",
        limit: 1,
        windowMs: 60_000,
      },
      async () => "unexpected",
    ),
    AiRequestLimitError,
  );
});

test("only one AI apply runs for an actor and course in one process", async () => {
  let release: (() => void) | undefined;
  const pending = runExclusiveAiApply(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    () =>
      new Promise<string>((resolve) => {
        release = () => resolve("applied");
      }),
  );

  await assert.rejects(
    runExclusiveAiApply(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      async () => "duplicate",
    ),
    AiApplyInFlightError,
  );

  release?.();
  assert.equal(await pending, "applied");
  assert.equal(
    await runExclusiveAiApply(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      async () => "retry",
    ),
    "retry",
  );
});

test("assistant action reuses a successful result for a sequential retry", async () => {
  let calls = 0;
  const actorAuthUserId = "10000000-0000-4000-8000-000000000001";
  const idempotencyKey = "10000000-0000-4000-8000-000000000002";
  const operation = async () => {
    calls += 1;
    return { courseId: "10000000-0000-4000-8000-000000000003" };
  };

  const first = await runIdempotentAiAssistantAction(
    actorAuthUserId,
    idempotencyKey,
    operation,
  );
  const retry = await runIdempotentAiAssistantAction(
    actorAuthUserId,
    idempotencyKey,
    operation,
  );

  assert.equal(calls, 1);
  assert.strictEqual(retry, first);
});

test("concurrent assistant actions with the same key share one operation", async () => {
  let calls = 0;
  let release: ((value: string) => void) | undefined;
  const actorAuthUserId = "20000000-0000-4000-8000-000000000001";
  const idempotencyKey = "20000000-0000-4000-8000-000000000002";
  const operation = () => {
    calls += 1;
    return new Promise<string>((resolve) => {
      release = resolve;
    });
  };

  const first = runIdempotentAiAssistantAction(
    actorAuthUserId,
    idempotencyKey,
    operation,
  );
  const concurrent = runIdempotentAiAssistantAction(
    actorAuthUserId,
    idempotencyKey,
    operation,
  );

  assert.equal(calls, 1);
  assert.ok(release);
  release("created-once");
  assert.deepEqual(await Promise.all([first, concurrent]), [
    "created-once",
    "created-once",
  ]);
  assert.equal(calls, 1);
});

test("failed assistant action is not cached and can be retried", async () => {
  let calls = 0;
  const actorAuthUserId = "30000000-0000-4000-8000-000000000001";
  const idempotencyKey = "30000000-0000-4000-8000-000000000002";

  await assert.rejects(
    runIdempotentAiAssistantAction(
      actorAuthUserId,
      idempotencyKey,
      async () => {
        calls += 1;
        throw new Error("temporary failure");
      },
    ),
    /temporary failure/,
  );

  const retry = await runIdempotentAiAssistantAction(
    actorAuthUserId,
    idempotencyKey,
    async () => {
      calls += 1;
      return "retry succeeded";
    },
  );

  assert.equal(retry, "retry succeeded");
  assert.equal(calls, 2);
});
