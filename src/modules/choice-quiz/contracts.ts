import { z } from "zod";
import { postgresUuidSchema } from "@/lib/postgres-uuid";
import { choiceQuizLearnerDeliverySchema } from "@/modules/course-builder/registry/contracts";

export const CHOICE_QUIZ_MAX_OPTIONS = 20;
export const CHOICE_QUIZ_PRACTICE_MAX_ATTEMPTS = 3;
export const CHOICE_QUIZ_ASSESSMENT_MAX_ATTEMPTS = 1;

export const CHOICE_QUIZ_EVALUATOR_VERSION = "choice_quiz_exact_set_v1";
export const CHOICE_QUIZ_FEEDBACK_POLICY_VERSION = "choice_quiz_feedback_v1";
export const CHOICE_QUIZ_EVIDENCE_POLICY_VERSION = 2;

export const choiceQuizIssueRefSchema = z.string().regex(/^cqi_[0-9a-f]{64}$/);
export const choiceQuizDefinitionRevisionSchema = z
  .string()
  .regex(/^cqd_v1_[0-9a-f]{64}$/);
export const choiceQuizEvaluatorFingerprintSchema = z
  .string()
  .regex(/^cqef_v1_[0-9a-f]{64}$/);

const timestampSchema = z.iso.datetime({ offset: true });
const binaryScoreSchema = z.union([z.literal(0), z.literal(1)]);

export const choiceQuizOptionIdArraySchema = z
  .array(postgresUuidSchema)
  .min(1)
  .max(CHOICE_QUIZ_MAX_OPTIONS)
  .superRefine((optionIds, context) => {
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Варианты ответа не должны повторяться.",
      });
    }
  });

export const choiceQuizRevealSchema = z
  .object({
    correctOptionIds: choiceQuizOptionIdArraySchema,
    explanation: z.string().trim().min(1).max(4_000).optional(),
  })
  .strict();

export const choiceQuizLearnerFeedbackSchema = z
  .object({
    attemptNumber: z
      .number()
      .int()
      .positive()
      .max(CHOICE_QUIZ_PRACTICE_MAX_ATTEMPTS),
    selectedOptionIds: choiceQuizOptionIdArraySchema,
    isCorrect: z.boolean(),
    score: binaryScoreSchema,
    submittedAt: timestampSchema,
    canRetry: z.boolean(),
    reveal: choiceQuizRevealSchema.nullable(),
  })
  .strict()
  .superRefine((feedback, context) => {
    if (feedback.score !== (feedback.isCorrect ? 1 : 0)) {
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "Quiz score must match deterministic correctness.",
      });
    }
    if (feedback.canRetry && (feedback.isCorrect || feedback.reveal !== null)) {
      context.addIssue({
        code: "custom",
        path: ["canRetry"],
        message: "Retryable feedback cannot reveal the answer key.",
      });
    }
  });

export const choiceQuizLearnerExecutionSchema = z
  .object({
    issueRef: choiceQuizIssueRefSchema,
    definitionRevision: choiceQuizDefinitionRevisionSchema,
    attemptCount: z
      .number()
      .int()
      .nonnegative()
      .max(CHOICE_QUIZ_PRACTICE_MAX_ATTEMPTS),
    maxAttempts: z.union([
      z.literal(CHOICE_QUIZ_ASSESSMENT_MAX_ATTEMPTS),
      z.literal(CHOICE_QUIZ_PRACTICE_MAX_ATTEMPTS),
    ]),
    remainingAttempts: z
      .number()
      .int()
      .nonnegative()
      .max(CHOICE_QUIZ_PRACTICE_MAX_ATTEMPTS),
    hintAvailable: z.literal(false),
    hintCount: z.literal(0),
    canSubmit: z.boolean(),
    latestFeedback: choiceQuizLearnerFeedbackSchema.nullable(),
  })
  .strict()
  .superRefine((execution, context) => {
    if (
      execution.attemptCount > execution.maxAttempts ||
      execution.remainingAttempts !==
        execution.maxAttempts - execution.attemptCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["remainingAttempts"],
        message: "Quiz attempt counters are inconsistent.",
      });
    }

    if (
      (execution.attemptCount === 0) !==
      (execution.latestFeedback === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["latestFeedback"],
        message: "Quiz feedback must describe the latest attempt.",
      });
    }

    const latest = execution.latestFeedback;
    if (latest && latest.attemptNumber !== execution.attemptCount) {
      context.addIssue({
        code: "custom",
        path: ["latestFeedback", "attemptNumber"],
        message: "Quiz feedback must match the attempt counter.",
      });
    }

    const expectedCanSubmit =
      execution.remainingAttempts > 0 && (latest === null || latest.canRetry);
    if (execution.canSubmit !== expectedCanSubmit) {
      context.addIssue({
        code: "custom",
        path: ["canSubmit"],
        message: "Quiz submission state is inconsistent.",
      });
    }

    if (execution.maxAttempts === CHOICE_QUIZ_ASSESSMENT_MAX_ATTEMPTS) {
      if (latest?.reveal !== null && latest !== null) {
        context.addIssue({
          code: "custom",
          path: ["latestFeedback", "reveal"],
          message: "Assessment feedback must not reveal the answer key.",
        });
      }
      if (latest?.canRetry) {
        context.addIssue({
          code: "custom",
          path: ["latestFeedback", "canRetry"],
          message: "Assessment feedback cannot offer a retry.",
        });
      }
      return;
    }

    if (latest?.isCorrect && latest.reveal === null) {
      context.addIssue({
        code: "custom",
        path: ["latestFeedback", "reveal"],
        message: "Correct practice feedback must reveal the answer.",
      });
    }
    if (
      latest &&
      !latest.isCorrect &&
      execution.remainingAttempts === 0 &&
      latest.reveal === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["latestFeedback", "reveal"],
        message: "Exhausted practice feedback must reveal the answer.",
      });
    }
  });

export type ChoiceQuizLearnerExecution = z.infer<
  typeof choiceQuizLearnerExecutionSchema
>;

/** Internal service-role RPC result; the service replaces the live payload
 * with this already-persisted definition before anything reaches a learner. */
export const issuedChoiceQuizProjectionSchema = z
  .object({
    learnerDefinition: choiceQuizLearnerDeliverySchema,
    execution: choiceQuizLearnerExecutionSchema,
  })
  .strict();

export type IssuedChoiceQuizProjection = z.infer<
  typeof issuedChoiceQuizProjectionSchema
>;

export const submitChoiceQuizAttemptInputSchema = z
  .object({
    idempotencyKey: postgresUuidSchema,
    cursorRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    selectedOptionIds: choiceQuizOptionIdArraySchema,
  })
  .strict();

export type SubmitChoiceQuizAttemptInput = z.infer<
  typeof submitChoiceQuizAttemptInputSchema
>;

export const submitChoiceQuizAttemptResultSchema = z
  .object({ execution: choiceQuizLearnerExecutionSchema })
  .strict();

export type SubmitChoiceQuizAttemptResult = z.infer<
  typeof submitChoiceQuizAttemptResultSchema
>;

const historyOptionSchema = z
  .object({
    id: postgresUuidSchema,
    label: z.string().trim().min(1).max(500),
  })
  .strict();

export const choiceQuizHistoryItemSchema = z
  .object({
    issueRef: choiceQuizIssueRefSchema,
    evaluationId: postgresUuidSchema,
    supersedesEvaluationId: postgresUuidSchema.nullable(),
    supersededByEvaluationId: postgresUuidSchema.nullable(),
    learnerProfileId: postgresUuidSchema,
    learnerDisplayName: z.string().trim().min(1).max(160),
    componentLabelAtTime: z.string().trim().min(1).max(2_000),
    objectiveTitleAtTime: z.string().trim().min(1).max(500).nullable(),
    activityRole: z.enum(["practice", "assessment"]),
    question: z.string().trim().min(1).max(2_000),
    shownOptions: z
      .array(historyOptionSchema)
      .min(2)
      .max(CHOICE_QUIZ_MAX_OPTIONS),
    attemptNumber: z
      .number()
      .int()
      .positive()
      .max(CHOICE_QUIZ_PRACTICE_MAX_ATTEMPTS),
    selectedOptions: z
      .array(historyOptionSchema)
      .min(1)
      .max(CHOICE_QUIZ_MAX_OPTIONS),
    isCorrect: z.boolean(),
    score: binaryScoreSchema,
    supportContext: z.enum(["independent", "with_support"]),
    hintCount: z.literal(0),
    revealAvailable: z.boolean(),
    evaluatorVersion: z.literal(CHOICE_QUIZ_EVALUATOR_VERSION),
    evaluatorFingerprint: choiceQuizEvaluatorFingerprintSchema,
    evaluatedAt: timestampSchema,
    correctionReason: z.string().trim().min(1).max(500).nullable(),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.score !== (item.isCorrect ? 1 : 0)) {
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "Quiz history score must match correctness.",
      });
    }
    const shownIds = new Set(item.shownOptions.map((option) => option.id));
    if (
      new Set(item.shownOptions.map((option) => option.id)).size !==
        item.shownOptions.length ||
      new Set(item.selectedOptions.map((option) => option.id)).size !==
        item.selectedOptions.length ||
      item.selectedOptions.some((option) => !shownIds.has(option.id))
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectedOptions"],
        message: "Quiz history options are inconsistent.",
      });
    }
  });

export const choiceQuizTeacherHistorySchema = z
  .object({
    items: z.array(choiceQuizHistoryItemSchema).max(5_000),
    truncated: z.boolean(),
  })
  .strict();

export type ChoiceQuizTeacherHistory = z.infer<
  typeof choiceQuizTeacherHistorySchema
>;

export const correctChoiceQuizEvaluationInputSchema = z
  .object({
    idempotencyKey: postgresUuidSchema,
    isCorrect: z.boolean(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export type CorrectChoiceQuizEvaluationInput = z.infer<
  typeof correctChoiceQuizEvaluationInputSchema
>;

export const correctChoiceQuizEvaluationResultSchema = z
  .object({ evaluation: choiceQuizHistoryItemSchema })
  .strict();

export type CorrectChoiceQuizEvaluationResult = z.infer<
  typeof correctChoiceQuizEvaluationResultSchema
>;

export function parseChoiceQuizInput<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ChoiceQuizValidationError(
    parsed.error.issues[0]?.message ?? "Проверьте ответ на вопрос.",
  );
}

export class ChoiceQuizValidationError extends Error {
  readonly name = "ChoiceQuizValidationError";
  readonly code = "choice_quiz_validation_error";
}
