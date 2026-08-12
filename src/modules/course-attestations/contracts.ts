import { z } from "zod";
import { postgresUuidSchema } from "@/lib/postgres-uuid";
import type {
  AccountAttestationCredential,
  CourseAttestationDefinition,
  CourseAttestationState,
} from "./domain";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);

const optionSchema = z
  .object({
    id: identifierSchema,
    label: z.string().trim().min(1).max(500),
  })
  .strict();

const authoredQuestionShape = {
  id: identifierSchema,
  prompt: z.string().trim().min(1).max(2_000),
  options: z.array(optionSchema).min(2).max(8),
  correctOptionId: identifierSchema,
  explanation: z.string().trim().max(2_000),
} satisfies z.ZodRawShape;

const authoredQuestionSchema = z
  .object(authoredQuestionShape)
  .strict()
  .superRefine((question, context) => {
    const optionIds = question.options.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Идентификаторы вариантов ответа должны быть уникальны.",
      });
    }
    if (!optionIds.includes(question.correctOptionId)) {
      context.addIssue({
        code: "custom",
        message: "Правильный ответ должен ссылаться на один из вариантов.",
      });
    }
  });

export const courseAttestationDefinitionSchema = z
  .object({
    version: z.number().int().positive(),
    title: z.string().trim().min(2).max(240),
    description: z.string().trim().max(2_000),
    passingScorePercent: z.number().int().min(1).max(100),
    questions: z.array(authoredQuestionSchema).min(1).max(50),
  })
  .strict()
  .superRefine((assessment, context) => {
    const questionIds = assessment.questions.map((question) => question.id);
    if (new Set(questionIds).size !== questionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Идентификаторы вопросов должны быть уникальны.",
      });
    }
  });

const safeQuestionSchema = z
  .object({
    id: authoredQuestionShape.id,
    prompt: authoredQuestionShape.prompt,
    options: authoredQuestionShape.options,
  })
  .extend({
    selectedOptionId: identifierSchema.nullable(),
    correctOptionId: identifierSchema.nullable(),
    explanation: z.string().max(2_000).nullable(),
  })
  .strict();

const attemptSchema = z
  .object({
    id: postgresUuidSchema,
    scorePercent: z.number().int().min(0).max(100),
    passed: z.boolean(),
    completedAt: z.string(),
    selectedOptionByQuestionId: z.record(identifierSchema, identifierSchema),
  })
  .strict();

export const courseAttestationStateSchema = z
  .object({
    publicationId: postgresUuidSchema,
    revisionId: postgresUuidSchema,
    title: z.string().trim().min(2).max(240),
    description: z.string().max(2_000),
    passingScorePercent: z.number().int().min(1).max(100),
    version: z.number().int().positive(),
    questions: z.array(safeQuestionSchema).min(1).max(50),
    attempt: attemptSchema.nullable(),
    certified: z.boolean(),
  })
  .strict()
  .superRefine((state, context) => {
    const questionIds = state.questions.map((question) => question.id);
    if (new Set(questionIds).size !== questionIds.length) {
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Идентификаторы вопросов должны быть уникальны.",
      });
    }

    for (const [index, question] of state.questions.entries()) {
      const optionIds = question.options.map((option) => option.id);
      if (new Set(optionIds).size !== optionIds.length) {
        context.addIssue({
          code: "custom",
          path: ["questions", index, "options"],
          message: "Идентификаторы вариантов ответа должны быть уникальны.",
        });
      }
      if (
        question.selectedOptionId !== null &&
        !optionIds.includes(question.selectedOptionId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["questions", index, "selectedOptionId"],
          message: "Выбранный ответ отсутствует среди вариантов.",
        });
      }
      if (
        question.correctOptionId !== null &&
        !optionIds.includes(question.correctOptionId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["questions", index, "correctOptionId"],
          message: "Правильный ответ отсутствует среди вариантов.",
        });
      }
    }

    if (!state.attempt) {
      if (state.certified) {
        context.addIssue({
          code: "custom",
          path: ["certified"],
          message: "Аттестация не может быть подтверждена без попытки.",
        });
      }
      for (const [index, question] of state.questions.entries()) {
        if (question.selectedOptionId !== null) {
          context.addIssue({
            code: "custom",
            path: ["questions", index, "selectedOptionId"],
            message: "Выбранный ответ требует сохранённой попытки.",
          });
        }
      }
    } else {
      const submittedQuestionIds = Object.keys(
        state.attempt.selectedOptionByQuestionId,
      );
      if (
        submittedQuestionIds.length !== questionIds.length ||
        submittedQuestionIds.some(
          (questionId) => questionIds.includes(questionId) === false,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["attempt", "selectedOptionByQuestionId"],
          message: "Попытка должна содержать ответ на каждый вопрос.",
        });
      }
      for (const [index, question] of state.questions.entries()) {
        const attemptedOptionId =
          state.attempt.selectedOptionByQuestionId[question.id];
        if (
          !attemptedOptionId ||
          question.selectedOptionId !== attemptedOptionId
        ) {
          context.addIssue({
            code: "custom",
            path: ["questions", index, "selectedOptionId"],
            message: "Выбранный ответ не совпадает с сохранённой попыткой.",
          });
        }
      }
      if (
        state.attempt.passed !==
        state.attempt.scorePercent >= state.passingScorePercent
      ) {
        context.addIssue({
          code: "custom",
          path: ["attempt", "passed"],
          message: "Результат попытки не соответствует проходному баллу.",
        });
      }
      if (state.certified !== state.attempt.passed) {
        context.addIssue({
          code: "custom",
          path: ["certified"],
          message: "Статус аттестации не соответствует результату попытки.",
        });
      }
    }

    for (const [index, question] of state.questions.entries()) {
      if (state.certified) {
        if (question.selectedOptionId === null) {
          context.addIssue({
            code: "custom",
            path: ["questions", index, "selectedOptionId"],
            message: "Пройденная аттестация должна содержать выбранный ответ.",
          });
        }
        if (question.correctOptionId === null) {
          context.addIssue({
            code: "custom",
            path: ["questions", index, "correctOptionId"],
            message: "Пройденная аттестация должна содержать правильный ответ.",
          });
        }
        if (question.explanation === null) {
          context.addIssue({
            code: "custom",
            path: ["questions", index, "explanation"],
            message: "Пройденная аттестация должна содержать объяснение.",
          });
        }
      } else if (
        question.correctOptionId !== null ||
        question.explanation !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["questions", index],
          message: "Ключи ответов доступны только после аттестации.",
        });
      }
    }
  });

export const submitCourseAttestationSchema = z
  .object({
    expectedRevisionId: postgresUuidSchema,
    selectedOptionByQuestionId: z
      .record(identifierSchema, identifierSchema)
      .refine((answers) => Object.keys(answers).length <= 50, {
        message: "Передано слишком много ответов.",
      }),
  })
  .strict();

export const accountAttestationCredentialSchema = z
  .object({
    publicationId: postgresUuidSchema,
    revisionId: postgresUuidSchema,
    courseTitle: z.string(),
    courseSubject: z.string(),
    assessmentTitle: z.string(),
    publisherDisplayName: z.string(),
    scorePercent: z.number().int().min(0).max(100),
    passingScorePercent: z.number().int().min(1).max(100),
    completedAt: z.string(),
    assessmentVersion: z.number().int().positive(),
    isCurrentRevision: z.boolean(),
    publicationAvailable: z.boolean(),
  })
  .strict();

export type SubmitCourseAttestationInput = z.infer<
  typeof submitCourseAttestationSchema
>;

export function parseCourseAttestationDefinition(
  value: unknown,
): CourseAttestationDefinition {
  return courseAttestationDefinitionSchema.parse(value);
}

export function parseCourseAttestationState(
  value: unknown,
): CourseAttestationState {
  return courseAttestationStateSchema.parse(value);
}

export function parseAccountAttestationCredentials(
  value: unknown,
): AccountAttestationCredential[] {
  return z.array(accountAttestationCredentialSchema).parse(value);
}
