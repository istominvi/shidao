import { isInternalAuthEmail, normalizeIdentifier } from "@/lib/auth";
import {
  isAvatarPresetKey,
  type AccountAvatarView,
  type AvatarPresetKey,
} from "@/lib/account-avatar";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { isOwnProfileAvatarStoragePath } from "@/lib/server/profile-avatar-storage";

export type AccountAvatarAuthContext = AccountAvatarView & {
  storagePath: string | null;
  updatedAt: string;
};

export type AccountAuthContext = {
  accountId: string;
  authUserId: string;
  verifiedEmail: string | null;
  displayName: string;
  locale: string;
  timezone: string;
  hasPin: boolean;
  canAuthorEducatorCourses: boolean;
  sessionsInvalidBefore: string | null;
  avatar: AccountAvatarAuthContext;
};

export type AccountLoginAlias = {
  userId: string;
  authEmail: string;
};

export type SupabaseAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number | null;
  expires_at?: number | null;
  user: {
    id: string;
    email?: string | null;
    user_metadata?: { full_name?: string | null } | null;
  };
};

type RpcAccountContextRow = {
  account_id?: unknown;
  auth_user_id?: unknown;
  verified_email?: unknown;
  display_name?: unknown;
  locale?: unknown;
  timezone?: unknown;
  has_pin?: unknown;
  can_author_educator_courses?: unknown;
  sessions_invalid_before?: unknown;
  avatar_kind?: unknown;
  avatar_preset_key?: unknown;
  avatar_storage_path?: unknown;
  avatar_revision?: unknown;
  avatar_updated_at?: unknown;
};

type RpcAvatarMutationRow = {
  avatar_kind?: unknown;
  avatar_preset_key?: unknown;
  avatar_revision?: unknown;
  avatar_updated_at?: unknown;
  previous_storage_path?: unknown;
};

type RpcAliasRow = {
  auth_user_id?: unknown;
  auth_email?: unknown;
};

type Fetcher = typeof fetch;

class AccountAuthRpcError extends Error {
  constructor(
    functionName: string,
    readonly status: number,
    readonly rpcCode: string | null,
  ) {
    super(`Account auth RPC ${functionName} failed (${status}).`);
    this.name = "AccountAuthRpcError";
  }
}

export class AccountAvatarRevisionConflictError extends Error {
  constructor() {
    super("Account avatar was changed by another request.");
    this.name = "AccountAvatarRevisionConflictError";
  }
}

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Supabase service-role auth is not configured.");
  }
  return serviceRoleKey;
}

function firstRpcRow<T>(payload: unknown): T | null {
  if (Array.isArray(payload)) {
    return (payload[0] as T | undefined) ?? null;
  }
  if (payload && typeof payload === "object") return payload as T;
  return null;
}

async function parseResponse(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

async function callRpc(
  functionName: string,
  payload: Record<string, unknown>,
  options: { accessToken?: string; admin?: boolean; fetcher?: Fetcher } = {},
) {
  const { url, anonKey } = getSupabasePublicConfig();
  const key = options.admin ? getServiceRoleKey() : anonKey;
  const bearer = options.admin ? key : (options.accessToken ?? anonKey);
  const response = await (options.fetcher ?? fetch)(
    `${url.replace(/\/+$/, "")}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  const result = await parseResponse(response);
  if (!response.ok) {
    // RPC payloads can contain PINs and account identifiers. Deliberately do not
    // attach the request/response body to logs or thrown errors.
    const rpcCode =
      result &&
      typeof result === "object" &&
      "code" in result &&
      typeof result.code === "string"
        ? result.code
        : null;
    throw new AccountAuthRpcError(functionName, response.status, rpcCode);
  }
  return result;
}

function parseAccountContext(payload: unknown): AccountAuthContext {
  const row = firstRpcRow<RpcAccountContextRow>(payload);
  if (
    typeof row?.account_id !== "string" ||
    typeof row.auth_user_id !== "string" ||
    !(
      row.verified_email === undefined ||
      row.verified_email === null ||
      typeof row.verified_email === "string"
    ) ||
    typeof row.display_name !== "string" ||
    typeof row.locale !== "string" ||
    typeof row.timezone !== "string" ||
    typeof row.has_pin !== "boolean" ||
    typeof row.can_author_educator_courses !== "boolean" ||
    !(
      row.sessions_invalid_before === null ||
      typeof row.sessions_invalid_before === "string"
    ) ||
    !(row.avatar_kind === "preset" || row.avatar_kind === "custom") ||
    !Number.isSafeInteger(row.avatar_revision) ||
    (row.avatar_revision as number) < 1 ||
    typeof row.avatar_updated_at !== "string"
  ) {
    throw new Error("Account auth context is unavailable.");
  }

  if (
    row.sessions_invalid_before !== null &&
    !Number.isFinite(Date.parse(row.sessions_invalid_before))
  ) {
    throw new Error("Account session cutoff is invalid.");
  }

  if (!Number.isFinite(Date.parse(row.avatar_updated_at))) {
    throw new Error("Account avatar timestamp is invalid.");
  }

  const avatarInvariantHolds =
    (row.avatar_kind === "preset" &&
      isAvatarPresetKey(row.avatar_preset_key) &&
      row.avatar_storage_path === null) ||
    (row.avatar_kind === "custom" &&
      row.avatar_preset_key === null &&
      isOwnProfileAvatarStoragePath(row.avatar_storage_path, row.account_id));
  if (!avatarInvariantHolds) {
    throw new Error("Account avatar context is invalid.");
  }

  return {
    accountId: row.account_id,
    authUserId: row.auth_user_id,
    verifiedEmail:
      typeof row.verified_email === "string" &&
      !isInternalAuthEmail(row.verified_email)
        ? row.verified_email
        : null,
    displayName: row.display_name,
    locale: row.locale,
    timezone: row.timezone,
    hasPin: row.has_pin,
    canAuthorEducatorCourses: row.can_author_educator_courses,
    sessionsInvalidBefore: row.sessions_invalid_before,
    avatar: {
      kind: row.avatar_kind,
      presetKey: row.avatar_preset_key as AvatarPresetKey | null,
      storagePath: row.avatar_storage_path as string | null,
      revision: row.avatar_revision as number,
      updatedAt: row.avatar_updated_at,
    },
  };
}

export type SetCurrentAccountAvatarInput =
  | {
      accountId: string;
      actorAuthUserId: string;
      expectedRevision: number;
      kind: "preset";
      presetKey: AvatarPresetKey;
    }
  | {
      accountId: string;
      actorAuthUserId: string;
      expectedRevision: number;
      kind: "custom";
      storagePath: string;
    };

export type SetCurrentAccountAvatarResult = {
  avatar: AccountAvatarView & { updatedAt: string };
  previousStoragePath: string | null;
};

function parseAvatarMutationResult(
  payload: unknown,
  input: SetCurrentAccountAvatarInput,
): SetCurrentAccountAvatarResult {
  const row = firstRpcRow<RpcAvatarMutationRow>(payload);
  if (
    !row ||
    !(row.avatar_kind === "preset" || row.avatar_kind === "custom") ||
    !Number.isSafeInteger(row.avatar_revision) ||
    (row.avatar_revision as number) < 1 ||
    typeof row.avatar_updated_at !== "string" ||
    !Number.isFinite(Date.parse(row.avatar_updated_at)) ||
    !(
      row.previous_storage_path === null ||
      isOwnProfileAvatarStoragePath(row.previous_storage_path, input.accountId)
    )
  ) {
    throw new Error("Account avatar update response is invalid.");
  }

  const revision = row.avatar_revision as number;
  const stateMatchesRequest =
    revision === input.expectedRevision + 1 &&
    ((input.kind === "preset" &&
      row.avatar_kind === "preset" &&
      row.avatar_preset_key === input.presetKey) ||
      (input.kind === "custom" &&
        row.avatar_kind === "custom" &&
        row.avatar_preset_key === null));
  if (!stateMatchesRequest) {
    throw new Error(
      "Account avatar update response does not match the request.",
    );
  }

  return {
    avatar: {
      kind: row.avatar_kind,
      presetKey: row.avatar_preset_key as AvatarPresetKey | null,
      revision,
      updatedAt: row.avatar_updated_at,
    },
    previousStoragePath: row.previous_storage_path,
  };
}

function parseAlias(payload: unknown): AccountLoginAlias | null {
  const row = firstRpcRow<RpcAliasRow>(payload);
  if (!row) return null;
  if (
    typeof row.auth_user_id !== "string" ||
    typeof row.auth_email !== "string"
  ) {
    throw new Error("Account login alias response is invalid.");
  }
  return { userId: row.auth_user_id, authEmail: row.auth_email };
}

export async function getCurrentAccountAuthContext(
  accessToken: string,
  options: { fetcher?: Fetcher } = {},
) {
  return parseAccountContext(
    await callRpc(
      "current_account_auth_context",
      {},
      {
        accessToken,
        fetcher: options.fetcher,
      },
    ),
  );
}

export async function resolveAccountLoginAlias(
  identifier: string,
  options: { fetcher?: Fetcher } = {},
) {
  return parseAlias(
    await callRpc(
      "resolve_account_login_alias",
      { p_identifier: normalizeIdentifier(identifier) },
      { admin: true, fetcher: options.fetcher },
    ),
  );
}

export async function verifyAccountPinCredential(
  identifier: string,
  rawPin: string,
  options: { fetcher?: Fetcher } = {},
) {
  return parseAlias(
    await callRpc(
      "verify_account_pin_credential",
      {
        p_identifier: normalizeIdentifier(identifier),
        p_raw_pin: rawPin,
      },
      { admin: true, fetcher: options.fetcher },
    ),
  );
}

export async function trySignInAccountWithPassword(
  email: string,
  password: string,
  options: { fetcher?: Fetcher } = {},
) {
  const { url, anonKey } = getSupabasePublicConfig();
  const response = await (options.fetcher ?? fetch)(
    `${url.replace(/\/+$/, "")}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    },
  );
  if (response.status === 400 || response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Supabase password grant failed (${response.status}).`);
  }
  return (await response.json()) as SupabaseAuthSession;
}

async function updateSupabaseAuthUser(
  accessToken: string,
  payload: Record<string, unknown>,
  options: { fetcher?: Fetcher } = {},
) {
  const { url, anonKey } = getSupabasePublicConfig();
  const response = await (options.fetcher ?? fetch)(
    `${url.replace(/\/+$/, "")}/auth/v1/user`,
    {
      method: "PUT",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase Account update failed (${response.status}).`);
  }
  return parseResponse(response);
}

export async function updateCurrentAccountPassword(
  accessToken: string,
  password: string,
  options: { fetcher?: Fetcher } = {},
) {
  await updateSupabaseAuthUser(accessToken, { password }, options);
}

export async function requestCurrentAccountEmailChange(
  input: {
    actorAuthUserId: string;
    currentEmail: string;
    currentPassword: string;
    newEmail: string;
    redirectTo: string;
  },
  options: { fetcher?: Fetcher } = {},
) {
  const session = await trySignInAccountWithPassword(
    input.currentEmail,
    input.currentPassword,
    options,
  );
  if (!session?.access_token || session.user.id !== input.actorAuthUserId) {
    throw new Error("Не удалось подтвердить текущий пароль.");
  }

  await updateSupabaseAuthUser(
    session.access_token,
    {
      email: input.newEmail,
      email_redirect_to: input.redirectTo,
    },
    options,
  );
}

function pickGeneratedTokenHash(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as {
    hashed_token?: unknown;
    token_hash?: unknown;
    properties?: { hashed_token?: unknown; token_hash?: unknown } | null;
    user?: { id?: unknown } | null;
  };
  const tokenHash =
    response.properties?.hashed_token ??
    response.properties?.token_hash ??
    response.hashed_token ??
    response.token_hash;
  return {
    tokenHash: typeof tokenHash === "string" ? tokenHash : null,
    generatedUserId:
      typeof response.user?.id === "string" ? response.user.id : null,
  };
}

/**
 * Mints an ordinary GoTrue user session after the server-only PIN verifier has
 * authenticated an Account. The one-time hash is consumed server-side and is
 * never returned to, stored for, or logged by the browser.
 */
export async function mintSupabaseSessionForAccount(
  alias: AccountLoginAlias,
  options: { fetcher?: Fetcher } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const { url, anonKey } = getSupabasePublicConfig();
  const serviceRoleKey = getServiceRoleKey();
  const generateResponse = await fetcher(
    `${url.replace(/\/+$/, "")}/auth/v1/admin/generate_link`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "magiclink", email: alias.authEmail }),
      cache: "no-store",
    },
  );
  const generatedPayload = await parseResponse(generateResponse);
  if (!generateResponse.ok) {
    throw new Error(
      `Supabase session link generation failed (${generateResponse.status}).`,
    );
  }

  const generated = pickGeneratedTokenHash(generatedPayload);
  if (
    !generated?.tokenHash ||
    (generated.generatedUserId !== null &&
      generated.generatedUserId !== alias.userId)
  ) {
    throw new Error("Supabase session link identity mismatch.");
  }

  const verifyResponse = await fetcher(
    `${url.replace(/\/+$/, "")}/auth/v1/verify`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "magiclink",
        token_hash: generated.tokenHash,
      }),
      cache: "no-store",
    },
  );
  const session = (await parseResponse(
    verifyResponse,
  )) as SupabaseAuthSession | null;
  if (
    !verifyResponse.ok ||
    session?.user?.id !== alias.userId ||
    typeof session.access_token !== "string" ||
    typeof session.refresh_token !== "string"
  ) {
    throw new Error("Supabase PIN session minting failed.");
  }
  return session;
}

export async function verifyCurrentAccountPin(
  accessToken: string,
  rawPin: string,
  options: { fetcher?: Fetcher } = {},
) {
  const result = await callRpc(
    "verify_current_account_pin",
    { p_raw_pin: rawPin },
    { accessToken, fetcher: options.fetcher },
  );
  return result === true;
}

export async function setCurrentAccountPin(
  actorAuthUserId: string,
  rawPin: string,
  options: { fetcher?: Fetcher } = {},
) {
  await callRpc(
    "set_current_account_pin",
    { p_actor_auth_user_id: actorAuthUserId, p_raw_pin: rawPin },
    { admin: true, fetcher: options.fetcher },
  );
}

export async function updateCurrentAccountProfile(
  accessToken: string,
  input: { displayName: string; locale: string; timezone: string },
  options: { fetcher?: Fetcher } = {},
) {
  await callRpc(
    "update_current_account_profile",
    {
      p_display_name: input.displayName,
      p_locale: input.locale,
      p_timezone: input.timezone,
    },
    { accessToken, fetcher: options.fetcher },
  );
}

export async function setCurrentAccountAvatar(
  input: SetCurrentAccountAvatarInput,
  options: { fetcher?: Fetcher } = {},
) {
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  ) {
    throw new Error("Account avatar revision is invalid.");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      input.actorAuthUserId,
    ) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      input.accountId,
    ) ||
    (input.kind === "preset" && !isAvatarPresetKey(input.presetKey)) ||
    (input.kind === "custom" &&
      !isOwnProfileAvatarStoragePath(input.storagePath, input.accountId))
  ) {
    throw new Error("Account avatar update is invalid.");
  }

  try {
    return parseAvatarMutationResult(
      await callRpc(
        "set_current_account_avatar",
        {
          p_actor_auth_user_id: input.actorAuthUserId,
          p_avatar_kind: input.kind,
          p_avatar_preset_key: input.kind === "preset" ? input.presetKey : null,
          p_avatar_storage_path:
            input.kind === "custom" ? input.storagePath : null,
          p_expected_revision: input.expectedRevision,
        },
        { admin: true, fetcher: options.fetcher },
      ),
      input,
    );
  } catch (error) {
    if (error instanceof AccountAuthRpcError && error.rpcCode === "40001") {
      throw new AccountAvatarRevisionConflictError();
    }
    throw error;
  }
}

export async function revokeAccountSessionsAdmin(
  userId: string,
  invalidBefore = new Date(),
  options: { fetcher?: Fetcher } = {},
) {
  await callRpc(
    "revoke_user_sessions",
    {
      p_user_id: userId,
      p_cutoff: invalidBefore.toISOString(),
    },
    { admin: true, fetcher: options.fetcher },
  );
}
