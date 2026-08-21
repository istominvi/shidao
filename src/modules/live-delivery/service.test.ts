import assert from "node:assert/strict";
import test from "node:test";
import type {
  LearnerLiveSource,
  PresentationCursor,
  SetLiveAccessInput,
  SetPresentationCursorInput,
  TeacherLiveDelivery,
} from "./domain";
import {
  LiveDeliveryAssetNotFoundError,
  LiveDeliveryAssetRangeError,
  LiveDeliveryProjectionError,
  LiveDeliveryRepositoryError,
} from "./errors";
import type {
  LearnerLiveDeliveryRepository,
  TeacherLiveDeliveryRepository,
} from "./repository";
import { createLiveDeliveryService, normalizeLiveAssetRange } from "./service";

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

const RUN_ID = uuid(1);
const LEARNER_ID = uuid(2);
const SESSION_ID = uuid(3);
const AUTH_USER_ID = uuid(4);
const SLIDE_ID = uuid(5);
const STORED_FILE_ID = uuid(6);
const EXTRA_STORED_FILE_ID = uuid(7);
const QUIZ_OPTION_A = uuid(8);
const QUIZ_OPTION_B = uuid(9);
const OWNER_ACCOUNT_ID = uuid(10);

const teacherDelivery: TeacherLiveDelivery = {
  run: { started: true, ended: false },
  cursor: { slideId: SLIDE_ID, revision: 3 },
  slides: [{ id: SLIDE_ID, position: 1, componentCount: 2 }],
  learners: [
    {
      learnerProfileId: LEARNER_ID,
      displayName: "Анна",
      identityState: "claimed",
      courseAccessEnabled: true,
      runCapabilityEnabled: true,
    },
  ],
};

class TeacherRepository implements TeacherLiveDeliveryRepository {
  readonly calls: Array<{ kind: string; value: unknown }> = [];

  async getDelivery(lessonRunId: string) {
    this.calls.push({ kind: "get", value: lessonRunId });
    return teacherDelivery;
  }

  async setAccess(lessonRunId: string, input: SetLiveAccessInput) {
    this.calls.push({ kind: "access", value: { lessonRunId, input } });
    return teacherDelivery;
  }

  async setCursor(
    lessonRunId: string,
    input: SetPresentationCursorInput,
  ): Promise<PresentationCursor> {
    this.calls.push({ kind: "cursor", value: { lessonRunId, input } });
    return { slideId: input.slideId, revision: input.expectedRevision + 1 };
  }
}

class LearnerRepository implements LearnerLiveDeliveryRepository {
  readonly resolved: Array<unknown> = [];
  readonly fetched: Array<unknown> = [];
  resolveError: Error | null = null;

  constructor(public source: LearnerLiveSource) {}

  async resolveSource(actor: unknown, lessonRunId: string) {
    this.resolved.push({ actor, lessonRunId });
    if (this.resolveError) throw this.resolveError;
    return this.source;
  }

  async fetchAsset(
    asset: { id: string; sizeBytes: number },
    input: { range: string | null },
  ) {
    this.fetched.push({ assetId: asset.id, range: input.range });
    const contentRange = input.range
      ? input.range.replace("bytes=", "bytes ") + `/${asset.sizeBytes}`
      : null;
    const match = input.range ? /^bytes=(\d+)-(\d+)$/.exec(input.range) : null;
    const contentLength = match
      ? Number(match[2]) - Number(match[1]) + 1
      : asset.sizeBytes;
    return {
      body: new Response("asset").body!,
      status: input.range ? (206 as const) : (200 as const),
      contentLength,
      contentRange,
    };
  }
}

function liveSource(): LearnerLiveSource {
  return {
    state: "live",
    cursorRevision: 7,
    slide: {
      position: 2,
      components: [
        {
          typeKey: "image",
          schemaVersion: 1,
          position: 3,
          payload: { storedFileId: STORED_FILE_ID, alt: "Иероглиф 道" },
          placement: {
            width: "wide",
            align: "center",
            fit: "contain",
            aspectRatio: "auto",
          },
        },
        {
          typeKey: "choice_quiz",
          schemaVersion: 1,
          position: 4,
          payload: {
            question: "Что означает 道?",
            options: [
              { id: QUIZ_OPTION_A, label: "Путь", isCorrect: true },
              { id: QUIZ_OPTION_B, label: "Дом", isCorrect: false },
            ],
            allowMultiple: false,
            shuffle: false,
            // Sentinel: evaluator-only content may resemble a private asset
            // reference, but discovery must run after learner projection.
            explanation: EXTRA_STORED_FILE_ID,
          },
          placement: { width: "content", compact: false },
        },
      ],
    },
    assets: [
      {
        id: STORED_FILE_ID,
        storageBucket: "course-assets",
        storagePath: `${OWNER_ACCOUNT_ID}/courses/private/image.webp`,
        originalFilename: "道.webp",
        mimeType: "image/webp",
        sizeBytes: 128,
      },
      {
        id: EXTRA_STORED_FILE_ID,
        storageBucket: "course-assets",
        storagePath: "owner/course/private.pdf",
        originalFilename: "private.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
      },
    ],
  };
}

test("teacher service validates mutations and delegates without actor authority ids", async () => {
  const repository = new TeacherRepository();
  const service = createLiveDeliveryService({ teacherRepository: repository });
  assert.equal(await service.getTeacherDelivery(RUN_ID), teacherDelivery);
  await service.setTeacherAccess(RUN_ID, {
    learnerProfileId: LEARNER_ID,
    courseAccessEnabled: true,
    runCapabilityEnabled: true,
  });
  assert.deepEqual(
    await service.setTeacherCursor(RUN_ID, {
      slideId: SLIDE_ID,
      expectedRevision: 3,
    }),
    { slideId: SLIDE_ID, revision: 4 },
  );
  assert.equal(
    JSON.stringify(repository.calls).includes("actorAccountId"),
    false,
  );
  assert.throws(
    () =>
      service.setTeacherAccess(RUN_ID, {
        learnerProfileId: LEARNER_ID,
        courseAccessEnabled: false,
        runCapabilityEnabled: true,
      }),
    /явного доступа к курсу/,
  );
});

test("learner state uses only opaque same-origin asset refs and local URLs", async () => {
  const repository = new LearnerRepository(liveSource());
  const service = createLiveDeliveryService({ learnerRepository: repository });
  const state = await service.getLearnerState(
    { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
    RUN_ID,
  );
  assert.equal(state.kind, "active");
  if (state.kind !== "active") return;
  assert.deepEqual(repository.resolved, [
    {
      actor: { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
      lessonRunId: RUN_ID,
    },
  ]);
  assert.deepEqual(repository.fetched, []);
  assert.equal(state.slide.componentCount, 2);
  assert.deepEqual(
    state.slide.components.map((component) => component.key),
    ["component-3", "component-4"],
  );
  const imagePayload = state.slide.components[0]!.payload;
  assert.equal(
    imagePayload.storedFileId,
    "00000000-0000-4000-8000-000000000001",
  );
  assert.deepEqual(state.assets, [
    {
      ref: "00000000-0000-4000-8000-000000000001",
      mimeType: "image/webp",
      url: `/api/v2/me/live-runs/${RUN_ID}/assets/00000000-0000-4000-8000-000000000001?revision=7`,
    },
  ]);
  const serialized = JSON.stringify(state);
  assert.doesNotMatch(serialized, new RegExp(STORED_FILE_ID));
  assert.doesNotMatch(serialized, new RegExp(EXTRA_STORED_FILE_ID));
  assert.doesNotMatch(serialized, new RegExp(OWNER_ACCOUNT_ID));
  assert.doesNotMatch(
    serialized,
    /storagePath|originalFilename|signed|token=/i,
  );
  assert.doesNotMatch(serialized, /isCorrect|explanation|teacher|objective/i);
});

test("learner asset proxy re-resolves current projection, revision, ref, and Range", async () => {
  const repository = new LearnerRepository(liveSource());
  const service = createLiveDeliveryService({ learnerRepository: repository });
  const actor = {
    authUserId: AUTH_USER_ID,
    supabaseSessionId: SESSION_ID,
  };
  const delivery = await service.getLearnerAsset(
    actor,
    RUN_ID,
    "00000000-0000-4000-8000-000000000001",
    "7",
    "bytes=0-4",
  );
  assert.deepEqual(repository.fetched, [
    { assetId: STORED_FILE_ID, range: "bytes=0-4" },
  ]);
  assert.equal(delivery.status, 206);
  assert.equal(delivery.contentRange, "bytes 0-4/128");
  assert.equal(delivery.contentLength, 5);
  assert.equal(delivery.mimeType, "image/webp");

  for (const [ref, revision] of [
    ["00000000-0000-4000-8000-000000000002", "7"],
    ["00000000-0000-4000-8000-000000000001", "8"],
    [STORED_FILE_ID, "7"],
  ]) {
    await assert.rejects(
      () => service.getLearnerAsset(actor, RUN_ID, ref, revision, null),
      LiveDeliveryAssetNotFoundError,
    );
  }
  assert.equal(repository.fetched.length, 1);

  repository.source = { state: "waiting", cursorRevision: 7 };
  await assert.rejects(
    () =>
      service.getLearnerAsset(
        actor,
        RUN_ID,
        "00000000-0000-4000-8000-000000000001",
        "7",
        null,
      ),
    LiveDeliveryAssetNotFoundError,
  );
  assert.equal(
    repository.fetched.length,
    1,
    "a request resolved after a terminal state must not reach Storage",
  );

  repository.resolveError = new LiveDeliveryRepositoryError(
    "Live lesson is unavailable.",
    404,
    "live_delivery_not_found",
  );
  await assert.rejects(
    () =>
      service.getLearnerAsset(
        actor,
        RUN_ID,
        "00000000-0000-4000-8000-000000000001",
        "7",
        null,
      ),
    LiveDeliveryRepositoryError,
  );
  assert.equal(
    repository.fetched.length,
    1,
    "a GET whose resolver runs after revoke must not reach Storage",
  );
});

test("live asset Range parser accepts one bounded byte range only", () => {
  assert.equal(normalizeLiveAssetRange(null, 128), null);
  assert.equal(normalizeLiveAssetRange("bytes=5-", 128), "bytes=5-127");
  assert.equal(normalizeLiveAssetRange("bytes=-10", 128), "bytes=118-127");
  assert.equal(normalizeLiveAssetRange("bytes=0-999", 128), "bytes=0-127");
  for (const value of [
    "bytes=0-1,3-4",
    "bytes=128-",
    "bytes=9-3",
    "items=0-1",
    "bytes=-0",
  ]) {
    assert.throws(
      () => normalizeLiveAssetRange(value, 128),
      LiveDeliveryAssetRangeError,
    );
  }
});

test("learner waiting and ended states contain no lesson or identity metadata", async () => {
  for (const [source, expected] of [
    [
      { state: "waiting", cursorRevision: 9 },
      { kind: "waiting", cursorRevision: 9 },
    ],
    [{ state: "ended" }, { kind: "ended" }],
  ] as const) {
    const service = createLiveDeliveryService({
      learnerRepository: new LearnerRepository(source),
    });
    assert.deepEqual(
      await service.getLearnerState(
        { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
        RUN_ID,
      ),
      expected,
    );
    await assert.rejects(
      () =>
        service.getLearnerAsset(
          { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
          RUN_ID,
          "00000000-0000-4000-8000-000000000001",
          "9",
          null,
        ),
      LiveDeliveryAssetNotFoundError,
    );
  }
});

test("malformed or unsupported stored payload fails closed", async () => {
  const source = liveSource();
  if (source.state !== "live") return;
  source.slide.components[0] = {
    ...source.slide.components[0]!,
    payload: { storedFileId: STORED_FILE_ID, alt: 42 },
  };
  const service = createLiveDeliveryService({
    learnerRepository: new LearnerRepository(source),
  });
  await assert.rejects(
    () =>
      service.getLearnerState(
        { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
        RUN_ID,
      ),
    LiveDeliveryProjectionError,
  );
});
