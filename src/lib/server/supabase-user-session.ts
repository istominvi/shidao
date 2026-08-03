import {
  buildAppSessionSupabaseTokens,
  isSupabaseAccessTokenFresh,
  readAppSession,
  rotateAppSessionSupabaseTokens,
  type AppSession,
  type AppSessionSupabaseTokens,
} from "./app-session";

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
    return currentSupabaseSession!.accessToken!;
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

  return refreshedSession.accessToken;
}
