import { z } from "zod";
import { logger } from "@/lib/server/logger";
import {
  addLessonInputSchema,
  addLessonStepInputSchema,
  courseDraftInputSchema,
  reorderLessonComponentInputSchema,
  uuidSchema,
} from "../contracts";
import type { CourseBuilderActor } from "../domain";
import { lessonAddComponentInputSchema } from "../registry/contracts";
import type { CourseBuilderApplicationService } from "../service";

/**
 * Development-only, in-process MCP adapter for the first Course Builder
 * milestone. This module intentionally does not expose an HTTP transport.
 */
export const courseBuilderMcpToolNames = [
  "course.create_draft",
  "course.get",
  "course.add_lesson",
  "lesson.add_step",
  "lesson.add_component",
  "lesson.reorder_component",
] as const;

export type CourseBuilderMcpToolName =
  (typeof courseBuilderMcpToolNames)[number];

export const courseGetMcpInputSchema = z
  .object({ courseId: uuidSchema })
  .strict();

export const courseAddLessonMcpInputSchema = addLessonInputSchema.extend({
  courseId: uuidSchema,
});

export const lessonAddStepMcpInputSchema = addLessonStepInputSchema.extend({
  lessonId: uuidSchema,
});

export const lessonReorderComponentMcpInputSchema =
  reorderLessonComponentInputSchema.extend({
    componentId: uuidSchema,
  });

/**
 * The values are the canonical application/registry contracts themselves or
 * schemas composed from them. There is no second hand-written MCP schema.
 */
export const courseBuilderMcpInputContracts = {
  "course.create_draft": courseDraftInputSchema,
  "course.get": courseGetMcpInputSchema,
  "course.add_lesson": courseAddLessonMcpInputSchema,
  "lesson.add_step": lessonAddStepMcpInputSchema,
  "lesson.add_component": lessonAddComponentInputSchema,
  "lesson.reorder_component": lessonReorderComponentMcpInputSchema,
} as const satisfies Record<CourseBuilderMcpToolName, z.ZodType>;

export type CourseBuilderMcpInputJsonSchema = z.core.JSONSchema.JSONSchema;

export const courseBuilderMcpInputJsonSchemas = Object.fromEntries(
  courseBuilderMcpToolNames.map((name) => [
    name,
    z.toJSONSchema(courseBuilderMcpInputContracts[name]),
  ]),
) as unknown as Record<
  CourseBuilderMcpToolName,
  CourseBuilderMcpInputJsonSchema
>;

const descriptions = {
  "course.create_draft": "Создать черновик курса преподавателя.",
  "course.get": "Получить доступный преподавателю Course workspace.",
  "course.add_lesson": "Добавить Lesson в Course.",
  "lesson.add_step": "Добавить упорядоченный Lesson Step в Lesson.",
  "lesson.add_component":
    "Добавить learner-visible компонент из Course Builder registry.",
  "lesson.reorder_component":
    "Переместить компонент на новую позицию внутри Lesson Step.",
} as const satisfies Record<CourseBuilderMcpToolName, string>;

export type CourseBuilderMcpApplicationService = Pick<
  CourseBuilderApplicationService,
  | "createDraft"
  | "getCourse"
  | "addLesson"
  | "addStep"
  | "addComponent"
  | "reorderComponent"
>;

export type CourseBuilderMcpTool = Readonly<{
  name: CourseBuilderMcpToolName;
  description: string;
  inputContract: z.ZodType;
  inputSchema: CourseBuilderMcpInputJsonSchema;
  execute: (input: unknown) => Promise<unknown>;
}>;

export type CreateCourseBuilderMcpToolsOptions = Readonly<{
  service: CourseBuilderMcpApplicationService;
  actor: CourseBuilderActor;
  audit?: (event: CourseBuilderMcpAuditEvent) => void | Promise<void>;
}>;

export type CourseBuilderMcpAuditEvent = Readonly<{
  toolName: CourseBuilderMcpToolName;
  actorAuthUserId: string;
  outcome: "success" | "error";
  resultIds?: Readonly<Record<string, string | readonly string[]>>;
  errorCode?: string;
}>;

function resultIdentifiers(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const identifiers: Record<string, string | readonly string[]> = {};
  for (const key of [
    "id",
    "courseId",
    "lessonId",
    "stepId",
    "componentId",
    "lessonIds",
    "stepIds",
    "componentIds",
  ]) {
    const candidate = record[key];
    if (typeof candidate === "string") identifiers[key] = candidate;
    if (
      Array.isArray(candidate) &&
      candidate.every((item) => typeof item === "string")
    ) {
      identifiers[key] = candidate;
    }
  }
  return Object.keys(identifiers).length > 0 ? identifiers : undefined;
}

function withoutSignedAttachmentUrls(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const workspace = value as Record<string, unknown>;
  if (!Array.isArray(workspace.attachments)) return value;
  return {
    ...workspace,
    attachments: workspace.attachments.map((attachment) => {
      if (!attachment || typeof attachment !== "object") return attachment;
      const safeAttachment = {
        ...(attachment as Record<string, unknown>),
      };
      delete safeAttachment.signedUrl;
      return safeAttachment;
    }),
  };
}

export function createCourseBuilderMcpTools({
  service,
  actor,
  audit = (event) => logger.info("[course-builder-mcp] tool", event),
}: CreateCourseBuilderMcpToolsOptions): readonly CourseBuilderMcpTool[] {
  const emitAudit = async (event: CourseBuilderMcpAuditEvent) => {
    try {
      await audit(event);
    } catch {
      // Logging must never turn an already-committed application command into
      // an apparent tool failure.
      logger.warn("[course-builder-mcp] audit write failed", {
        toolName: event.toolName,
        actorAuthUserId: event.actorAuthUserId,
        outcome: event.outcome,
      });
    }
  };

  const execute = async <T>(
    toolName: CourseBuilderMcpToolName,
    operation: () => Promise<T>,
  ) => {
    try {
      const result = await operation();
      await emitAudit({
        toolName,
        actorAuthUserId: actor.authUserId,
        outcome: "success",
        resultIds: resultIdentifiers(result),
      });
      return result;
    } catch (error) {
      await emitAudit({
        toolName,
        actorAuthUserId: actor.authUserId,
        outcome: "error",
        errorCode:
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : error instanceof Error
              ? error.name
              : "unknown_error",
      });
      throw error;
    }
  };

  return [
    {
      name: "course.create_draft",
      description: descriptions["course.create_draft"],
      inputContract: courseBuilderMcpInputContracts["course.create_draft"],
      inputSchema: courseBuilderMcpInputJsonSchemas["course.create_draft"],
      execute: (rawInput) =>
        execute("course.create_draft", () => {
          const input = courseDraftInputSchema.parse(rawInput);
          return service.createDraft(actor, input);
        }),
    },
    {
      name: "course.get",
      description: descriptions["course.get"],
      inputContract: courseBuilderMcpInputContracts["course.get"],
      inputSchema: courseBuilderMcpInputJsonSchemas["course.get"],
      execute: async (rawInput) => {
        const result = await execute("course.get", () => {
          const { courseId } = courseGetMcpInputSchema.parse(rawInput);
          return service.getCourse(actor, courseId);
        });
        return withoutSignedAttachmentUrls(result);
      },
    },
    {
      name: "course.add_lesson",
      description: descriptions["course.add_lesson"],
      inputContract: courseBuilderMcpInputContracts["course.add_lesson"],
      inputSchema: courseBuilderMcpInputJsonSchemas["course.add_lesson"],
      execute: (rawInput) =>
        execute("course.add_lesson", () => {
          const { courseId, ...input } =
            courseAddLessonMcpInputSchema.parse(rawInput);
          return service.addLesson(actor, courseId, input);
        }),
    },
    {
      name: "lesson.add_step",
      description: descriptions["lesson.add_step"],
      inputContract: courseBuilderMcpInputContracts["lesson.add_step"],
      inputSchema: courseBuilderMcpInputJsonSchemas["lesson.add_step"],
      execute: (rawInput) =>
        execute("lesson.add_step", () => {
          const { lessonId, ...input } =
            lessonAddStepMcpInputSchema.parse(rawInput);
          return service.addStep(actor, lessonId, input);
        }),
    },
    {
      name: "lesson.add_component",
      description: descriptions["lesson.add_component"],
      inputContract: courseBuilderMcpInputContracts["lesson.add_component"],
      inputSchema: courseBuilderMcpInputJsonSchemas["lesson.add_component"],
      execute: (rawInput) =>
        execute("lesson.add_component", () => {
          const input = lessonAddComponentInputSchema.parse(rawInput);
          return service.addComponent(actor, input);
        }),
    },
    {
      name: "lesson.reorder_component",
      description: descriptions["lesson.reorder_component"],
      inputContract: courseBuilderMcpInputContracts["lesson.reorder_component"],
      inputSchema: courseBuilderMcpInputJsonSchemas["lesson.reorder_component"],
      execute: (rawInput) =>
        execute("lesson.reorder_component", () => {
          const { componentId, ...input } =
            lessonReorderComponentMcpInputSchema.parse(rawInput);
          return service.reorderComponent(actor, componentId, input);
        }),
    },
  ];
}
