import type { CoursePublicationProgress } from "@/modules/course-consumption/domain";

export type PublishedCourseProgressIdentity = {
  publicationId: string;
  revisionId: string;
};

export type PublishedCourseProgressMutation =
  | { kind: "open"; lessonRef: string }
  | { kind: "completion"; lessonRef: string; completed: boolean };

type QueuedProgressMutation = {
  epoch: number;
  identity: PublishedCourseProgressIdentity;
  mutation: PublishedCourseProgressMutation;
};

type PublishedCourseProgressQueueOptions = {
  readProgress: () => CoursePublicationProgress | null;
  execute: (input: {
    publicationId: string;
    revisionId: string;
    lessonRef: string;
    completed: boolean;
  }) => Promise<CoursePublicationProgress>;
  onCommit: (progress: CoursePublicationProgress) => void;
  onError: (error: unknown) => void;
  onBusyChange: (busy: boolean) => void;
};

export function isProgressForIdentity(
  progress: CoursePublicationProgress,
  identity: PublishedCourseProgressIdentity,
) {
  return (
    progress.publicationId === identity.publicationId &&
    progress.revisionId === identity.revisionId
  );
}

/**
 * Serializes progress writes and coalesces consecutive lesson-open events.
 *
 * The completion value for an open event is derived immediately before its
 * request. That keeps an open queued behind a completion write from undoing
 * the newly persisted completion with stale UI state.
 */
export function createPublishedCourseProgressQueue(
  options: PublishedCourseProgressQueueOptions,
) {
  let epoch = 0;
  let currentIdentity: PublishedCourseProgressIdentity | null = null;
  let active = false;
  let pending: QueuedProgressMutation[] = [];

  function isCurrent(task: QueuedProgressMutation) {
    return (
      task.epoch === epoch &&
      currentIdentity !== null &&
      currentIdentity.publicationId === task.identity.publicationId &&
      currentIdentity.revisionId === task.identity.revisionId
    );
  }

  async function drain() {
    if (active) return;
    const task = pending.shift();
    if (!task) {
      options.onBusyChange(false);
      return;
    }

    active = true;
    try {
      if (!isCurrent(task)) return;
      const latestProgress = options.readProgress();
      if (
        !latestProgress ||
        !isProgressForIdentity(latestProgress, task.identity)
      ) {
        return;
      }
      const completed =
        task.mutation.kind === "completion"
          ? task.mutation.completed
          : latestProgress.completedLessonRefs.includes(
              task.mutation.lessonRef,
            );
      const nextProgress = await options.execute({
        publicationId: task.identity.publicationId,
        revisionId: task.identity.revisionId,
        lessonRef: task.mutation.lessonRef,
        completed,
      });

      if (!isProgressForIdentity(nextProgress, task.identity)) {
        throw new Error("Сервис вернул прогресс другой версии курса.");
      }
      if (isCurrent(task)) options.onCommit(nextProgress);
    } catch (error) {
      if (isCurrent(task)) {
        // After an uncertain write result, later opens must not reuse possibly
        // stale completion state. A reload re-establishes the server truth.
        pending = [];
        options.onError(error);
      }
    } finally {
      active = false;
      if (pending.length > 0) void drain();
      else options.onBusyChange(false);
    }
  }

  return {
    activate(identity: PublishedCourseProgressIdentity | null) {
      epoch += 1;
      currentIdentity = identity ? { ...identity } : null;
      pending = [];
      options.onBusyChange(false);
    },

    enqueue(mutation: PublishedCourseProgressMutation) {
      const identity = currentIdentity;
      const progress = options.readProgress();
      if (
        !identity ||
        !progress ||
        !isProgressForIdentity(progress, identity)
      ) {
        return false;
      }

      const task: QueuedProgressMutation = {
        epoch,
        identity: { ...identity },
        mutation,
      };
      const previous = pending.at(-1);
      if (
        mutation.kind === "open" &&
        previous?.epoch === epoch &&
        previous.mutation.kind === "open"
      ) {
        pending[pending.length - 1] = task;
      } else {
        pending.push(task);
      }
      options.onBusyChange(true);
      void drain();
      return true;
    },
  };
}
