import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  AiApplyInFlightError,
  AiRequestLimitError,
  runBoundedAiRequest,
  runExclusiveAiApply,
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
