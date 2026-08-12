import assert from "node:assert/strict";
import test from "node:test";
import { CoursePublicationRepositoryError } from "./errors";
import { createCoursePublicationRepository } from "./repository";

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000101";
const COURSE_ID = "00000000-0000-4000-8000-000000000201";
const PUBLICATION_ID = "00000000-0000-4000-8000-000000000301";
const REVISION_ID = "00000000-0000-4000-8000-000000000401";
const POSTGRES_GUID_PUBLICATION_ID = "cdcccb90-aab2-302e-3736-fdf6fedd59ba";
const POSTGRES_GUID_COURSE_ID = "eb697b66-8655-6939-3d2c-cdf193935004";

async function withRepository(
  fetcher: typeof fetch,
  run: (
    repository: ReturnType<typeof createCoursePublicationRepository>,
  ) => Promise<void>,
) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  try {
    await run(createCoursePublicationRepository({ fetcher }));
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    if (previousServiceKey === undefined)
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
  }
}

async function unpublishError(fetcher: typeof fetch) {
  let caught: unknown;
  await withRepository(fetcher, async (repository) => {
    try {
      await repository.unpublishCourse({
        actorAccountId: ACCOUNT_ID,
        sourceCourseId: COURSE_ID,
      });
    } catch (error) {
      caught = error;
    }
  });
  assert.ok(caught instanceof CoursePublicationRepositoryError);
  return caught;
}

test("trusted PostgREST 4xx is the only HTTP failure classified as rolled back", async () => {
  const error = await unpublishError(
    (async () =>
      new Response(
        JSON.stringify({
          code: "P0001",
          message: "course_publication_source_changed",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
  );
  assert.equal(error.definitelyNotCommitted, true);
  assert.equal(error.status, 409);
  assert.doesNotMatch(error.message, /course_publication_/);
});

test("HTTP 5xx stays commit-unknown even with a PostgREST-shaped body", async () => {
  const error = await unpublishError(
    (async () =>
      new Response(
        JSON.stringify({
          code: "P0001",
          message: "course_publication_source_changed",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
  );
  assert.equal(error.definitelyNotCommitted, false);
  assert.equal(error.status, 503);
  assert.doesNotMatch(error.message, /course_publication_/);
});

test("response body read and JSON parse failures stay commit-unknown", async () => {
  const readError = await unpublishError(
    (async () =>
      ({
        ok: false,
        status: 409,
        text: async () => {
          throw new Error("socket closed");
        },
      }) as unknown as Response) as typeof fetch,
  );
  assert.equal(readError.definitelyNotCommitted, false);

  const parseError = await unpublishError(
    (async () =>
      new Response("not-json", {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
  );
  assert.equal(parseError.definitelyNotCommitted, false);
  assert.equal(parseError.status, 502);
});

test("network failure stays commit-unknown", async () => {
  const error = await unpublishError((async () => {
    throw new Error("connection reset");
  }) as typeof fetch);
  assert.equal(error.definitelyNotCommitted, false);
  assert.equal(error.status, 503);
});

test("unknown database tokens are never exposed through repository errors", async () => {
  const error = await unpublishError(
    (async () =>
      new Response(
        JSON.stringify({
          code: "P0001",
          message: "course_publication_private_sql_token_123",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
  );
  assert.equal(error.definitelyNotCommitted, true);
  assert.equal(error.status, 400);
  assert.doesNotMatch(error.message, /private_sql_token|course_publication_/);
});

test("active catalog viewer check uses a narrow service-role Account query", async () => {
  let requestUrl = "";
  await withRepository(
    (async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify([{ id: ACCOUNT_ID }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch,
    async (repository) => {
      assert.equal(await repository.isActiveAccount(ACCOUNT_ID), true);
    },
  );
  assert.match(
    requestUrl,
    new RegExp(
      `/rest/v1/account\\?select=id&id=eq\\.${ACCOUNT_ID}&status=eq\\.active&limit=1$`,
    ),
  );
  assert.doesNotMatch(requestUrl, /select=\*/);
});

test("catalog detail fails closed before revision/assets for an inactive publisher", async () => {
  const requestUrls: string[] = [];
  await withRepository(
    (async (input) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.includes("/rest/v1/course_publication?")) {
        return new Response(
          JSON.stringify([
            {
              id: PUBLICATION_ID,
              owner_account_id: ACCOUNT_ID,
              current_revision_id: "00000000-0000-4000-8000-000000000401",
              status: "published",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/rest/v1/account?")) {
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
    async (repository) => {
      assert.equal(
        await repository.getCatalogPublication(PUBLICATION_ID),
        null,
      );
    },
  );
  assert.equal(requestUrls.length, 2);
  assert.equal(
    requestUrls.some((url) =>
      /course_publication_(?:revision|asset)/.test(url),
    ),
    false,
  );
});

test("catalog listing uses the compact filtered RPC contract", async () => {
  let requestUrl = "";
  let requestBody: unknown;
  await withRepository(
    (async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          courses: [],
          facets: {
            subjects: ["Китайский язык"],
            levels: ["Начальный"],
          },
          nextOffset: 74,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
    async (repository) => {
      const page = await repository.listCatalog({
        actorAccountId: ACCOUNT_ID,
        q: "диалог",
        learningAudience: "children",
        subject: "Китайский язык",
        level: "Начальный",
        offset: 24,
        limit: 50,
      });
      assert.deepEqual(page.facets, {
        subjects: ["Китайский язык"],
        levels: ["Начальный"],
      });
      assert.equal(page.nextOffset, 74);
    },
  );
  assert.match(requestUrl, /\/rpc\/list_course_publication_catalog_v2_admin$/);
  assert.deepEqual(requestBody, {
    p_actor_account_id: ACCOUNT_ID,
    p_q: "диалог",
    p_learning_audience: "children",
    p_subject: "Китайский язык",
    p_level: "Начальный",
    p_offset: 24,
    p_limit: 50,
  });
});

test("catalog accepts canonical PostgreSQL UUID values without RFC version bits", async () => {
  await withRepository(
    (async () =>
      new Response(
        JSON.stringify({
          courses: [
            {
              publicationId: POSTGRES_GUID_PUBLICATION_ID,
              sourceCourseId: POSTGRES_GUID_COURSE_ID,
              learningAudience: "educators",
              title: "Методика преподавания китайского языка",
              subject: "Китайский язык",
              goal: "Спроектировать современный урок",
              level: "Повышение квалификации",
              audienceDescription: "Преподаватели китайского языка",
              targetLessonCount: 6,
              lessonCount: 6,
              materialCount: 0,
              publishedAt: "2026-08-12T03:10:45.000Z",
              author: {
                displayName: "Преподаватель",
                isShiDao: false,
                isCurrentUser: true,
              },
            },
          ],
          facets: { subjects: ["Китайский язык"], levels: [] },
          nextOffset: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
    async (repository) => {
      const page = await repository.listCatalog({
        actorAccountId: ACCOUNT_ID,
        q: "",
        learningAudience: "educators",
        subject: "",
        level: "",
        offset: 0,
        limit: 24,
      });
      assert.equal(page.courses.length, 1);
      assert.equal(
        page.courses[0]?.publicationId,
        POSTGRES_GUID_PUBLICATION_ID,
      );
    },
  );
});

test("catalog copy eligibility uses the narrow service-role RPC contract", async () => {
  let requestUrl = "";
  let requestBody: unknown;
  await withRepository(
    (async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ eligible: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch,
    async (repository) => {
      await repository.assertCatalogCopyEligible(ACCOUNT_ID, PUBLICATION_ID);
    },
  );
  assert.match(
    requestUrl,
    /\/rpc\/assert_course_publication_copy_eligible_admin$/,
  );
  assert.deepEqual(requestBody, {
    p_actor_account_id: ACCOUNT_ID,
    p_publication_id: PUBLICATION_ID,
  });
});

test("catalog copy eligibility fails closed on a malformed RPC response", async () => {
  await withRepository(
    (async () =>
      new Response(JSON.stringify({ eligible: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
    async (repository) => {
      await assert.rejects(
        repository.assertCatalogCopyEligible(ACCOUNT_ID, PUBLICATION_ID),
        (error: unknown) =>
          error instanceof CoursePublicationRepositoryError &&
          error.status === 502,
      );
    },
  );
});

test("publish uses the attestation-aware RPC contract", async () => {
  let requestUrl = "";
  let requestBody: unknown;
  const contentSha256 = "a".repeat(64);
  const attestation = {
    version: 1,
    title: "Итоговая аттестация",
    description: "Проверка методики преподавания китайского языка.",
    passingScorePercent: 80,
    questions: [
      {
        id: "question-1",
        prompt: "Как вводить новый тон?",
        options: [
          { id: "option-1", label: "Через контекст и слуховую модель" },
          { id: "option-2", label: "Только через запись пиньинь" },
        ],
        correctOptionId: "option-1",
        explanation: "Контекст связывает звучание с коммуникативной задачей.",
      },
    ],
  };
  const snapshot = {
    schemaVersion: 1 as const,
    course: {
      title: "Методика преподавания китайского",
      subject: "Китайский язык",
      goal: "Повысить квалификацию преподавателей",
      level: "Повышение квалификации",
      audienceDescription: "Преподаватели китайского языка",
      targetLessonCount: 6,
    },
    lessons: [],
    materials: [],
  };

  await withRepository(
    (async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          publicationId: PUBLICATION_ID,
          sourceCourseId: COURSE_ID,
          status: "published",
          currentRevisionId: REVISION_ID,
          publishedAt: "2026-08-12T00:00:00.000Z",
          updatedAt: "2026-08-12T00:00:00.000Z",
          sourceCourseUpdatedAt: "2026-08-12T00:00:00.000Z",
          sourceContentUpdatedAt: "2026-08-12T00:00:00.000Z",
          contentSha256,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
    async (repository) => {
      await repository.publishCourseRevision({
        actorAccountId: ACCOUNT_ID,
        sourceCourseId: COURSE_ID,
        publicationId: PUBLICATION_ID,
        revisionId: REVISION_ID,
        contentSha256,
        learningAudience: "educators",
        attestation,
        snapshot,
        assetManifest: [],
        rightsConfirmed: true,
      });
    },
  );

  assert.match(
    requestUrl,
    /\/rpc\/publish_course_revision_with_attestation_admin$/,
  );
  assert.deepEqual(requestBody, {
    p_actor_account_id: ACCOUNT_ID,
    p_source_course_id: COURSE_ID,
    p_publication_id: PUBLICATION_ID,
    p_revision_id: REVISION_ID,
    p_content_sha256: contentSha256,
    p_learning_audience: "educators",
    p_attestation: attestation,
    p_snapshot: snapshot,
    p_asset_manifest: [],
    p_rights_confirmed: true,
  });
});
