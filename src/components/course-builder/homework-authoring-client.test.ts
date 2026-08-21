import assert from "node:assert/strict";
import test from "node:test";
import type { LessonHomework } from "@/modules/homework-authoring/domain";
import {
  HomeworkAuthoringClientError,
  clearLessonHomework,
  loadLessonHomework,
  replaceLessonHomework,
} from "./homework-authoring-client";

const LESSON_ID = "11111111-1111-4111-8111-111111111111";
const HOMEWORK_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

const homework: LessonHomework = {
  id: HOMEWORK_ID,
  lessonId: LESSON_ID,
  revision: 3,
  items: [
    {
      id: ITEM_ID,
      position: 1,
      typeKey: "rich_text",
      schemaVersion: 1,
      payload: { content: "Повторите правило", format: "markdown" },
      placement: { width: "content", textAlign: "start" },
    },
  ],
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:01:00.000Z",
};

test("homework authoring client loads and replaces one lesson-owned draft", async () => {
  const requests: Array<{ path: string; init?: RequestInit }> = [];
  const fetchMock = (async (path, init) => {
    requests.push({ path: String(path), init });
    return Response.json({ homework });
  }) as typeof fetch;

  assert.deepEqual(await loadLessonHomework(LESSON_ID, fetchMock), homework);
  assert.deepEqual(
    await replaceLessonHomework(
      LESSON_ID,
      {
        expectedRevision: 3,
        items: homework.items.map(({ position: _position, ...item }) => item),
      },
      fetchMock,
    ),
    homework,
  );

  assert.equal(requests[0]?.path, `/api/v2/lessons/${LESSON_ID}/homework`);
  assert.equal(requests[0]?.init?.method, "GET");
  assert.equal(requests[0]?.init?.cache, "no-store");
  assert.equal(requests[0]?.init?.credentials, "same-origin");
  assert.equal(requests[1]?.init?.method, "PUT");
  assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), {
    expectedRevision: 3,
    items: homework.items.map(({ position: _position, ...item }) => item),
  });
});

test("homework clear keeps the returned empty aggregate and its advanced revision", async () => {
  const cleared = { ...homework, revision: 4, items: [] };
  let capturedInit: RequestInit | undefined;
  const fetchMock = (async (_path, init) => {
    capturedInit = init;
    return Response.json({ homework: cleared });
  }) as typeof fetch;

  assert.deepEqual(
    await clearLessonHomework(LESSON_ID, { expectedRevision: 3 }, fetchMock),
    cleared,
  );
  assert.equal(capturedInit?.method, "DELETE");
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    expectedRevision: 3,
  });
});

test("homework client classifies stale/network failures and rejects malformed success", async () => {
  await assert.rejects(
    replaceLessonHomework(
      LESSON_ID,
      {
        expectedRevision: 2,
        items: homework.items.map(({ position: _position, ...item }) => item),
      },
      (async () =>
        Response.json(
          { code: "homework_revision_conflict" },
          { status: 409 },
        )) as typeof fetch,
    ),
    (error: unknown) => {
      assert.ok(error instanceof HomeworkAuthoringClientError);
      assert.equal(error.failure, "stale");
      return true;
    },
  );

  await assert.rejects(
    loadLessonHomework(LESSON_ID, (async () => {
      throw new Error("private network detail");
    }) as typeof fetch),
    (error: unknown) => {
      assert.ok(error instanceof HomeworkAuthoringClientError);
      assert.equal(error.failure, "unavailable");
      assert.equal(error.message.includes("private network detail"), false);
      return true;
    },
  );

  await assert.rejects(
    loadLessonHomework(LESSON_ID, (async () =>
      Response.json({ homework: { revision: 1 } })) as typeof fetch),
    (error: unknown) => {
      assert.ok(error instanceof HomeworkAuthoringClientError);
      assert.equal(error.failure, "invalid_response");
      return true;
    },
  );
});
