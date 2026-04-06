import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { after, before, test } from "node:test";

const APP_SESSION_SECRET = "e2e-app-session-secret-value-with-minimum-32-chars";
const E2E_ADULT_USER_ID = "e2e-adult";
const E2E_ADULT_NEW_USER_ID = "e2e-adult-new";

let appPort = 0;
let mockPort = 0;
let appServerProcess: ChildProcess | null = null;
let mockServer: ReturnType<typeof createServer> | null = null;

function buildSessionCookieValue(input: {
  uid: string;
  email: string;
  fullName: string;
}) {
  const payload = {
    uid: input.uid,
    email: input.email,
    fullName: input.fullName,
    recoveryVerifiedAt: null,
    iat: Date.now(),
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", APP_SESSION_SECRET)
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

function authenticatedCookieHeader(input?: {
  uid?: string;
  email?: string;
  fullName?: string;
}) {
  const cookie = buildSessionCookieValue({
    uid: input?.uid ?? E2E_ADULT_USER_ID,
    email: input?.email ?? "adult-e2e@example.test",
    fullName: input?.fullName ?? "E2E Adult",
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

function handleMockSupabase(
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (!request.url) {
    json(response, 400, { message: "missing request url" });
    return;
  }

  const requestUrl = new URL(request.url, `http://127.0.0.1:${mockPort}`);

  if (requestUrl.pathname.startsWith("/auth/v1/admin/users/")) {
    const userId = requestUrl.pathname.split("/").at(-1);

    if (userId === E2E_ADULT_USER_ID) {
      json(response, 200, {
        user: {
          id: E2E_ADULT_USER_ID,
          email: "adult-e2e@example.test",
          user_metadata: { full_name: "E2E Adult" },
        },
      });
      return;
    }

    if (userId === E2E_ADULT_NEW_USER_ID) {
      json(response, 200, {
        user: {
          id: E2E_ADULT_NEW_USER_ID,
          email: "adult-new-e2e@example.test",
          user_metadata: { full_name: "E2E Adult New" },
        },
      });
      return;
    }

    json(response, 404, { message: "user not found" });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/ensure_user_preference") {
    json(response, 200, {});
    return;
  }

  const userId = readUserId(requestUrl);
  const isAdultUser = userId === E2E_ADULT_USER_ID;
  const isAdultWithoutProfileUser = userId === E2E_ADULT_NEW_USER_ID;

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
        : isAdultWithoutProfileUser
          ? [
              {
                last_active_profile: null,
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

test("e2e smoke: guest reaching protected route is redirected to /login", async () => {
  const response = await fetch(`http://127.0.0.1:${appPort}/dashboard`, {
    redirect: "manual",
  });

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/login");
});

test("e2e smoke: authenticated /login redirects by access policy and /settings/security opens", async () => {
  const cookie = authenticatedCookieHeader();

  const loginResponse = await fetch(`http://127.0.0.1:${appPort}/login`, {
    headers: {
      cookie,
      "x-pathname": "/login",
    },
    redirect: "manual",
  });

  assert.equal(loginResponse.status, 307);
  assert.equal(loginResponse.headers.get("location"), "/dashboard");

  const securityResponse = await fetch(
    `http://127.0.0.1:${appPort}/settings/security`,
    {
      headers: { cookie },
      redirect: "manual",
    },
  );
  const securityHtml = await securityResponse.text();

  assert.equal(securityResponse.status, 200);
  assert.match(securityHtml, /PIN-код входа/);
});


test("e2e smoke: adult-without-profile can open onboarding without pathname headers", async () => {
  const cookie = authenticatedCookieHeader({
    uid: E2E_ADULT_NEW_USER_ID,
    email: "adult-new-e2e@example.test",
    fullName: "E2E Adult New",
  });

  const response = await fetch(`http://127.0.0.1:${appPort}/onboarding`, {
    headers: { cookie },
    redirect: "manual",
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Выберите, как начнёте работу в Shidao/);
});

test("e2e smoke: adult-without-profile is redirected from dashboard to onboarding", async () => {
  const cookie = authenticatedCookieHeader({
    uid: E2E_ADULT_NEW_USER_ID,
    email: "adult-new-e2e@example.test",
    fullName: "E2E Adult New",
  });

  const response = await fetch(`http://127.0.0.1:${appPort}/dashboard`, {
    headers: { cookie },
    redirect: "manual",
  });

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/onboarding");
});

test("e2e smoke: authenticated /login?confirmed=1 for adult-without-profile redirects to onboarding", async () => {
  const cookie = authenticatedCookieHeader({
    uid: E2E_ADULT_NEW_USER_ID,
    email: "adult-new-e2e@example.test",
    fullName: "E2E Adult New",
  });

  const response = await fetch(`http://127.0.0.1:${appPort}/login?confirmed=1`, {
    headers: {
      cookie,
      "x-pathname": "/login",
    },
    redirect: "manual",
  });

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/onboarding");
});
