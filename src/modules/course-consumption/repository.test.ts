import assert from "node:assert/strict";
import test from "node:test";
import { createCourseConsumptionRepository } from "./repository";

const PUBLICATION_ID = "00000000-0000-4000-8000-000000000101";
const REVISION_ID = "00000000-0000-4000-8000-000000000102";
const LESSON_ID = "00000000-0000-4000-8000-000000000103";

async function withPublicConfig(run: () => Promise<void>) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  try {
    await run();
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    }
  }
}

function progressResponse() {
  return new Response(
    JSON.stringify({
      publication_id: PUBLICATION_ID,
      revision_id: REVISION_ID,
      last_opened_lesson_ref: LESSON_ID,
      completed_lesson_refs: [LESSON_ID],
      completed_lesson_count: 1,
      total_lesson_count: 1,
      percent: 100,
      complete: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("progress repository uses user-JWT RPCs and never accepts an actor id", async () => {
  await withPublicConfig(async () => {
    const requests: Array<{
      url: string;
      authorization: string | null;
      body: unknown;
    }> = [];
    const repository = createCourseConsumptionRepository("user-access-token", {
      fetcher: (async (input, init) => {
        requests.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("Authorization"),
          body: JSON.parse(String(init?.body)),
        });
        return progressResponse();
      }) as typeof fetch,
    });

    const initial = await repository.getProgress(PUBLICATION_ID);
    assert.equal(initial.lastOpenedLessonRef, LESSON_ID);
    await repository.setLessonProgress({
      publicationId: PUBLICATION_ID,
      expectedRevisionId: REVISION_ID,
      lessonRef: LESSON_ID,
      completed: false,
    });

    assert.match(
      requests[0]!.url,
      /\/rpc\/get_my_course_publication_progress$/,
    );
    assert.deepEqual(requests[0]!.body, {
      p_publication_id: PUBLICATION_ID,
    });
    assert.match(
      requests[1]!.url,
      /\/rpc\/set_my_course_publication_lesson_progress$/,
    );
    assert.deepEqual(requests[1]!.body, {
      p_publication_id: PUBLICATION_ID,
      p_expected_revision_id: REVISION_ID,
      p_lesson_ref: LESSON_ID,
      p_completed: false,
    });
    assert.equal(requests[0]!.authorization, "Bearer user-access-token");
    assert.doesNotMatch(JSON.stringify(requests), /actor|account/i);
  });
});
