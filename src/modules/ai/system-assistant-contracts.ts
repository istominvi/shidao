import { z } from "zod";
import {
  addLessonInputSchema,
  courseDraftInputSchema,
} from "@/modules/course-builder/contracts";
import {
  aiAssistantMessageSchema,
  type AiAssistantMessage,
  type AiProviderMetadata,
} from "./course-builder-contracts";

const MAX_SYSTEM_ASSISTANT_HISTORY_CHARACTERS = 24_000;

export const systemAssistantPageViewSchema = z.enum([
  "courses_mine",
  "courses_catalog",
  "course_lessons",
  "course_about",
  "course_materials",
  "course_history",
  "lesson_plan",
  "lesson_student",
  "lesson_homework",
  "lesson_materials",
  "lesson_history",
  "students_learners",
  "students_groups",
  "students_observing",
]);

export const systemAssistantPageContextSchema = z
  .object({
    surface: z.enum([
      "schedule",
      "students",
      "courses",
      "course_new",
      "course",
      "lesson",
      "student_preview",
      "learning_profile",
      "profile_settings",
      "security_settings",
      "observer_settings",
      "onboarding",
      "other",
    ]),
    view: systemAssistantPageViewSchema.nullable(),
    courseId: z.uuid().nullable(),
    lessonId: z.uuid().nullable(),
    localDate: z.iso.date(),
    utcOffsetMinutes: z
      .number()
      .int()
      .min(-14 * 60)
      .max(14 * 60),
  })
  .strict()
  .superRefine((page, context) => {
    if (page.lessonId && !page.courseId) {
      context.addIssue({
        code: "custom",
        path: ["lessonId"],
        message: "Контекст урока требует контекст курса.",
      });
    }
    const courseSurface = ["course", "lesson", "student_preview"].includes(
      page.surface,
    );
    if (courseSurface && !page.courseId) {
      context.addIssue({
        code: "custom",
        path: ["courseId"],
        message: "Для этой страницы нужен контекст курса.",
      });
    }
    if (page.surface === "lesson" && !page.lessonId) {
      context.addIssue({
        code: "custom",
        path: ["lessonId"],
        message: "Для страницы урока нужен контекст урока.",
      });
    }
    if (!courseSurface && (page.courseId || page.lessonId)) {
      context.addIssue({
        code: "custom",
        path: ["courseId"],
        message: "Эта страница не принимает контекст курса или урока.",
      });
    }

    const viewMatchesSurface =
      (page.surface === "courses" && page.view?.startsWith("courses_")) ||
      (page.surface === "course" && page.view?.startsWith("course_")) ||
      (page.surface === "lesson" && page.view?.startsWith("lesson_")) ||
      (page.surface === "students" && page.view?.startsWith("students_")) ||
      (!["courses", "course", "lesson", "students"].includes(page.surface) &&
        page.view === null);
    if (!viewMatchesSurface) {
      context.addIssue({
        code: "custom",
        path: ["view"],
        message: "Раздел страницы не соответствует открытой поверхности.",
      });
    }
  });

export const systemAssistantRequestSchema = z
  .object({
    page: systemAssistantPageContextSchema,
    messages: z.array(aiAssistantMessageSchema).min(1).max(16),
  })
  .strict()
  .superRefine((input, context) => {
    const totalCharacters = input.messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );
    if (totalCharacters > MAX_SYSTEM_ASSISTANT_HISTORY_CHARACTERS) {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: "История диалога слишком длинная. Начните новый диалог.",
      });
    }
    if (input.messages.at(-1)?.role !== "user") {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: "Последнее сообщение должно быть от пользователя.",
      });
    }
  });

/**
 * RouterAI currently behaves more reliably with one flat, fully-required JSON
 * object than with a nested discriminated union. Unused fields stay empty and
 * are converted to canonical Course Builder contracts before an action can be
 * shown to the user.
 */
export const systemAssistantProviderTurnSchema = z
  .object({
    kind: z.enum(["answer", "create_course", "add_lesson"]),
    message: z.string().trim().min(1).max(6_000),
    courseRef: z.string().trim().max(64),
    title: z.string().trim().max(180),
    subject: z.string().trim().max(160),
    goal: z.string().trim().max(1_200),
    level: z.string().trim().max(240),
    audienceDescription: z.string().trim().max(1_200),
    targetLessonCount: z.number().int().min(0).max(60),
    teacherPreferences: z.string().trim().max(2_000),
    summary: z.string().trim().max(1_200),
  })
  .strict();

const createCourseAssistantActionSchema = z
  .object({
    type: z.literal("course.create_draft"),
    input: courseDraftInputSchema.strict(),
  })
  .strict();

const addLessonAssistantActionSchema = z
  .object({
    type: z.literal("course.add_lesson"),
    courseId: z.uuid(),
    courseTitle: z.string().trim().min(1).max(160),
    input: addLessonInputSchema.strict(),
  })
  .strict();

export const systemAssistantActionSchema = z.discriminatedUnion("type", [
  createCourseAssistantActionSchema,
  addLessonAssistantActionSchema,
]);

export const systemAssistantApplyRequestSchema = z
  .object({
    idempotencyKey: z.uuid(),
    action: systemAssistantActionSchema,
  })
  .strict();

export type SystemAssistantPageContext = z.infer<
  typeof systemAssistantPageContextSchema
>;
export type SystemAssistantPageView = z.infer<
  typeof systemAssistantPageViewSchema
>;
export type SystemAssistantRequest = z.infer<
  typeof systemAssistantRequestSchema
>;
export type SystemAssistantProviderTurn = z.infer<
  typeof systemAssistantProviderTurnSchema
>;
export type SystemAssistantAction = z.infer<typeof systemAssistantActionSchema>;
export type SystemAssistantApplyRequest = z.infer<
  typeof systemAssistantApplyRequestSchema
>;

export type SystemAssistantActionProposal = {
  idempotencyKey: string;
  action: SystemAssistantAction;
};

export type SystemAssistantReply = AiProviderMetadata & {
  message: AiAssistantMessage & { role: "assistant" };
  proposedAction: SystemAssistantActionProposal | null;
  sharedHistoryUsed: boolean;
};

export type SystemAssistantActionResult =
  | {
      type: "course.create_draft";
      courseId: string;
      courseTitle: string;
      href: string;
    }
  | {
      type: "course.add_lesson";
      courseId: string;
      courseTitle: string;
      lessonId: string;
      lessonTitle: string;
      href: string;
    };
