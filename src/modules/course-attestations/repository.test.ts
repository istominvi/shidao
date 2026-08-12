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
