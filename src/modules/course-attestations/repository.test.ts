import assert from "node:assert/strict";
import test from "node:test";
import {
  CourseAttestationRepositoryError,
  createCourseAttestationRepository,
} from "./repository";

test("malformed attestation RPC output fails through the typed repository boundary", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

  try {
    const repository = createCourseAttestationRepository("access-token", {
      fetcher: (async () =>
        new Response(JSON.stringify([{ unexpected: true }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
    });

    await assert.rejects(
      repository.listAccountAttestations(),
      (error: unknown) => {
        assert.ok(error instanceof CourseAttestationRepositoryError);
        assert.equal(error.status, 502);
        assert.equal(
          error.message,
          "list_my_course_publication_attestations_response_invalid",
        );
        return true;
      },
    );
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
});

test("authored attestation replacement uses the user-JWT owner RPC contract", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  let captured: {
    url: string;
    body: unknown;
    authorization: string | null;
  } | null = null;
  try {
    const repository = createCourseAttestationRepository("access-token", {
      fetcher: (async (input, init) => {
        const headers = new Headers(init?.headers);
        captured = {
          url: String(input),
          body: JSON.parse(String(init?.body)),
          authorization: headers.get("authorization"),
        };
        return Response.json({
          version: 2,
          title: "Экзамен",
          description: "",
          passingScorePercent: 75,
          questions: [
            {
              id: "q_1",
              prompt: "Вопрос",
              options: [
                { id: "o_1", label: "Да" },
                { id: "o_2", label: "Нет" },
              ],
              correctOptionId: "o_1",
              explanation: "",
            },
          ],
        });
      }) as typeof fetch,
    });
    const attestation = await repository.replaceAuthoredCourseAttestation(
      "00000000-0000-4000-8000-000000000001",
      {
        title: "Экзамен",
        description: "",
        passingScorePercent: 75,
        questions: [
          {
            id: "q_1",
            prompt: "Вопрос",
            options: [
              { id: "o_1", label: "Да" },
              { id: "o_2", label: "Нет" },
            ],
            correctOptionId: "o_1",
            explanation: "",
          },
        ],
      },
    );
    assert.equal(attestation.version, 2);
    assert.deepEqual(captured, {
      url: "https://supabase.example.test/rest/v1/rpc/replace_my_course_attestation",
      authorization: "Bearer access-token",
      body: {
        p_course_id: "00000000-0000-4000-8000-000000000001",
        p_title: "Экзамен",
        p_description: "",
        p_passing_score_percent: 75,
        p_questions: [
          {
            id: "q_1",
            prompt: "Вопрос",
            options: [
              { id: "o_1", label: "Да" },
              { id: "o_2", label: "Нет" },
            ],
            correctOptionId: "o_1",
            explanation: "",
          },
        ],
      },
    });
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
});
