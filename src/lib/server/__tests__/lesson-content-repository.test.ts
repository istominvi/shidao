import assert from "node:assert/strict";
import test from "node:test";
import {
  getMethodologyLessonStudentContentByLessonIdAdmin,
  isMethodologyLessonStudentContentSchemaReadyAdmin,
} from "../lesson-content-repository";

function withMockedFetch(
  fetchImpl: typeof fetch,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = fetchImpl;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  return run().finally(() => {
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  });
}

test("student content repository returns null for missing schema relation", async () => {
  await withMockedFetch(async () => {
    return new Response(
      JSON.stringify({
        message: 'relation "public.methodology_lesson_student_content" does not exist',
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  }, async () => {
    const content = await getMethodologyLessonStudentContentByLessonIdAdmin(
      "lesson-1",
    );
    assert.equal(content, null);
  });
});

test("student content schema readiness returns false for schema-cache miss", async () => {
  await withMockedFetch(async () => {
    return new Response(
      JSON.stringify({
        message:
          'Could not find the table "public.methodology_lesson_student_content" in the schema cache',
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }, async () => {
    const ready = await isMethodologyLessonStudentContentSchemaReadyAdmin();
    assert.equal(ready, false);
  });
});

test("student content repository returns null for invalid payload row", async () => {
  await withMockedFetch(async () => {
    return new Response(
      JSON.stringify([
        {
          id: "content-1",
          methodology_lesson_id: "lesson-1",
          title: "Lesson 1",
          subtitle: null,
          content_payload: {},
        },
      ]),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }, async () => {
    const content = await getMethodologyLessonStudentContentByLessonIdAdmin(
      "lesson-1",
    );
    assert.equal(content, null);
  });
});
