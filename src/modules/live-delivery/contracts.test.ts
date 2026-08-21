import assert from "node:assert/strict";
import test from "node:test";
import {
  learnerLiveAssetSchema,
  learnerLiveDeliveryResponseSchema,
  setLiveAccessInputSchema,
  setPresentationCursorInputSchema,
  teacherLiveDeliverySchema,
} from "./contracts";

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

test("teacher live delivery is exact, ordered, and capability-consistent", () => {
  const delivery = {
    run: { started: true, ended: false },
    cursor: { slideId: uuid(2), revision: 4 },
    slides: [
      { id: uuid(1), position: 1, componentCount: 2 },
      { id: uuid(2), position: 2, componentCount: 1 },
    ],
    learners: [
      {
        learnerProfileId: uuid(3),
        displayName: "Анна",
        identityState: "claimed",
        courseAccessEnabled: true,
        runCapabilityEnabled: true,
      },
      {
        learnerProfileId: uuid(4),
        displayName: "Иван",
        identityState: "offline",
        courseAccessEnabled: false,
        runCapabilityEnabled: false,
      },
    ],
  };
  assert.deepEqual(teacherLiveDeliverySchema.parse(delivery), delivery);
  assert.equal(
    teacherLiveDeliverySchema.safeParse({ ...delivery, teacherReport: "x" })
      .success,
    false,
  );
  assert.equal(
    teacherLiveDeliverySchema.safeParse({
      ...delivery,
      cursor: { slideId: uuid(99), revision: 4 },
    }).success,
    false,
  );
  assert.equal(
    teacherLiveDeliverySchema.safeParse({
      ...delivery,
      learners: [
        {
          ...delivery.learners[1],
          courseAccessEnabled: true,
        },
      ],
    }).success,
    false,
  );
});

test("learner asset envelope permits only synthetic refs and opaque local URLs", () => {
  const asset = {
    ref: uuid(1),
    mimeType: "image/webp",
    url: `/api/v2/me/live-runs/${uuid(2)}/assets/${uuid(1)}?revision=7`,
  };
  assert.deepEqual(learnerLiveAssetSchema.parse(asset), asset);
  assert.equal(
    learnerLiveAssetSchema.safeParse({
      ...asset,
      originalFilename: "private-answer-key.webp",
    }).success,
    false,
  );
  assert.equal(
    learnerLiveAssetSchema.safeParse({
      ...asset,
      url: "https://storage.example.test/object/sign/private?token=secret",
    }).success,
    false,
  );
  assert.equal(
    learnerLiveAssetSchema.safeParse({ ...asset, ref: uuid(151) }).success,
    false,
  );
});

test("teacher mutations reject authority fields and impossible capability pairs", () => {
  assert.equal(
    setLiveAccessInputSchema.safeParse({
      learnerProfileId: uuid(1),
      courseAccessEnabled: false,
      runCapabilityEnabled: true,
    }).success,
    false,
  );
  for (const forbidden of ["accountId", "authUserId", "actorAccountId"]) {
    assert.equal(
      setLiveAccessInputSchema.safeParse({
        learnerProfileId: uuid(1),
        courseAccessEnabled: true,
        runCapabilityEnabled: false,
        [forbidden]: uuid(2),
      }).success,
      false,
    );
  }
  assert.equal(
    setPresentationCursorInputSchema.safeParse({
      slideId: null,
      expectedRevision: 2,
      revision: 2,
    }).success,
    false,
  );
});

test("learner response is a strict waiting-active-ended envelope", () => {
  const waiting = { state: { kind: "waiting", cursorRevision: 0 } };
  const ended = { state: { kind: "ended" } };
  const active = {
    state: {
      kind: "active",
      cursorRevision: 2,
      slide: {
        position: 1,
        componentCount: 1,
        components: [
          {
            key: "component-3",
            typeKey: "rich_text",
            schemaVersion: 1,
            position: 3,
            payload: { content: "你好", format: "markdown" },
            placement: { width: "content", textAlign: "start" },
          },
        ],
      },
      assets: [],
    },
  };
  assert.deepEqual(learnerLiveDeliveryResponseSchema.parse(waiting), waiting);
  assert.deepEqual(learnerLiveDeliveryResponseSchema.parse(ended), ended);
  assert.deepEqual(learnerLiveDeliveryResponseSchema.parse(active), active);
  assert.equal(
    learnerLiveDeliveryResponseSchema.safeParse({
      ...active,
      state: { ...active.state, learnerProfileId: uuid(1) },
    }).success,
    false,
  );
  assert.equal(
    learnerLiveDeliveryResponseSchema.safeParse({
      state: {
        ...active.state,
        slide: { ...active.state.slide, componentCount: 2 },
      },
    }).success,
    false,
  );
  assert.equal(
    learnerLiveDeliveryResponseSchema.safeParse({
      state: {
        ...active.state,
        slide: {
          ...active.state.slide,
          components: [
            {
              ...active.state.slide.components[0],
              execution: {
                issueRef: `cqi_${"a".repeat(64)}`,
                definitionRevision: `cqd_v1_${"b".repeat(64)}`,
                attemptCount: 0,
                maxAttempts: 3,
                remainingAttempts: 3,
                hintAvailable: false,
                hintCount: 0,
                canSubmit: true,
                latestFeedback: null,
              },
            },
          ],
        },
      },
    }).success,
    false,
  );
});
