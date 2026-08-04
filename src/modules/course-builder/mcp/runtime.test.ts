import assert from "node:assert/strict";
import test from "node:test";
import type { CourseBuilderRepository } from "../repository";
import type { CourseBuilderApplicationService } from "../service";
import {
  CourseBuilderMcpAuthenticationError,
  CourseBuilderMcpConfigurationError,
  courseBuilderMcpEnvironmentNames,
  createCourseBuilderMcpContextResolver,
  readCourseBuilderMcpEnvironment,
} from "./runtime";

const ACTOR_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OTHER_ACTOR_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const TOKEN_ISSUED_AT_SECONDS = 1_700_000_000;

function userJwt(issuedAtSeconds = TOKEN_ISSUED_AT_SECONDS) {
  return `header.${Buffer.from(
    JSON.stringify({
      sub: ACTOR_ID,
      role: "authenticated",
      iat: issuedAtSeconds,
    }),
  ).toString("base64url")}.signature`;
}

function environment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.shidao.test/",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
    SHIDAO_MCP_SUPABASE_ACCESS_TOKEN: userJwt(),
    SHIDAO_MCP_AUTH_USER_ID: ACTOR_ID,
    ...overrides,
  };
}

test("runtime requires only the four explicit public/user environment values", () => {
  assert.deepEqual(courseBuilderMcpEnvironmentNames, [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SHIDAO_MCP_SUPABASE_ACCESS_TOKEN",
    "SHIDAO_MCP_AUTH_USER_ID",
  ]);
  for (const name of courseBuilderMcpEnvironmentNames) {
    const candidate = environment();
    delete candidate[name];
    assert.throws(
      () => readCourseBuilderMcpEnvironment(candidate),
      (error: unknown) =>
        error instanceof CourseBuilderMcpConfigurationError &&
        error.message.includes(name),
    );
  }
});

test("runtime rejects a privileged key before contacting Auth", () => {
  assert.throws(
    () =>
      readCourseBuilderMcpEnvironment(
        environment({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_example" }),
      ),
    CourseBuilderMcpConfigurationError,
  );

  const privilegedPayload = Buffer.from(
    JSON.stringify({ role: "service_role" }),
  ).toString("base64url");
  assert.throws(
    () =>
      readCourseBuilderMcpEnvironment(
        environment({
          NEXT_PUBLIC_SUPABASE_ANON_KEY: `header.${privilegedPayload}.sig`,
        }),
      ),
    CourseBuilderMcpConfigurationError,
  );
});

test("context verifies getUser identity before creating the RLS repository", async () => {
  const calls: string[] = [];
  const repository = {
    getSessionInvalidBefore: async () => null,
  } as CourseBuilderRepository;
  const service = {} as CourseBuilderApplicationService;
  const resolveContext = createCourseBuilderMcpContextResolver({
    environment: environment(),
    resolveUser: async (input) => {
      calls.push(
        `${input.supabaseUrl}|${input.supabaseAnonKey}|${input.accessToken}`,
      );
      return { id: ACTOR_ID };
    },
    createRepository: (accessToken) => {
      calls.push(`repository:${accessToken}`);
      return repository;
    },
    createService: (dependencies) => {
      assert.equal(dependencies.repository, repository);
      calls.push("service");
      return service;
    },
  });

  const context = await resolveContext();
  assert.deepEqual(context.actor, {
    authUserId: ACTOR_ID,
    accessToken: userJwt(),
  });
  assert.equal(context.service, service);
  assert.deepEqual(calls, [
    `https://supabase.shidao.test|public-anon-key|${userJwt()}`,
    `repository:${userJwt()}`,
    "service",
  ]);
});

test("context fails closed when getUser returns a different actor", async () => {
  let repositoryCreated = false;
  const resolveContext = createCourseBuilderMcpContextResolver({
    environment: environment(),
    resolveUser: async () => ({ id: OTHER_ACTOR_ID }),
    createRepository: () => {
      repositoryCreated = true;
      return {
        getSessionInvalidBefore: async () => null,
      } as CourseBuilderRepository;
    },
  });

  await assert.rejects(resolveContext, CourseBuilderMcpAuthenticationError);
  assert.equal(repositoryCreated, false);
});

test("context hides Auth client/network errors behind a stable error", async () => {
  const resolveContext = createCourseBuilderMcpContextResolver({
    environment: environment(),
    resolveUser: async () => {
      throw new Error("request contained short-lived-user-jwt");
    },
  });

  await assert.rejects(
    resolveContext,
    (error: unknown) =>
      error instanceof CourseBuilderMcpAuthenticationError &&
      !error.message.includes("short-lived-user-jwt"),
  );
});

test("context rejects a verified JWT issued before the global session cutoff", async () => {
  const resolveContext = createCourseBuilderMcpContextResolver({
    environment: environment({
      SHIDAO_MCP_SUPABASE_ACCESS_TOKEN: userJwt(TOKEN_ISSUED_AT_SECONDS),
    }),
    resolveUser: async () => ({ id: ACTOR_ID }),
    createRepository: () =>
      ({
        getSessionInvalidBefore: async () =>
          new Date((TOKEN_ISSUED_AT_SECONDS + 60) * 1000).toISOString(),
      }) as CourseBuilderRepository,
  });

  await assert.rejects(
    resolveContext,
    (error: unknown) =>
      error instanceof CourseBuilderMcpAuthenticationError &&
      error.message.includes("session cutoff"),
  );
});
