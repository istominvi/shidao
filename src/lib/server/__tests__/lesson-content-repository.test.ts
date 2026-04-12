import assert from "node:assert/strict";
import test from "node:test";
import {
  getMethodologyLessonStudentContentByLessonIdAdmin,
  isMissingLessonStudentContentSchemaError,
} from "../lesson-content-repository";

test("isMissingLessonStudentContentSchemaError matches missing-table/schema-cache messages", () => {
  assert.equal(
    isMissingLessonStudentContentSchemaError(
      'relation "public.methodology_lesson_student_content" does not exist',
    ),
    true,
  );
  assert.equal(
    isMissingLessonStudentContentSchemaError(
      "Could not find the table 'methodology_lesson_student_content' in the schema cache",
    ),
    true,
  );
  assert.equal(
    isMissingLessonStudentContentSchemaError("permission denied for table methodology_lesson_student_content"),
    false,
  );
});

test("repository returns null when methodology_lesson_student_content table is missing", async () => {
  const prevFetch = global.fetch;
  const prevServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        message: 'Could not find the table "methodology_lesson_student_content" in the schema cache',
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    const result = await getMethodologyLessonStudentContentByLessonIdAdmin("lesson-1");
    assert.equal(result, null);
  } finally {
    global.fetch = prevFetch;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceRole;
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
  }
});

test("repository still throws unrelated errors", async () => {
  const prevFetch = global.fetch;
  const prevServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

  global.fetch = (async () =>
    new Response(
      JSON.stringify({ message: "permission denied for table methodology_lesson_student_content" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () => getMethodologyLessonStudentContentByLessonIdAdmin("lesson-1"),
      /permission denied/i,
    );
  } finally {
    global.fetch = prevFetch;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceRole;
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
  }
});
