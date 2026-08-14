import assert from "node:assert/strict";
import { once } from "node:events";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { after, before, test } from "node:test";
import {
  buildAppSessionSupabaseTokens,
  createAppSessionPayload,
  sealAppSession,
} from "../server/app-session";

const APP_SESSION_SECRET = "e2e-app-session-secret-value-with-minimum-32-chars";
const E2E_ADULT_USER_ID = "e2e-adult";
const E2E_LEARNER_PROFILE_ID = "00000000-0000-4000-8000-000000000101";
const E2E_OLD_LEARNER_PROFILE_ID = "00000000-0000-4000-8000-000000000105";
const E2E_TEACHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000102";
const E2E_RECOVERY_GRANT_ID = "00000000-0000-4000-8000-000000000103";
const E2E_RESET_IDEMPOTENCY_KEY = "00000000-0000-4000-8000-000000000104";
const E2E_EMAIL_INVITATION_ID = "00000000-0000-4000-8000-000000000106";

let appPort = 0;
let mockPort = 0;
let appServerProcess: ChildProcess | null = null;
let mockServer: ReturnType<typeof createServer> | null = null;
let injectIdentityRpcSecret = false;
let lastRecoveryResetBody: Record<string, unknown> | null = null;
let lastAliasResolutionBody: Record<string, unknown> | null = null;
let lastInvitationListBody: Record<string, unknown> | null = null;
let lastAuthVerifyBody: Record<string, unknown> | null = null;
let lastAuthRelayRefreshBody: Record<string, unknown> | null = null;

function buildSessionCookieValue(input: {
  uid: string;
  email: string;
  fullName: string;
  reauthenticatedAt?: number | null;
}) {
  const previousSecret = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = APP_SESSION_SECRET;
  try {
    return sealAppSession(
      createAppSessionPayload({
        uid: input.uid,
        email: input.email,
        fullName: input.fullName,
        reauthenticatedAt: input.reauthenticatedAt ?? null,
        supabaseSession: buildAppSessionSupabaseTokens({
          accessToken: "e2e-user-access-token",
          refreshToken: "e2e-user-refresh-token",
          expiresInSeconds: 3600,
        }),
      }),
    );
  } finally {
    if (previousSecret === undefined) delete process.env.APP_SESSION_SECRET;
    else process.env.APP_SESSION_SECRET = previousSecret;
  }
}

function authenticatedCookieHeader(
  options: { recentlyReauthenticated?: boolean } = {},
) {
  const cookie = buildSessionCookieValue({
    uid: E2E_ADULT_USER_ID,
    email: "adult-e2e@example.test",
    fullName: "E2E Adult",
    reauthenticatedAt: options.recentlyReauthenticated ? Date.now() : null,
  });

  return `shidao_session=${cookie}`;
}

async function allocatePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  assert.ok(address && typeof address === "object", "port allocation failed");
  const { port } = address;
  server.close();
  await once(server, "close");
  return port;
}

function json(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function readUserId(requestUrl: URL) {
  const raw = requestUrl.searchParams.get("user_id");
  if (!raw) return null;

  const match = /^eq\.(.+)$/.exec(raw);
  return match?.[1] ?? null;
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {} as Record<string, unknown>;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

async function handleMockSupabase(
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (!request.url) {
    json(response, 400, { message: "missing request url" });
    return;
  }

  const requestUrl = new URL(request.url, `http://127.0.0.1:${mockPort}`);

  if (requestUrl.pathname === "/rest/v1/rpc/current_account_auth_context") {
    json(response, 200, [
      {
        account_id: "account-e2e",
        auth_user_id: E2E_ADULT_USER_ID,
        verified_email: "adult-e2e@example.test",
        display_name: "E2E Adult",
        locale: "ru",
        timezone: "Asia/Chita",
        has_pin: true,
        can_author_educator_courses: true,
        sessions_invalid_before: null,
      },
    ]);
    return;
  }

  if (requestUrl.pathname === "/auth/v1/verify") {
    lastAuthVerifyBody = await readJsonBody(request);
    json(response, 200, {
      access_token: "verified-access-token",
      refresh_token: "verified-refresh-token",
      expires_in: 3600,
      user: {
        id: E2E_ADULT_USER_ID,
        email: "adult-e2e@example.test",
        user_metadata: { full_name: "E2E Adult" },
      },
    });
    return;
  }

  if (
    requestUrl.pathname === "/auth/v1/token" &&
    requestUrl.searchParams.get("grant_type") === "refresh_token"
  ) {
    lastAuthRelayRefreshBody = await readJsonBody(request);
    json(response, 200, {
      access_token: "relay-rotated-access-token",
      refresh_token: "relay-rotated-refresh-token",
      expires_in: 3600,
      user: { id: E2E_ADULT_USER_ID },
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/list_teacher_learner_directory") {
    json(response, 200, [
      {
        learner_profile_id: E2E_LEARNER_PROFILE_ID,
        teacher_account_id: E2E_TEACHER_ACCOUNT_ID,
        display_name: "API E2E learner",
        archived_at: null,
        identity_state: "offline",
        pending_request_count: 0,
        can_invite: true,
        can_permanently_delete: false,
        created_at: "2026-08-07T10:00:00.000Z",
        updated_at: "2026-08-07T10:00:00.000Z",
        ...(injectIdentityRpcSecret
          ? {
              auth_user_id: "must-not-reach-browser",
              token_digest: "must-not-reach-browser",
            }
          : {}),
      },
    ]);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/resolve_teacher_learner_profile_alias"
  ) {
    lastAliasResolutionBody = await readJsonBody(request);
    json(response, 200, E2E_LEARNER_PROFILE_ID);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/list_learner_profile_invitations") {
    lastInvitationListBody = await readJsonBody(request);
    json(response, 200, []);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/reset_recoverable_learner_credentials"
  ) {
    lastRecoveryResetBody = await readJsonBody(request);
    json(response, 200, {
      grant_id: E2E_RECOVERY_GRANT_ID,
      learner_label: "API E2E learner",
      child_account_login: "api_e2e_learner_2",
      completed: true,
    });
    return;
  }

  if (requestUrl.pathname.startsWith("/auth/v1/admin/users/")) {
    const userId = requestUrl.pathname.split("/").at(-1);

    if (userId !== E2E_ADULT_USER_ID) {
      json(response, 404, { message: "user not found" });
      return;
    }

    json(response, 200, {
      user: {
        id: E2E_ADULT_USER_ID,
        email: "adult-e2e@example.test",
        user_metadata: { full_name: "E2E Adult" },
      },
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/ensure_user_preference") {
    json(response, 200, {});
    return;
  }

  const userId = readUserId(requestUrl);
  const isAdultUser = userId === E2E_ADULT_USER_ID;

  if (requestUrl.pathname === "/rest/v1/parent") {
    json(
      response,
      200,
      isAdultUser ? [{ id: "parent-e2e", full_name: "E2E Adult" }] : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/teacher") {
    json(response, 200, []);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/student") {
    json(response, 200, []);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/user_preference") {
    json(
      response,
      200,
      isAdultUser
        ? [
            {
              last_active_profile: "parent",
              last_selected_school_id: null,
              theme: null,
              settings: {},
            },
          ]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/user_security") {
    json(response, 200, isAdultUser ? [{ pin_hash: "hash" }] : []);
    return;
  }

  json(response, 404, { message: `Unhandled path: ${requestUrl.pathname}` });
}

async function waitForAppReady(baseUrl: string) {
  const timeoutAt = Date.now() + 60_000;
  let lastError: unknown = null;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(`${baseUrl}/`, {
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`app did not start in time: ${String(lastError)}`);
}

before(async () => {
  mockPort = await allocatePort();
  appPort = await allocatePort();

  mockServer = createServer(handleMockSupabase);
  mockServer.listen(mockPort, "127.0.0.1");
  await once(mockServer, "listening");

  appServerProcess = spawn(
    "npm",
    ["run", "dev", "--", "--port", String(appPort)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_SESSION_SECRET,
        LEARNER_IDENTITY_DIGEST_KEY:
          "e2e-learner-identity-digest-key-with-minimum-32-chars",
        NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${appPort}`,
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
      },
      stdio: "ignore",
      detached: true,
    },
  );
  appServerProcess.unref();

  await waitForAppReady(`http://127.0.0.1:${appPort}`);
});

after(async () => {
  if (appServerProcess?.pid) {
    try {
      process.kill(-appServerProcess.pid, "SIGTERM");
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      process.kill(-appServerProcess.pid, "SIGKILL");
    } catch {}
  }

  if (mockServer) {
    mockServer.closeAllConnections?.();
    mockServer.close();
    await Promise.race([
      once(mockServer, "close"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
});

test("e2e smoke: guest opens / and sees guest header CTA", async () => {
  const response = await fetch(`http://127.0.0.1:${appPort}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, />Войти</);
  assert.match(html, />Создать аккаунт</);
});

test("e2e smoke: authenticated user on / receives auth-aware header contract", async () => {
  const response = await fetch(`http://127.0.0.1:${appPort}/`, {
    headers: {
      cookie: authenticatedCookieHeader(),
    },
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /E2E Adult/);
});

test("e2e smoke: guest reaching protected routes is redirected to /login", async () => {
  for (const pathname of ["/courses", "/store"]) {
    const response = await fetch(`http://127.0.0.1:${appPort}${pathname}`, {
      redirect: "manual",
    });

    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/login");
  }
});

test("e2e smoke: authenticated /login redirects and legacy security URL stays compatible", async () => {
  const cookie = authenticatedCookieHeader();

  const loginResponse = await fetch(`http://127.0.0.1:${appPort}/login`, {
    headers: {
      cookie,
      "x-pathname": "/login",
    },
    redirect: "manual",
  });

  assert.equal(loginResponse.status, 307);
  assert.equal(loginResponse.headers.get("location"), "/courses");

  const securityResponse = await fetch(
    `http://127.0.0.1:${appPort}/settings/security`,
    {
      headers: { cookie },
      redirect: "manual",
    },
  );
  assert.equal(securityResponse.status, 307);
  assert.equal(
    securityResponse.headers.get("location"),
    "/learning-profile?tab=settings#security",
  );

  const canonicalResponse = await fetch(
    `http://127.0.0.1:${appPort}/learning-profile?tab=settings`,
    { headers: { cookie } },
  );
  const canonicalHtml = await canonicalResponse.text();
  assert.equal(canonicalResponse.status, 200);
  assert.match(canonicalHtml, /E2E Adult/);
});

test("API e2e: learner directory returns the exact public DTO and fails closed on injected RPC secrets", async () => {
  const cookie = authenticatedCookieHeader();
  injectIdentityRpcSecret = false;
  const response = await fetch(
    `http://127.0.0.1:${appPort}/api/v2/learner-directory?status=active`,
    { headers: { cookie } },
  );
  const payload = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    learners: [
      {
        learnerProfileId: E2E_LEARNER_PROFILE_ID,
        teacherAccountId: E2E_TEACHER_ACCOUNT_ID,
        displayName: "API E2E learner",
        archivedAt: null,
        identityState: "offline",
        pendingRequestCount: 0,
        canInvite: true,
        canPermanentlyDelete: false,
        createdAt: "2026-08-07T10:00:00.000Z",
        updatedAt: "2026-08-07T10:00:00.000Z",
      },
    ],
  });

  injectIdentityRpcSecret = true;
  try {
    const rejected = await fetch(
      `http://127.0.0.1:${appPort}/api/v2/learner-directory?status=active`,
      { headers: { cookie } },
    );
    const rejectedPayload = (await rejected.json()) as Record<string, unknown>;
    assert.equal(rejected.status, 503);
    assert.deepEqual(rejectedPayload, {
      error: "Сервис учебного профиля временно недоступен.",
      code: "learner_identity_unavailable",
    });
    assert.doesNotMatch(
      JSON.stringify(rejectedPayload),
      /must-not-reach-browser|auth_user_id|token_digest/,
    );
  } finally {
    injectIdentityRpcSecret = false;
  }
});

test("API e2e: credential recovery derives reauthentication server-side and exposes only the reset DTO", async () => {
  const cookie = authenticatedCookieHeader({ recentlyReauthenticated: true });
  const origin = `http://127.0.0.1:${appPort}`;
  lastRecoveryResetBody = null;
  const response = await fetch(
    `${origin}/api/v2/learner-credential-recovery/${E2E_RECOVERY_GRANT_ID}/reset`,
    {
      method: "POST",
      headers: {
        cookie,
        origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newLogin: "api_e2e_learner_2",
        pin: "5678",
        idempotencyKey: E2E_RESET_IDEMPOTENCY_KEY,
      }),
    },
  );
  const payload = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    result: {
      grantId: E2E_RECOVERY_GRANT_ID,
      learnerLabel: "API E2E learner",
      childAccountLogin: "api_e2e_learner_2",
      completed: true,
    },
  });
  assert.doesNotMatch(
    JSON.stringify(payload),
    /5678|authUser|auth_user|internal.*email|sessionInvalid|session_invalid/i,
  );
  const resetBody = lastRecoveryResetBody as unknown as Record<
    string,
    unknown
  > | null;
  assert.ok(resetBody);
  assert.equal(resetBody.p_actor_auth_user_id, E2E_ADULT_USER_ID);
  assert.equal(resetBody.p_grant_id, E2E_RECOVERY_GRANT_ID);
  assert.equal(resetBody.p_raw_pin, "5678");
  assert.equal(typeof resetBody.p_reauthenticated_at, "string");

  lastRecoveryResetBody = null;
  const forged = await fetch(
    `${origin}/api/v2/learner-credential-recovery/${E2E_RECOVERY_GRANT_ID}/reset`,
    {
      method: "POST",
      headers: {
        cookie,
        origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newLogin: "api_e2e_learner_2",
        pin: "5678",
        idempotencyKey: E2E_RESET_IDEMPOTENCY_KEY,
        reauthenticatedAt: "2099-01-01T00:00:00.000Z",
      }),
    },
  );
  assert.equal(forged.status, 400);
  assert.equal(lastRecoveryResetBody, null);
});

test("API e2e: a stale merged profile URL resolves through the actor-scoped alias boundary", async () => {
  lastAliasResolutionBody = null;
  lastInvitationListBody = null;
  const response = await fetch(
    `http://127.0.0.1:${appPort}/api/v2/learner-profiles/${E2E_OLD_LEARNER_PROFILE_ID}/identity-invitations`,
    { headers: { cookie: authenticatedCookieHeader() } },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { invitations: [] });
  const aliasBody = lastAliasResolutionBody as unknown as Record<
    string,
    unknown
  > | null;
  const listBody = lastInvitationListBody as unknown as Record<
    string,
    unknown
  > | null;
  assert.ok(aliasBody);
  assert.ok(listBody);
  assert.equal(aliasBody.p_learner_profile_id, E2E_OLD_LEARNER_PROFILE_ID);
  assert.equal(aliasBody.p_actor_auth_user_id, E2E_ADULT_USER_ID);
  assert.equal(listBody.p_learner_profile_id, E2E_LEARNER_PROFILE_ID);
});

test("API e2e: OTP email callback replaces the Auth token with an HttpOnly bound handoff", async () => {
  const tokenHash = "one-time-auth-token-hash";
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const next = `/identity/invitations/${E2E_EMAIL_INVITATION_ID}`;
  const url = new URL("/auth/confirm", baseUrl);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "email");
  url.searchParams.set("next", next);
  url.searchParams.set("identity_invitation", E2E_EMAIL_INVITATION_ID);
  url.searchParams.set("identity_kind", "profile");
  lastAuthVerifyBody = null;

  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const setCookie = response.headers.get("set-cookie") ?? "";
  const verifyBody = lastAuthVerifyBody as unknown as Record<
    string,
    unknown
  > | null;

  assert.equal(response.status, 307);
  assert.equal(location, `${baseUrl}${next}?kind=profile`);
  assert.doesNotMatch(location, /token|digest|email/i);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(setCookie, /shidao_identity_email_handoff=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.doesNotMatch(setCookie, new RegExp(tokenHash));
  assert.doesNotMatch(setCookie, /adult-e2e@example\.test/);
  assert.ok(verifyBody);
  assert.deepEqual(verifyBody, { token_hash: tokenHash, type: "email" });
});

test("API e2e: default GoTrue magic-link fragment is scrubbed before same-origin relay", async () => {
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const next = `/identity/invitations/${E2E_EMAIL_INVITATION_ID}`;
  const relayUrl = new URL("/auth/confirm", baseUrl);
  relayUrl.searchParams.set("next", next);
  relayUrl.searchParams.set("identity_invitation", E2E_EMAIL_INVITATION_ID);
  relayUrl.searchParams.set("identity_kind", "profile");

  const pageResponse = await fetch(relayUrl);
  const relayHtml = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  assert.equal(pageResponse.headers.get("cache-control"), "no-store");
  assert.equal(pageResponse.headers.get("referrer-policy"), "no-referrer");
  assert.match(
    pageResponse.headers.get("content-security-policy") ?? "",
    /default-src 'none'/,
  );
  assert.match(relayHtml, /fragment\.get\("refresh_token"\)/);
  assert.ok(
    relayHtml.indexOf("History.prototype.replaceState.call") <
      relayHtml.indexOf('fetch("/api/auth/email-relay"'),
  );

  lastAuthRelayRefreshBody = null;
  const refreshToken = "magic-link-refresh-token-for-e2e";
  const exchangeResponse = await fetch(`${baseUrl}/api/auth/email-relay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({
      refreshToken,
      invitationId: E2E_EMAIL_INVITATION_ID,
      kind: "profile",
      next,
    }),
  });
  const exchangeBody = (await exchangeResponse.json()) as Record<
    string,
    unknown
  >;
  const setCookie = exchangeResponse.headers.get("set-cookie") ?? "";
  assert.equal(exchangeResponse.status, 200);
  assert.deepEqual(exchangeBody, { redirectTo: `${next}?kind=profile` });
  assert.deepEqual(lastAuthRelayRefreshBody, { refresh_token: refreshToken });
  assert.match(setCookie, /shidao_session=/);
  assert.match(setCookie, /shidao_identity_email_handoff=/);
  assert.doesNotMatch(JSON.stringify(exchangeBody), /refresh|access|email/i);
  assert.doesNotMatch(setCookie, new RegExp(refreshToken));
});
