import "server-only";

import { postgresUuidSchema } from "@/lib/postgres-uuid";
import {
  choiceQuizLearnerDeliverySchema,
  projectComponentEvaluatorConfig,
  projectLearnerComponentPayload,
} from "@/modules/course-builder/registry/contracts";
import {
  CHOICE_QUIZ_ASSESSMENT_MAX_ATTEMPTS,
  CHOICE_QUIZ_PRACTICE_MAX_ATTEMPTS,
  choiceQuizIssueRefSchema,
  correctChoiceQuizEvaluationInputSchema,
  parseChoiceQuizInput,
  submitChoiceQuizAttemptInputSchema,
} from "./contracts";
import type {
  ChoiceQuizLearnerActor,
  IssueChoiceQuizDefinitionInput,
} from "./domain";
import { ChoiceQuizProjectionError, ChoiceQuizRepositoryError } from "./errors";
import type {
  ChoiceQuizLearnerRepository,
  ChoiceQuizTeacherRepository,
} from "./repository";

type ChoiceQuizServiceDependencies = {
  learnerRepository?: ChoiceQuizLearnerRepository;
  teacherRepository?: ChoiceQuizTeacherRepository;
};

function requireLearnerRepository(
  repository: ChoiceQuizLearnerRepository | undefined,
) {
  if (!repository) {
    throw new Error("Learner choice quiz repository is not configured.");
  }
  return repository;
}

function requireTeacherRepository(
  repository: ChoiceQuizTeacherRepository | undefined,
) {
  if (!repository) {
    throw new Error("Teacher choice quiz repository is not configured.");
  }
  return repository;
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ChoiceQuizProjectionError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(",")}}`;
  }
  throw new ChoiceQuizProjectionError();
}

function assertIssuedProjectionMatches(input: {
  role: "practice" | "assessment";
  learnerDefinition: ReturnType<typeof choiceQuizLearnerDeliverySchema.parse>;
  evaluatorConfig: {
    correctOptionIds: string[];
    allowMultiple: boolean;
    explanation?: string;
  };
  issued: Awaited<ReturnType<ChoiceQuizLearnerRepository["issueDefinition"]>>;
}) {
  const { role, learnerDefinition, evaluatorConfig, issued } = input;
  if (
    canonicalJson(issued.learnerDefinition) !== canonicalJson(learnerDefinition)
  ) {
    throw new ChoiceQuizProjectionError();
  }

  const expectedMaxAttempts =
    role === "practice"
      ? CHOICE_QUIZ_PRACTICE_MAX_ATTEMPTS
      : CHOICE_QUIZ_ASSESSMENT_MAX_ATTEMPTS;
  if (issued.execution.maxAttempts !== expectedMaxAttempts) {
    throw new ChoiceQuizProjectionError();
  }

  const shownOptionIds = new Set(
    learnerDefinition.options.map((option) => option.id),
  );
  const latest = issued.execution.latestFeedback;
  if (
    latest?.selectedOptionIds.some(
      (optionId) => !shownOptionIds.has(optionId),
    ) ||
    (!learnerDefinition.allowMultiple &&
      latest !== null &&
      latest.selectedOptionIds.length !== 1)
  ) {
    throw new ChoiceQuizProjectionError();
  }

  if (latest?.reveal) {
    const revealedIds = [...latest.reveal.correctOptionIds].sort();
    const expectedIds = [...evaluatorConfig.correctOptionIds].sort();
    if (
      canonicalJson(revealedIds) !== canonicalJson(expectedIds) ||
      latest.reveal.explanation !== evaluatorConfig.explanation
    ) {
      throw new ChoiceQuizProjectionError();
    }
  }
}

export function createChoiceQuizService(
  dependencies: ChoiceQuizServiceDependencies,
) {
  return {
    async issueLiveDefinition(input: IssueChoiceQuizDefinitionInput) {
      const role = input.component.activityRole;
      if (role === null) return null;
      if (role !== "practice" && role !== "assessment") {
        throw new ChoiceQuizProjectionError();
      }

      try {
        const learnerDefinition = choiceQuizLearnerDeliverySchema.parse(
          projectLearnerComponentPayload(
            "choice_quiz",
            input.component.payload,
          ),
        );
        const evaluatorConfig = projectComponentEvaluatorConfig(
          "choice_quiz",
          input.component.payload,
        );
        const issued = await requireLearnerRepository(
          dependencies.learnerRepository,
        ).issueDefinition({
          actor: input.actor,
          lessonRunId: input.lessonRunId,
          cursorRevision: input.cursorRevision,
          componentId: input.component.id,
          expectedComponentUpdatedAt: input.component.updatedAt,
          learnerDefinition,
          evaluatorConfig,
        });
        assertIssuedProjectionMatches({
          role,
          learnerDefinition,
          evaluatorConfig,
          issued,
        });
        return issued;
      } catch (error) {
        if (
          error instanceof ChoiceQuizProjectionError ||
          error instanceof ChoiceQuizRepositoryError
        ) {
          throw error;
        }
        throw new ChoiceQuizProjectionError();
      }
    },

    submitAttempt(
      actor: ChoiceQuizLearnerActor,
      lessonRunIdValue: unknown,
      issueRefValue: unknown,
      rawInput: unknown,
    ) {
      const lessonRunId = parseChoiceQuizInput(
        postgresUuidSchema,
        lessonRunIdValue,
      );
      const issueRef = parseChoiceQuizInput(
        choiceQuizIssueRefSchema,
        issueRefValue,
      );
      const input = parseChoiceQuizInput(
        submitChoiceQuizAttemptInputSchema,
        rawInput,
      );
      return requireLearnerRepository(
        dependencies.learnerRepository,
      ).submitAttempt(actor, lessonRunId, issueRef, input);
    },

    getTeacherHistory(lessonRunIdValue: unknown) {
      const lessonRunId = parseChoiceQuizInput(
        postgresUuidSchema,
        lessonRunIdValue,
      );
      return requireTeacherRepository(
        dependencies.teacherRepository,
      ).getHistory(lessonRunId);
    },

    correctTeacherEvaluation(evaluationIdValue: unknown, rawInput: unknown) {
      const evaluationId = parseChoiceQuizInput(
        postgresUuidSchema,
        evaluationIdValue,
      );
      const input = parseChoiceQuizInput(
        correctChoiceQuizEvaluationInputSchema,
        rawInput,
      );
      return requireTeacherRepository(
        dependencies.teacherRepository,
      ).correctEvaluation(evaluationId, input);
    },
  };
}

export type ChoiceQuizApplicationService = ReturnType<
  typeof createChoiceQuizService
>;
