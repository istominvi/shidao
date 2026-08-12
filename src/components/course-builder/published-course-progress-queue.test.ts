import assert from "node:assert/strict";
import test from "node:test";
import type { CoursePublicationProgress } from "@/modules/course-consumption/domain";
import {
  createPublishedCourseProgressQueue,
  type PublishedCourseProgressIdentity,
} from "./published-course-progress-queue";

const FIRST_IDENTITY = {
  publicationId: "11111111-1111-4111-8111-111111111111",
  revisionId: "22222222-2222-4222-8222-222222222222",
} satisfies PublishedCourseProgressIdentity;
const SECOND_IDENTITY = {
  publicationId: "33333333-3333-4333-8333-333333333333",
  revisionId: "44444444-4444-4444-8444-444444444444",
} satisfies PublishedCourseProgressIdentity;
const FIRST_LESSON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const SECOND_LESSON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

function progress(
  identity: PublishedCourseProgressIdentity,
  input: {
    lastOpenedLessonRef?: string | null;
    completedLessonRefs?: string[];
  } = {},
): CoursePublicationProgress {
  const completedLessonRefs = input.completedLessonRefs ?? [];
  return {
    ...identity,
    lastOpenedLessonRef: input.lastOpenedLessonRef ?? null,
    completedLessonRefs,
    completedLessonCount: completedLessonRefs.length,
    totalLessonCount: 2,
    percent: completedLessonRefs.length * 50,
    complete: completedLessonRefs.length === 2,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function nextTurn() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("progress queue serializes writes, coalesces opens, and preserves latest completion", async () => {
  let current = progress(FIRST_IDENTITY);
  const requests: Array<{
    input: {
      publicationId: string;
      revisionId: string;
      lessonRef: string;
      completed: boolean;
    };
    result: ReturnType<typeof deferred<CoursePublicationProgress>>;
  }> = [];
  const commits: CoursePublicationProgress[] = [];
  const queue = createPublishedCourseProgressQueue({
    readProgress: () => current,
    execute: (input) => {
      const result = deferred<CoursePublicationProgress>();
      requests.push({ input, result });
      return result.promise;
    },
    onCommit: (nextProgress) => {
      current = nextProgress;
      commits.push(nextProgress);
    },
    onError: (error) => assert.fail(String(error)),
    onBusyChange: () => undefined,
  });

  queue.activate(FIRST_IDENTITY);
  assert.equal(
    queue.enqueue({
      kind: "completion",
      lessonRef: FIRST_LESSON,
      completed: true,
    }),
    true,
  );
  queue.enqueue({ kind: "open", lessonRef: SECOND_LESSON });
  queue.enqueue({ kind: "open", lessonRef: FIRST_LESSON });

  assert.equal(requests.length, 1, "only one write may be in flight");
  requests[0]!.result.resolve(
    progress(FIRST_IDENTITY, {
      lastOpenedLessonRef: FIRST_LESSON,
      completedLessonRefs: [FIRST_LESSON],
    }),
  );
  await nextTurn();

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1]!.input, {
    publicationId: FIRST_IDENTITY.publicationId,
    revisionId: FIRST_IDENTITY.revisionId,
    lessonRef: FIRST_LESSON,
    completed: true,
  });
  requests[1]!.result.resolve(
    progress(FIRST_IDENTITY, {
      lastOpenedLessonRef: FIRST_LESSON,
      completedLessonRefs: [FIRST_LESSON],
    }),
  );
  await nextTurn();

  assert.equal(commits.length, 2);
  assert.equal(
    requests.some((request) => request.input.lessonRef === SECOND_LESSON),
    false,
    "an intermediate pending open is coalesced",
  );
});

test("progress queue ignores stale route responses and commits the current identity", async () => {
  let current = progress(FIRST_IDENTITY);
  const requests: Array<{
    input: { publicationId: string };
    result: ReturnType<typeof deferred<CoursePublicationProgress>>;
  }> = [];
  const commits: CoursePublicationProgress[] = [];
  const queue = createPublishedCourseProgressQueue({
    readProgress: () => current,
    execute: (input) => {
      const result = deferred<CoursePublicationProgress>();
      requests.push({ input, result });
      return result.promise;
    },
    onCommit: (nextProgress) => {
      current = nextProgress;
      commits.push(nextProgress);
    },
    onError: (error) => assert.fail(String(error)),
    onBusyChange: () => undefined,
  });

  queue.activate(FIRST_IDENTITY);
  queue.enqueue({ kind: "open", lessonRef: FIRST_LESSON });
  queue.activate(SECOND_IDENTITY);
  current = progress(SECOND_IDENTITY);
  queue.enqueue({ kind: "open", lessonRef: SECOND_LESSON });

  requests[0]!.result.resolve(
    progress(FIRST_IDENTITY, { lastOpenedLessonRef: FIRST_LESSON }),
  );
  await nextTurn();
  assert.equal(commits.length, 0, "stale response must not reach current UI");
  assert.equal(requests.length, 2);

  requests[1]!.result.resolve(
    progress(SECOND_IDENTITY, { lastOpenedLessonRef: SECOND_LESSON }),
  );
  await nextTurn();
  assert.equal(commits.length, 1);
  assert.equal(commits[0]!.publicationId, SECOND_IDENTITY.publicationId);
});

test("progress queue rejects a response for another publication or revision", async () => {
  let current = progress(FIRST_IDENTITY);
  const request = deferred<CoursePublicationProgress>();
  const errors: unknown[] = [];
  const queue = createPublishedCourseProgressQueue({
    readProgress: () => current,
    execute: () => request.promise,
    onCommit: (nextProgress) => {
      current = nextProgress;
    },
    onError: (error) => errors.push(error),
    onBusyChange: () => undefined,
  });

  queue.activate(FIRST_IDENTITY);
  queue.enqueue({ kind: "open", lessonRef: FIRST_LESSON });
  request.resolve(progress(SECOND_IDENTITY));
  await nextTurn();

  assert.equal(current.publicationId, FIRST_IDENTITY.publicationId);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /другой версии курса/);
});
