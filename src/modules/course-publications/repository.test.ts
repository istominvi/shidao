import assert from "node:assert/strict";
import test from "node:test";
import { CoursePublicationRepositoryError } from "./errors";
import { createCoursePublicationRepository } from "./repository";

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000101";
const COURSE_ID = "00000000-0000-4000-8000-000000000201";
const PUBLICATION_ID = "00000000-0000-4000-8000-000000000301";
const REVISION_ID = "00000000-0000-4000-8000-000000000401";
const APPROVED_REVISION_ID = "00000000-0000-4000-8000-000000000402";
const OTHER_PUBLICATION_ID = "00000000-0000-4000-8000-000000000302";
const POSTGRES_GUID_PUBLICATION_ID = "cdcccb90-aab2-302e-3736-fdf6fedd59ba";
const POSTGRES_GUID_COURSE_ID = "eb697b66-8655-6939-3d2c-cdf193935004";

function educatorCatalogPublication(overrides: Record<string, unknown> = {}) {
  return {
    id: PUBLICATION_ID,
    source_course_id: COURSE_ID,
    owner_account_id: ACCOUNT_ID,
    learning_audience: "educators",
    publisher_display_name: "Автор курса",
    is_shidao: true,
    status: "published",
    current_revision_id: REVISION_ID,
    approved_revision_id: APPROVED_REVISION_ID,
    source_content_updated_at: "2026-08-12T00:00:00.000Z",
    published_at: "2026-08-13T00:00:00.000Z",
    unpublished_at: null,
    created_at: "2026-08-12T00:00:00.000Z",
    updated_at: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

function educatorCatalogRevision(overrides: Record<string, unknown> = {}) {
  return {
    id: APPROVED_REVISION_ID,
    publication_id: PUBLICATION_ID,
    revision_number: 1,
    source_course_updated_at: "2026-08-12T00:00:00.000Z",
    content_sha256: "a".repeat(64),
    snapshot: {
      schemaVersion: 1,
      course: {
        title: "Методика преподавания китайского языка",
        subject: "Китайский язык",
        goal: "Проектировать современный урок",
        level: "Повышение квалификации",
        audienceDescription: "Преподаватели китайского языка",
        targetLessonCount: 1,
      },
      lessons: [],
      materials: [],
    },
    rights_confirmed_at: "2026-08-12T00:00:00.000Z",
    license_code: "shidao_official_learning_v1",
    published_at: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

function objectiveAlignedSnapshot() {
  return {
    schemaVersion: 2,
    course: {
      title: "Китайский с нуля",
      subject: "Китайский язык",
      goal: "Научиться вести короткий диалог",
      level: "Начальный",
      audienceDescription: "Дети 9–11 лет",
      targetLessonCount: 1,
    },
    objectives: [
      {
        ref: "00000000-0000-4000-8000-000000000501",
        position: 1,
        title: "Распознавать приветствие на слух",
        description: null,
        archivedAt: null,
      },
    ],
    lessons: [
      {
        ref: "00000000-0000-4000-8000-000000000502",
        position: 1,
        title: "Знакомство",
        summary: "",
        estimatedDurationMinutes: null,
        components: [
          {
            ref: "00000000-0000-4000-8000-000000000503",
            position: 1,
            typeKey: "choice_quiz",
            schemaVersion: 1,
            payload: {},
            placement: {},
            visibility: "staff_only",
            studentSlideRef: null,
            primaryObjectiveRef: "00000000-0000-4000-8000-000000000501",
            activityRole: "assessment",
          },
        ],
        slides: [],
      },
    ],
    materials: [],
  };
}

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

test("educator catalog detail reads only the approved ShiDao revision", async () => {
  const requestUrls: string[] = [];
  await withRepository(
    (async (input) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.includes("/rest/v1/course_publication?")) {
        return Response.json([educatorCatalogPublication()]);
      }
      if (url.includes("/rest/v1/account?")) {
        return new Response(JSON.stringify([{ id: ACCOUNT_ID }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/rest/v1/course_publication_revision?")) {
        return Response.json([educatorCatalogRevision()]);
      }
      if (url.includes("/rest/v1/educator_course_revision_review?")) {
        return Response.json([
          {
            revision_id: APPROVED_REVISION_ID,
            publication_id: PUBLICATION_ID,
            status: "approved",
          },
        ]);
      }
      if (url.includes("/rest/v1/course_publication_attestation?")) {
        return Response.json([
          {
            revision_id: APPROVED_REVISION_ID,
            publication_id: PUBLICATION_ID,
          },
        ]);
      }
      if (url.includes("/rest/v1/course_publication_asset?")) {
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
    async (repository) => {
      const detail = await repository.getCatalogPublication(PUBLICATION_ID);
      assert.equal(detail?.revisionId, APPROVED_REVISION_ID);
      assert.equal(detail?.publishedAt, "2026-08-12T00:00:00.000Z");
    },
  );
  const revisionRequest = requestUrls.find((url) =>
    url.includes("/rest/v1/course_publication_revision?"),
  );
  const assetRequest = requestUrls.find((url) =>
    url.includes("/rest/v1/course_publication_asset?"),
  );
  const reviewRequest = requestUrls.find((url) =>
    url.includes("/rest/v1/educator_course_revision_review?"),
  );
  const attestationRequest = requestUrls.find((url) =>
    url.includes("/rest/v1/course_publication_attestation?"),
  );
  assert.match(revisionRequest ?? "", new RegExp(APPROVED_REVISION_ID));
  assert.doesNotMatch(revisionRequest ?? "", new RegExp(REVISION_ID));
  assert.match(
    reviewRequest ?? "",
    new RegExp(
      `revision_id=eq\\.${APPROVED_REVISION_ID}.*publication_id=eq\\.${PUBLICATION_ID}.*status=eq\\.approved`,
    ),
  );
  assert.match(
    attestationRequest ?? "",
    new RegExp(
      `revision_id=eq\\.${APPROVED_REVISION_ID}.*publication_id=eq\\.${PUBLICATION_ID}`,
    ),
  );
  assert.match(assetRequest ?? "", new RegExp(APPROVED_REVISION_ID));
});

test("educator detail fails closed without approval or ShiDao status", async () => {
  for (const publication of [
    { is_shidao: true, approved_revision_id: null },
    { is_shidao: false, approved_revision_id: REVISION_ID },
  ]) {
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
                learning_audience: "educators",
                status: "published",
                current_revision_id: REVISION_ID,
                ...publication,
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/rest/v1/account?")) {
          return new Response(JSON.stringify([{ id: ACCOUNT_ID }]), {
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
    assert.equal(
      requestUrls.some((url) =>
        /course_publication_(?:revision|asset)/.test(url),
      ),
      false,
    );
  }
});

test("educator detail fails closed when approved offering eligibility drifts", async () => {
  const approvedReview = {
    revision_id: APPROVED_REVISION_ID,
    publication_id: PUBLICATION_ID,
    status: "approved",
  };
  const persistedAttestation = {
    revision_id: APPROVED_REVISION_ID,
    publication_id: PUBLICATION_ID,
  };
  const cases: Array<{
    name: string;
    revisionRows: unknown[];
    reviewRows: unknown[];
    attestationRows: unknown[];
  }> = [
    {
      name: "missing approved revision",
      revisionRows: [],
      reviewRows: [approvedReview],
      attestationRows: [persistedAttestation],
    },
    {
      name: "mismatched revision id",
      revisionRows: [educatorCatalogRevision({ id: REVISION_ID })],
      reviewRows: [approvedReview],
      attestationRows: [persistedAttestation],
    },
    {
      name: "mismatched revision publication",
      revisionRows: [
        educatorCatalogRevision({ publication_id: OTHER_PUBLICATION_ID }),
      ],
      reviewRows: [approvedReview],
      attestationRows: [persistedAttestation],
    },
    {
      name: "non-official license",
      revisionRows: [
        educatorCatalogRevision({ license_code: "shidao_catalog_reuse_v1" }),
      ],
      reviewRows: [approvedReview],
      attestationRows: [persistedAttestation],
    },
    {
      name: "missing approved review",
      revisionRows: [educatorCatalogRevision()],
      reviewRows: [],
      attestationRows: [persistedAttestation],
    },
    {
      name: "review not approved",
      revisionRows: [educatorCatalogRevision()],
      reviewRows: [{ ...approvedReview, status: "pending" }],
      attestationRows: [persistedAttestation],
    },
    {
      name: "mismatched review revision",
      revisionRows: [educatorCatalogRevision()],
      reviewRows: [{ ...approvedReview, revision_id: REVISION_ID }],
      attestationRows: [persistedAttestation],
    },
    {
      name: "mismatched review publication",
      revisionRows: [educatorCatalogRevision()],
      reviewRows: [{ ...approvedReview, publication_id: OTHER_PUBLICATION_ID }],
      attestationRows: [persistedAttestation],
    },
    {
      name: "missing persisted attestation",
      revisionRows: [educatorCatalogRevision()],
      reviewRows: [approvedReview],
      attestationRows: [],
    },
    {
      name: "mismatched attestation revision",
      revisionRows: [educatorCatalogRevision()],
      reviewRows: [approvedReview],
      attestationRows: [{ ...persistedAttestation, revision_id: REVISION_ID }],
    },
    {
      name: "mismatched attestation publication",
      revisionRows: [educatorCatalogRevision()],
      reviewRows: [approvedReview],
      attestationRows: [
        {
          ...persistedAttestation,
          publication_id: OTHER_PUBLICATION_ID,
        },
      ],
    },
  ];

  for (const scenario of cases) {
    const requestUrls: string[] = [];
    await withRepository(
      (async (input) => {
        const url = String(input);
        requestUrls.push(url);
        if (url.includes("/rest/v1/course_publication?")) {
          return Response.json([educatorCatalogPublication()]);
        }
        if (url.includes("/rest/v1/account?")) {
          return Response.json([{ id: ACCOUNT_ID }]);
        }
        if (url.includes("/rest/v1/course_publication_revision?")) {
          return Response.json(scenario.revisionRows);
        }
        if (url.includes("/rest/v1/educator_course_revision_review?")) {
          return Response.json(scenario.reviewRows);
        }
        if (url.includes("/rest/v1/course_publication_attestation?")) {
          return Response.json(scenario.attestationRows);
        }
        if (url.includes("/rest/v1/course_publication_asset?")) {
          return Response.json([]);
        }
        throw new Error(`unexpected request: ${url}`);
      }) as typeof fetch,
      async (repository) => {
        assert.equal(
          await repository.getCatalogPublication(PUBLICATION_ID),
          null,
          scenario.name,
        );
      },
    );
    assert.equal(
      requestUrls.some((url) =>
        url.includes("/rest/v1/course_publication_asset?"),
      ),
      false,
      `${scenario.name}: assets must stay hidden`,
    );
  }
});

test("child catalog detail keeps the current-revision path without educator gates", async () => {
  const requestUrls: string[] = [];
  await withRepository(
    (async (input) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.includes("/rest/v1/course_publication?")) {
        return Response.json([
          educatorCatalogPublication({
            learning_audience: "children",
            is_shidao: false,
            approved_revision_id: null,
          }),
        ]);
      }
      if (url.includes("/rest/v1/account?")) {
        return Response.json([{ id: ACCOUNT_ID }]);
      }
      if (url.includes("/rest/v1/course_publication_revision?")) {
        return Response.json([
          educatorCatalogRevision({
            id: REVISION_ID,
            license_code: "shidao_catalog_reuse_v1",
          }),
        ]);
      }
      if (url.includes("/rest/v1/course_publication_asset?")) {
        return Response.json([]);
      }
      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
    async (repository) => {
      const detail = await repository.getCatalogPublication(PUBLICATION_ID);
      assert.equal(detail?.learningAudience, "children");
      assert.equal(detail?.revisionId, REVISION_ID);
    },
  );
  assert.equal(
    requestUrls.some((url) =>
      /educator_course_revision_review|course_publication_attestation/.test(
        url,
      ),
    ),
    false,
  );
});

test("catalog repository parses objective-aligned V2 revisions", async () => {
  await withRepository(
    (async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/course_publication?")) {
        return Response.json([
          educatorCatalogPublication({
            learning_audience: "children",
            is_shidao: false,
            approved_revision_id: null,
          }),
        ]);
      }
      if (url.includes("/rest/v1/account?")) {
        return Response.json([{ id: ACCOUNT_ID }]);
      }
      if (url.includes("/rest/v1/course_publication_revision?")) {
        return Response.json([
          educatorCatalogRevision({
            id: REVISION_ID,
            license_code: "shidao_catalog_reuse_v1",
            snapshot: objectiveAlignedSnapshot(),
          }),
        ]);
      }
      if (url.includes("/rest/v1/course_publication_asset?")) {
        return Response.json([]);
      }
      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
    async (repository) => {
      const detail = await repository.getCatalogPublication(PUBLICATION_ID);
      assert.equal(detail?.snapshot.schemaVersion, 2);
      if (detail?.snapshot.schemaVersion !== 2) {
        assert.fail("expected a V2 publication snapshot");
      }
      assert.equal(detail.snapshot.objectives.length, 1);
      assert.equal(
        detail.snapshot.lessons[0]?.components[0]?.primaryObjectiveRef,
        detail.snapshot.objectives[0]?.ref,
      );
    },
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

test("owned educator publication persists review and approval projection", async () => {
  const requestUrls: string[] = [];
  await withRepository(
    (async (input) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.includes("/rest/v1/course_publication?")) {
        return Response.json([
          {
            id: PUBLICATION_ID,
            source_course_id: COURSE_ID,
            owner_account_id: ACCOUNT_ID,
            learning_audience: "educators",
            publisher_display_name: "Автор",
            is_shidao: true,
            status: "published",
            current_revision_id: REVISION_ID,
            approved_revision_id: null,
            source_content_updated_at: "2026-08-12T00:00:00.000Z",
            published_at: null,
            unpublished_at: null,
            created_at: "2026-08-12T00:00:00.000Z",
            updated_at: "2026-08-12T00:00:00.000Z",
          },
        ]);
      }
      if (url.includes("/rest/v1/course_publication_revision?")) {
        return Response.json([
          {
            id: REVISION_ID,
            publication_id: PUBLICATION_ID,
            revision_number: 1,
            source_course_updated_at: "2026-08-12T00:00:00.000Z",
            content_sha256: "a".repeat(64),
            snapshot: {
              schemaVersion: 1,
              course: {},
              lessons: [],
              materials: [],
            },
            rights_confirmed_at: "2026-08-12T00:00:00.000Z",
            license_code: "SHIDAO-CATALOG",
            published_at: "2026-08-12T00:00:00.000Z",
          },
        ]);
      }
      if (url.includes("/rest/v1/educator_course_revision_review?")) {
        return Response.json([
          {
            revision_id: REVISION_ID,
            publication_id: PUBLICATION_ID,
            status: "pending",
          },
        ]);
      }
      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
    async (repository) => {
      const publication = await repository.getOwnedPublication(
        ACCOUNT_ID,
        COURSE_ID,
      );
      assert.equal(publication?.reviewStatus, "pending");
      assert.equal(publication?.reviewRevisionId, REVISION_ID);
      assert.equal(publication?.approvedRevisionId, null);
    },
  );
  assert.equal(
    requestUrls.some((url) =>
      url.includes("/rest/v1/educator_course_revision_review?"),
    ),
    true,
  );
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
          reviewStatus: "pending",
          reviewRevisionId: REVISION_ID,
          approvedRevisionId: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
    async (repository) => {
      const result = await repository.publishCourseRevision({
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
      assert.equal(result.reviewStatus, "pending");
      assert.equal(result.reviewRevisionId, REVISION_ID);
      assert.equal(result.approvedRevisionId, null);
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

test("clone and duplicate RPCs forward the objective remap contract", async () => {
  const targetCourseId = "00000000-0000-4000-8000-000000000601";
  const idMap = {
    objectives: [
      {
        ref: "00000000-0000-4000-8000-000000000501",
        id: "00000000-0000-4000-8000-000000000602",
      },
    ],
    lessons: [],
    components: [],
    slides: [],
  };
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  await withRepository(
    (async (input, init) => {
      requests.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return Response.json({ courseId: targetCourseId });
    }) as typeof fetch,
    async (repository) => {
      await repository.clonePublication({
        actorAccountId: ACCOUNT_ID,
        publicationId: PUBLICATION_ID,
        targetCourseId,
        targetTitle: null,
        idMap,
        assetManifest: [],
      });
      await repository.duplicateCourse({
        actorAccountId: ACCOUNT_ID,
        sourceCourseId: COURSE_ID,
        targetCourseId,
        targetTitle: "Копия",
        idMap,
      });
    },
  );

  assert.match(
    requests[0]!.url,
    /\/rpc\/clone_course_publication_with_attestation_admin$/,
  );
  assert.deepEqual(requests[0]!.body.p_id_map, idMap);
  assert.match(
    requests[1]!.url,
    /\/rpc\/duplicate_course_with_attestation_admin$/,
  );
  assert.deepEqual(requests[1]!.body.p_id_map, idMap);
});
