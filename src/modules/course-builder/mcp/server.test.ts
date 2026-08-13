import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CourseBuilderActor, CourseWorkspace } from "../domain";
import type { CourseBuilderApplicationService } from "../service";
import {
  CourseBuilderMcpConfigurationError,
  type CourseBuilderMcpRuntimeContext,
} from "./runtime";
import {
  createCourseBuilderMcpServer,
  type CourseBuilderMcpAuditSink,
} from "./server";
import { courseBuilderMcpToolNames } from "./tools";

const ACTOR: CourseBuilderActor = {
  authUserId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  accessToken: "private-user-jwt",
};
const COURSE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function connectTestClient(context: {
  resolveContext: () => Promise<CourseBuilderMcpRuntimeContext>;
  audit?: CourseBuilderMcpAuditSink;
}) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createCourseBuilderMcpServer(context);
  const client = new Client({ name: "course-builder-test", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

function serviceDouble(
  overrides: Partial<CourseBuilderApplicationService> = {},
) {
  const unavailable = () => Promise.reject(new Error("unexpected method"));
  return {
    createDraft: unavailable,
    getCourse: unavailable,
    addLesson: unavailable,
    addComponent: unavailable,
    reorderComponent: unavailable,
    ...overrides,
  } as CourseBuilderApplicationService;
}

test("stdio MCP advertises exactly six tools with canonical JSON schemas", async () => {
  let contextCalls = 0;
  const { client, server } = await connectTestClient({
    resolveContext: async () => {
      contextCalls += 1;
      throw new Error("listTools must not resolve credentials");
    },
  });
  try {
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map((tool) => tool.name),
      courseBuilderMcpToolNames,
    );
    assert.equal(contextCalls, 0);
    const createDraft = listed.tools.find(
      (tool) => tool.name === "course.create_draft",
    );
    const addComponent = listed.tools.find(
      (tool) => tool.name === "lesson.add_component",
    );
    const addComponentSchema = JSON.stringify(addComponent?.inputSchema);
    assert.match(JSON.stringify(createDraft?.inputSchema), /targetLessonCount/);
    assert.match(addComponentSchema, /single_choice_poll/);
    assert.match(addComponentSchema, /lessonId/);
    assert.doesNotMatch(addComponentSchema, /lessonStepId/);
    assert.doesNotMatch(addComponentSchema, /"const":"heading"/);
  } finally {
    await client.close();
    await server.close().catch(() => undefined);
  }
});

test("missing credentials fail on invocation, not server startup", async () => {
  const { client, server } = await connectTestClient({
    resolveContext: async () => {
      throw new CourseBuilderMcpConfigurationError(
        "Для локального Course Builder MCP задайте SHIDAO_MCP_SUPABASE_ACCESS_TOKEN.",
      );
    },
  });
  try {
    const result = await client.callTool({
      name: "course.get",
      arguments: { courseId: COURSE_ID },
    });
    assert.equal(result.isError, true);
    const serialized = JSON.stringify(result.content);
    assert.match(serialized, /mcp_configuration_error/);
    assert.match(serialized, /SHIDAO_MCP_SUPABASE_ACCESS_TOKEN/);
  } finally {
    await client.close();
    await server.close().catch(() => undefined);
  }
});

test("tool calls pass through the existing adapter and application service", async () => {
  const calls: unknown[][] = [];
  const audits: unknown[] = [];
  const service = serviceDouble({
    getCourse: async (actor, courseId) => {
      calls.push([actor, courseId]);
      return {
        id: COURSE_ID,
        title: "Проверка MCP",
        attachments: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            signedUrl: "https://storage.invalid/private?token=secret",
          },
        ],
      } as unknown as CourseWorkspace;
    },
  });
  const { client, server } = await connectTestClient({
    resolveContext: async () => ({ actor: ACTOR, service }),
    audit: (event) => {
      audits.push(event);
    },
  });
  try {
    const result = await client.callTool({
      name: "course.get",
      arguments: { courseId: COURSE_ID },
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(calls, [[ACTOR, COURSE_ID]]);
    assert.doesNotMatch(JSON.stringify(result), /token=secret|signedUrl/);
    assert.deepEqual(audits, [
      {
        toolName: "course.get",
        actorAuthUserId: ACTOR.authUserId,
        outcome: "success",
        resultIds: { id: COURSE_ID },
      },
    ]);
  } finally {
    await client.close();
    await server.close().catch(() => undefined);
  }
});

test("the executable transport is local stdio only and never logs to stdout", () => {
  const serverSource = readFileSync(
    "src/modules/course-builder/mcp/server.ts",
    "utf8",
  );
  const stdioSource = readFileSync(
    "src/modules/course-builder/mcp/stdio.ts",
    "utf8",
  );
  const entrySource = readFileSync("scripts/course-builder-mcp.ts", "utf8");
  const combined = `${serverSource}\n${stdioSource}\n${entrySource}`;

  assert.match(stdioSource, /StdioServerTransport/);
  assert.doesNotMatch(
    combined,
    /StreamableHTTP|SSEServerTransport|createServer\(|\.listen\(/,
  );
  assert.doesNotMatch(combined, /console\.(?:log|info|debug)\(/);
  assert.doesNotMatch(combined, /SUPABASE_SERVICE_ROLE_KEY/);
});
