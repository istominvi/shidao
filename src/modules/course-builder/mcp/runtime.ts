import { createClient } from "@supabase/supabase-js";
import { uuidSchema } from "../contracts";
import type { CourseBuilderActor } from "../domain";
import {
  createCourseBuilderRepository,
  type CourseBuilderRepository,
} from "../repository";
import {
  createCourseBuilderService,
  type CourseBuilderApplicationService,
} from "../service";

export const courseBuilderMcpEnvironmentNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SHIDAO_MCP_SUPABASE_ACCESS_TOKEN",
  "SHIDAO_MCP_AUTH_USER_ID",
] as const;

export type CourseBuilderMcpProcessEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type CourseBuilderMcpEnvironment = Readonly<{
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  actorAuthUserId: string;
}>;

export type CourseBuilderMcpRuntimeContext = Readonly<{
  actor: CourseBuilderActor;
  service: CourseBuilderApplicationService;
}>;

export class CourseBuilderMcpConfigurationError extends Error {
  readonly code = "mcp_configuration_error";

  constructor(message: string) {
    super(message);
    this.name = "CourseBuilderMcpConfigurationError";
  }
}

export class CourseBuilderMcpAuthenticationError extends Error {
  readonly code = "mcp_authentication_error";

  constructor(message = "Не удалось подтвердить Auth-пользователя MCP.") {
    super(message);
    this.name = "CourseBuilderMcpAuthenticationError";
  }
}

function requiredEnvironmentValue(
  environment: CourseBuilderMcpProcessEnvironment,
  name: (typeof courseBuilderMcpEnvironmentNames)[number],
) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new CourseBuilderMcpConfigurationError(
      `Для локального Course Builder MCP задайте ${name}.`,
    );
  }
  return value;
}

function decodedJwtPayload(value: string) {
  const payload = value.split(".")[1];
  if (!payload) return null;
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return decoded && typeof decoded === "object"
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function decodedJwtRole(value: string) {
  const role = decodedJwtPayload(value)?.role;
  return typeof role === "string" ? role : null;
}

function verifiedJwtIssuedAtMs(accessToken: string) {
  const issuedAt = decodedJwtPayload(accessToken)?.iat;
  if (
    typeof issuedAt !== "number" ||
    !Number.isFinite(issuedAt) ||
    issuedAt <= 0
  ) {
    throw new CourseBuilderMcpAuthenticationError(
      "Supabase user JWT не содержит корректный iat.",
    );
  }
  return issuedAt * 1000;
}

function isIssuedBeforeCutoff(
  issuedAtMs: number,
  invalidBefore: string | null,
) {
  if (!invalidBefore) return false;
  const cutoffMs = Date.parse(invalidBefore);
  return Number.isFinite(cutoffMs) && issuedAtMs < cutoffMs;
}

function assertPublicSupabaseKey(key: string) {
  // Accept both legacy anon JWTs and current publishable keys, but fail closed
  // when a privileged key is accidentally pasted into the local MCP config.
  if (key.startsWith("sb_secret_") || decodedJwtRole(key) === "service_role") {
    throw new CourseBuilderMcpConfigurationError(
      "Course Builder MCP принимает только публичный Supabase anon/publishable key.",
    );
  }
}

export function readCourseBuilderMcpEnvironment(
  environment: CourseBuilderMcpProcessEnvironment = process.env,
): CourseBuilderMcpEnvironment {
  const rawUrl = requiredEnvironmentValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(rawUrl);
  } catch {
    throw new CourseBuilderMcpConfigurationError(
      "NEXT_PUBLIC_SUPABASE_URL должен быть абсолютным URL.",
    );
  }
  if (!["http:", "https:"].includes(supabaseUrl.protocol)) {
    throw new CourseBuilderMcpConfigurationError(
      "NEXT_PUBLIC_SUPABASE_URL должен использовать http или https.",
    );
  }

  const supabaseAnonKey = requiredEnvironmentValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  assertPublicSupabaseKey(supabaseAnonKey);

  const actorAuthUserId = requiredEnvironmentValue(
    environment,
    "SHIDAO_MCP_AUTH_USER_ID",
  );
  if (!uuidSchema.safeParse(actorAuthUserId).success) {
    throw new CourseBuilderMcpConfigurationError(
      "SHIDAO_MCP_AUTH_USER_ID должен быть UUID Auth-пользователя.",
    );
  }

  return {
    supabaseUrl: supabaseUrl.toString().replace(/\/$/, ""),
    supabaseAnonKey,
    accessToken: requiredEnvironmentValue(
      environment,
      "SHIDAO_MCP_SUPABASE_ACCESS_TOKEN",
    ),
    actorAuthUserId,
  };
}

export type SupabaseUserResolver = (input: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
}) => Promise<{ id: string }>;

export const resolveSupabaseUser: SupabaseUserResolver = async ({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
}) => {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new CourseBuilderMcpAuthenticationError();
  }
  return { id: data.user.id };
};

export type CourseBuilderMcpContextResolverDependencies = Readonly<{
  environment?: CourseBuilderMcpProcessEnvironment;
  resolveUser?: SupabaseUserResolver;
  createRepository?: (accessToken: string) => CourseBuilderRepository;
  createService?: typeof createCourseBuilderService;
}>;

/**
 * Credentials are read and the short-lived JWT is verified for every tool
 * call. This keeps server startup/list-tools safe without credentials and
 * avoids trusting a decoded JWT payload for actor identity.
 */
export function createCourseBuilderMcpContextResolver(
  dependencies: CourseBuilderMcpContextResolverDependencies = {},
): () => Promise<CourseBuilderMcpRuntimeContext> {
  return async () => {
    const environment = readCourseBuilderMcpEnvironment(
      dependencies.environment ?? process.env,
    );
    let authenticatedUser: { id: string };
    try {
      authenticatedUser = await (
        dependencies.resolveUser ?? resolveSupabaseUser
      )(environment);
    } catch (error) {
      if (error instanceof CourseBuilderMcpAuthenticationError) throw error;
      throw new CourseBuilderMcpAuthenticationError();
    }

    const authenticatedUserId = uuidSchema.safeParse(authenticatedUser.id);
    if (
      !authenticatedUserId.success ||
      authenticatedUserId.data.toLowerCase() !==
        environment.actorAuthUserId.toLowerCase()
    ) {
      throw new CourseBuilderMcpAuthenticationError(
        "Auth-пользователь токена не совпадает с SHIDAO_MCP_AUTH_USER_ID.",
      );
    }

    const actor: CourseBuilderActor = {
      authUserId: authenticatedUserId.data,
      accessToken: environment.accessToken,
    };
    const repository = (
      dependencies.createRepository ?? createCourseBuilderRepository
    )(environment.accessToken);
    const invalidBefore = await repository.getSessionInvalidBefore();
    if (
      isIssuedBeforeCutoff(
        verifiedJwtIssuedAtMs(environment.accessToken),
        invalidBefore,
      )
    ) {
      throw new CourseBuilderMcpAuthenticationError(
        "Supabase user JWT выпущен до глобального session cutoff.",
      );
    }
    const service = (dependencies.createService ?? createCourseBuilderService)({
      repository,
    });
    return { actor, service };
  };
}
