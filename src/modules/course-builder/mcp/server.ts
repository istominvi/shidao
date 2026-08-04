import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "../contracts";
import { CourseBuilderRepositoryError } from "../repository";
import {
  CourseBuilderMcpAuthenticationError,
  CourseBuilderMcpConfigurationError,
  createCourseBuilderMcpContextResolver,
  type CourseBuilderMcpRuntimeContext,
} from "./runtime";
import {
  courseBuilderMcpInputJsonSchemas,
  courseBuilderMcpToolDescriptions,
  courseBuilderMcpToolNames,
  createCourseBuilderMcpTools,
  type CourseBuilderMcpAuditEvent,
  type CourseBuilderMcpToolName,
} from "./tools";

const SERVER_NAME = "shidao-course-builder";
const SERVER_VERSION = "0.1.0";

type SafeMcpError = Readonly<{
  code: string;
  message: string;
}>;

export type CourseBuilderMcpAuditSink = (
  event: CourseBuilderMcpAuditEvent,
) => void | Promise<void>;

export type CreateCourseBuilderMcpServerOptions = Readonly<{
  resolveContext?: () => Promise<CourseBuilderMcpRuntimeContext>;
  audit?: CourseBuilderMcpAuditSink;
}>;

function safeMcpError(error: unknown): SafeMcpError {
  if (
    error instanceof CourseBuilderMcpConfigurationError ||
    error instanceof CourseBuilderMcpAuthenticationError ||
    error instanceof CourseBuilderValidationError ||
    error instanceof CourseBuilderAccessError ||
    error instanceof CourseBuilderConflictError
  ) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof z.ZodError) {
    return {
      code: "validation_error",
      message: "Параметры MCP tool не соответствуют contract.",
    };
  }
  if (error instanceof CourseBuilderRepositoryError) {
    return {
      code: error.code ?? "repository_error",
      message:
        error.status === 401
          ? "Supabase user JWT истёк или был отозван. Обновите MCP credentials."
          : "Не удалось выполнить запрос к хранилищу курсов.",
    };
  }
  return {
    code: "internal_error",
    message: "Не удалось выполнить операцию Course Builder MCP.",
  };
}

function writeSafeAuditToStderr(event: CourseBuilderMcpAuditEvent) {
  // stdout is reserved exclusively for MCP JSON-RPC framing.
  process.stderr.write(
    `[course-builder-mcp] ${JSON.stringify({ event: "tool", ...event })}\n`,
  );
}

function toolAnnotations(toolName: CourseBuilderMcpToolName) {
  const readOnly = toolName === "course.get";
  return {
    readOnlyHint: readOnly,
    destructiveHint: false,
    idempotentHint: readOnly,
    openWorldHint: false,
  };
}

export function createCourseBuilderMcpServer(
  options: CreateCourseBuilderMcpServerOptions = {},
) {
  const resolveContext =
    options.resolveContext ?? createCourseBuilderMcpContextResolver();
  const audit = options.audit ?? writeSafeAuditToStderr;
  const auditWithoutProtocolSideEffects: CourseBuilderMcpAuditSink = async (
    event,
  ) => {
    try {
      await audit(event);
    } catch {
      // Never fall back to the web-app logger: its stdout output would corrupt
      // the stdio JSON-RPC stream.
    }
  };
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { tools: { listChanged: false } },
      instructions:
        "Внутренний Course Builder ShiDao. Все операции выполняются от имени явно настроенного преподавателя и проходят application service и RLS.",
    },
  );

  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: courseBuilderMcpToolNames.map((toolName): Tool => ({
      name: toolName,
      description: courseBuilderMcpToolDescriptions[toolName],
      inputSchema: courseBuilderMcpInputJsonSchemas[
        toolName
      ] as Tool["inputSchema"],
      annotations: toolAnnotations(toolName),
    })),
  }));

  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = courseBuilderMcpToolNames.find(
      (candidate) => candidate === request.params.name,
    );
    if (!toolName) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              code: "unknown_tool",
              message: "Course Builder MCP tool не зарегистрирован.",
            }),
          },
        ],
        isError: true,
      };
    }

    try {
      const context = await resolveContext();
      const tool = createCourseBuilderMcpTools({
        service: context.service,
        actor: context.actor,
        audit: auditWithoutProtocolSideEffects,
      }).find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error("Unregistered Course Builder MCP tool.");
      const result = await tool.execute(request.params.arguments ?? {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2) ?? "null",
          },
        ],
      };
    } catch (error) {
      const safe = safeMcpError(error);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(safe),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
