import "server-only";

import {
  CoursePublicationMutationInFlightError,
  CoursePublicationMutationRateLimitError,
} from "./errors";

const DEFAULT_LIMIT = 12;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_ACTORS = 10_000;

type RateBucket = {
  count: number;
  resetAt: number;
};

export interface CoursePublicationMutationGuard {
  run<T>(actorAccountId: string, operation: () => Promise<T>): Promise<T>;
}

export function createCoursePublicationMutationGuard(
  options: {
    limit?: number;
    windowMs?: number;
    maxActors?: number;
    now?: () => number;
  } = {},
): CoursePublicationMutationGuard {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxActors = options.maxActors ?? DEFAULT_MAX_ACTORS;
  const now = options.now ?? Date.now;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    !Number.isSafeInteger(maxActors) ||
    maxActors < 1
  ) {
    throw new Error("Invalid course publication mutation guard limits.");
  }

  const rateByActor = new Map<string, RateBucket>();
  const inFlightActors = new Set<string>();

  function retryAfterSeconds(resetAt: number, currentTime: number) {
    return Math.max(1, Math.ceil((resetAt - currentTime) / 1_000));
  }

  function pruneExpired(currentTime: number) {
    for (const [actorKey, bucket] of rateByActor) {
      if (bucket.resetAt <= currentTime) rateByActor.delete(actorKey);
    }
  }

  function admitRate(actorKey: string) {
    const currentTime = now();
    const current = rateByActor.get(actorKey);
    if (current && current.resetAt > currentTime) {
      if (current.count >= limit) {
        throw new CoursePublicationMutationRateLimitError(
          retryAfterSeconds(current.resetAt, currentTime),
        );
      }
      current.count += 1;
      return;
    }
    if (current) rateByActor.delete(actorKey);
    if (rateByActor.size >= maxActors) pruneExpired(currentTime);
    if (rateByActor.size >= maxActors) {
      const earliestReset = Math.min(
        ...[...rateByActor.values()].map((bucket) => bucket.resetAt),
      );
      throw new CoursePublicationMutationRateLimitError(
        retryAfterSeconds(earliestReset, currentTime),
      );
    }
    rateByActor.set(actorKey, {
      count: 1,
      resetAt: currentTime + windowMs,
    });
  }

  return {
    async run(actorAccountId, operation) {
      const actorKey = actorAccountId.trim().toLowerCase();
      if (inFlightActors.has(actorKey)) {
        throw new CoursePublicationMutationInFlightError();
      }
      admitRate(actorKey);
      if (inFlightActors.size >= maxActors) {
        throw new CoursePublicationMutationRateLimitError(1);
      }
      inFlightActors.add(actorKey);
      try {
        return await operation();
      } finally {
        inFlightActors.delete(actorKey);
      }
    },
  };
}

export const coursePublicationMutationGuard =
  createCoursePublicationMutationGuard();
