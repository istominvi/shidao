import {
  buildAppSessionSupabaseTokens,
  isSupabaseAccessTokenFresh,
  readAppSession,
  rotateAppSessionSupabaseTokens,
  type AppSession,
  type AppSessionSupabaseTokens,
} from "./app-session";
import { postgresUuidSchema } from "@/lib/postgres-uuid";

export const SUPABASE_USER_REAUTHENTICATION_REQUIRED =
  "SUPABASE_USER_REAUTHENTICATION_REQUIRED";

export class SupabaseUserReauthenticationRequiredError extends Error {
  readonly code = SUPABASE_USER_REAUTHENTICATION_REQUIRED;
  readonly status = 401;

  constructor() {
    super("Войдите снова, чтобы продолжить работу с курсами.");
    this.name = "SupabaseUserReauthenticationRequiredError";
  }
}

export function isSupabaseUserReauthenticationRequiredError(
  error: unknown,
): error is SupabaseUserReauthenticationRequiredError {
  return (
    error instanceof SupabaseUserReauthenticationRequiredError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === SUPABASE_USER_REAUTHENTICATION_REQUIRED)
  );
}

type SupabaseRefreshResponse = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_in?: number | null;
  expires_at?: number | null;
  user?: { id?: string | null } | null;
};

export type TrustedSupabaseSessionClaims = {
  authUserId: string;
  sessionId: string;
};

/**
 * Decodes only the two signed identity hints needed to bind a server action to
 * its exact Supabase session. Database authority is still re-established from
 * auth.sessions, Account and account_security; no other JWT field is trusted.
 */
export function decodeTrustedSupabaseSessionClaims(
  accessToken: string,
): TrustedSupabaseSessionClaims | null {
  const payloadSegment = accessToken.split(".")[1];
  if (!payloadSegment) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    ) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    const candidate = payload as Record<string, unknown>;
    const authUserId = postgresUuidSchema.safeParse(candidate.sub);
    const sessionId = postgresUuidSchema.safeParse(candidate.session_id);
    if (!authUserId.success || !sessionId.success) return null;
    return { authUserId: authUserId.data, sessionId: sessionId.data };
  } catch {
    return null;
  }
}

type SupabaseUserSessionDependencies = {
  readSession?: () => Promise<AppSession | null>;
  rotateSession?: (
    currentSession: AppSession,
    supabaseSession: AppSessionSupabaseTokens,
  ) => Promise<unknown>;
  fetcher?: typeof fetch;
  now?: () => number;
  getConfig?: () => { url: string; anonKey: string };
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase user session is not configured.");
  }
  return { url: url.replace(/\/+$/, ""), anonKey };
}

function reauthenticationRequired(): never {
  throw new SupabaseUserReauthenticationRequiredError();
}

/**
 * Returns a user JWT suitable for PostgREST/Storage RLS. Refresh-token rotation
 * is persisted back into the encrypted app cookie; neither token is logged or
 * exposed to client code by this helper.
 */
export async function requireSupabaseUserAccessToken(
  dependencies: SupabaseUserSessionDependencies = {},
) {
  const result = await requireSupabaseUserSession(dependencies);
  return result.accessToken;
}

export async function requireSupabaseUserSession(
  dependencies: SupabaseUserSessionDependencies = {},
) {
  const readSession = dependencies.readSession ?? readAppSession;
  const rotateSession =
    dependencies.rotateSession ?? rotateAppSessionSupabaseTokens;
  const fetcher = dependencies.fetcher ?? fetch;
  const nowMs = (dependencies.now ?? Date.now)();
  const session = await readSession();

  if (!session || session.exp <= nowMs) {
    return reauthenticationRequired();
  }

  const currentSupabaseSession = session.supabaseSession;
  if (isSupabaseAccessTokenFresh(currentSupabaseSession, nowMs)) {
    return {
      accessToken: currentSupabaseSession!.accessToken!,
      session,
    };
  }

  const refreshToken = currentSupabaseSession?.refreshToken;
  if (!refreshToken) {
    return reauthenticationRequired();
  }

  const { url, anonKey } = (dependencies.getConfig ?? getSupabaseConfig)();
  let response: Response;
  try {
    response = await fetcher(
      `${url.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      },
    );
  } catch {
    return reauthenticationRequired();
  }

  const payload = (await response
    .json()
    .catch(() => null)) as SupabaseRefreshResponse | null;
  if (!response.ok || payload?.user?.id !== session.uid) {
    return reauthenticationRequired();
  }

  const refreshedSession = buildAppSessionSupabaseTokens(
    {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? refreshToken,
      expiresInSeconds: payload.expires_in,
      expiresAtEpochSeconds: payload.expires_at,
    },
    nowMs,
  );
  if (!refreshedSession?.accessToken) {
    return reauthenticationRequired();
  }

  try {
    await rotateSession(session, refreshedSession);
  } catch {
    return reauthenticationRequired();
  }

  return {
    accessToken: refreshedSession.accessToken,
    session: { ...session, supabaseSession: refreshedSession },
  };
}
