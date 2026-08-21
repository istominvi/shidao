import assert from "node:assert/strict";
import test from "node:test";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import {
  createHomeworkAuthoringRepository,
  HOMEWORK_AUTHORING_RPC,
} from "./repository";

const COURSE_ID = "20000000-0000-4000-8000-000000000001";
const LESSON_ID = "20000000-0000-4000-8000-000000000002";
const HOMEWORK_ID = "20000000-0000-4000-8000-000000000003";
const ITEM_ID = "20000000-0000-4000-8000-000000000004";

function scopePayload(revision = 1, items: unknown[] = []) {
  return {
    courseId: COURSE_ID,
    lessonId: LESSON_ID,
    homework: {
      id: HOMEWORK_ID,
      lessonId: LESSON_ID,
      revision,
      items,
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:01:00.000Z",
    },
  };
}

async function withSupabaseEnv(run: () => Promise<void>) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  try {
    await run();
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
}

test("repository calls only the user-JWT Homework RPCs with exact CAS arguments", async () => {
  await withSupabaseEnv(async () => {
    const calls: Array<{
      url: string;
      authorization: string | null;
      body: unknown;
    }> = [];
    const repository = createHomeworkAuthoringRepository("access-token", {
      fetcher: (async (input, init) => {
        calls.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("authorization"),
          body: JSON.parse(String(init?.body)),
        });
        return Response.json(scopePayload(2));
      }) as typeof fetch,
    });

    await repository.getScope(LESSON_ID);
    await repository.replace({
      lessonId: LESSON_ID,
      expectedRevision: 1,
      items: [
        {
          id: ITEM_ID,
          typeKey: "rich_text",
          schemaVersion: 1,
          payload: { content: "Прочитайте текст", format: "markdown" },
          placement: { width: "content", textAlign: "start" },
        },
      ],
    });

    assert.deepEqual(calls, [
      {
        url: `https://supabase.example.test/rest/v1/rpc/${HOMEWORK_AUTHORING_RPC.get}`,
        authorization: "Bearer access-token",
        body: { p_lesson_id: LESSON_ID },
      },
      {
        url: `https://supabase.example.test/rest/v1/rpc/${HOMEWORK_AUTHORING_RPC.replace}`,
        authorization: "Bearer access-token",
        body: {
          p_lesson_id: LESSON_ID,
          p_expected_revision: 1,
          p_items: [
            {
              id: ITEM_ID,
              typeKey: "rich_text",
              schemaVersion: 1,
              payload: { content: "Прочитайте текст", format: "markdown" },
              placement: { width: "content", textAlign: "start" },
            },
          ],
        },
      },
    ]);
  });
});

test("repository fails closed on malformed RPC output", async () => {
  await withSupabaseEnv(async () => {
    const repository = createHomeworkAuthoringRepository("access-token", {
      fetcher: (async () =>
        Response.json({ unexpected: true })) as typeof fetch,
    });
    await assert.rejects(repository.getScope(LESSON_ID), (error: unknown) => {
      assert.ok(error instanceof CourseBuilderRepositoryError);
      assert.equal(error.status, 502);
      assert.equal(error.code, "homework_response_invalid");
      return true;
    });
  });
});

test("repository preserves not-found, validation, CAS, auth, and network boundaries", async () => {
  await withSupabaseEnv(async () => {
    const cases = [
      [404, "P0002", "lesson_homework_not_found", 404, "access_denied"],
      [400, "22023", "lesson_homework_item_invalid", 400, "validation_error"],
      [
        400,
        "40001",
        "lesson_homework_revision_conflict",
        409,
        "homework_revision_conflict",
      ],
      [401, "42501", "jwt expired", 401, "42501"],
      [403, "42501", "permission denied", 404, "access_denied"],
    ] as const;

    for (const [
      status,
      databaseCode,
      message,
      expectedStatus,
      expectedCode,
    ] of cases) {
      const repository = createHomeworkAuthoringRepository("access-token", {
        fetcher: (async () =>
          Response.json(
            { code: databaseCode, message },
            { status },
          )) as typeof fetch,
      });
      await assert.rejects(repository.getScope(LESSON_ID), (error: unknown) => {
        assert.ok(error instanceof CourseBuilderRepositoryError);
        assert.equal(error.status, expectedStatus);
        assert.equal(error.code, expectedCode);
        return true;
      });
    }

    const offline = createHomeworkAuthoringRepository("access-token", {
      fetcher: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
    });
    await assert.rejects(offline.getScope(LESSON_ID), (error: unknown) => {
      assert.ok(error instanceof CourseBuilderRepositoryError);
      assert.equal(error.status, 503);
      assert.equal(error.code, "homework_network_error");
      return true;
    });
  });
});
