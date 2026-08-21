import type { ChoiceQuizLearnerExecution } from "@/modules/choice-quiz/contracts";

export type LearnerChoiceQuizPendingSubmission = {
  idempotencyKey: string;
  selectedOptionIds: string[];
};

export type LearnerChoiceQuizDraft = {
  selectedOptionIds: string[];
  pendingSubmission: LearnerChoiceQuizPendingSubmission | null;
  draftingRetry: boolean;
  persistedAttemptCount: number;
  persistedSubmittedAt: string | null;
};

export type LearnerChoiceQuizDrafts = Readonly<
  Record<string, LearnerChoiceQuizDraft>
>;

export function learnerChoiceQuizDraftFromExecution(
  execution: ChoiceQuizLearnerExecution,
): LearnerChoiceQuizDraft {
  return {
    selectedOptionIds: [...(execution.latestFeedback?.selectedOptionIds ?? [])],
    pendingSubmission: null,
    draftingRetry: false,
    persistedAttemptCount: execution.attemptCount,
    persistedSubmittedAt: execution.latestFeedback?.submittedAt ?? null,
  };
}

export function learnerChoiceQuizExecutionAdvancesDraft(
  execution: ChoiceQuizLearnerExecution,
  draft: LearnerChoiceQuizDraft,
) {
  const submittedAt = execution.latestFeedback?.submittedAt ?? null;
  return (
    execution.attemptCount > draft.persistedAttemptCount ||
    (execution.attemptCount === draft.persistedAttemptCount &&
      submittedAt !== null &&
      submittedAt !== draft.persistedSubmittedAt)
  );
}

export function prepareLearnerChoiceQuizSubmission(
  draft: LearnerChoiceQuizDraft,
  selectedOptionIds: readonly string[],
  createIdempotencyKey: () => string,
) {
  const request = draft.pendingSubmission ?? {
    idempotencyKey: createIdempotencyKey(),
    selectedOptionIds: [...selectedOptionIds],
  };
  return {
    request,
    draft: {
      ...draft,
      pendingSubmission: request,
    } satisfies LearnerChoiceQuizDraft,
  };
}

export function setLearnerChoiceQuizDraft(
  drafts: LearnerChoiceQuizDrafts,
  issueRef: string,
  draft: LearnerChoiceQuizDraft,
): LearnerChoiceQuizDrafts {
  if (drafts[issueRef] === draft) return drafts;
  return { ...drafts, [issueRef]: draft };
}

export function retainLearnerChoiceQuizDrafts(
  drafts: LearnerChoiceQuizDrafts,
  activeIssueRefs: readonly string[] | null,
): LearnerChoiceQuizDrafts {
  if (activeIssueRefs === null) return drafts;
  const retained = new Set(activeIssueRefs);
  const entries = Object.entries(drafts).filter(([issueRef]) =>
    retained.has(issueRef),
  );
  if (entries.length === Object.keys(drafts).length) return drafts;
  return Object.fromEntries(entries);
}
