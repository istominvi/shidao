import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import { once } from "node:events";
import { access } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import net from "node:net";
import { after, before, test } from "node:test";

const APP_SESSION_SECRET = "e2e-app-session-secret-value-with-minimum-32-chars";
const E2E_ADULT_USER_ID = "e2e-adult";

type PlaywrightChromium = {
  launch: () => Promise<{
    close: () => Promise<void>;
    newContext: (options?: {
      baseURL?: string;
      extraHTTPHeaders?: Record<string, string>;
    }) => Promise<{
      newPage: () => Promise<{
        goto: (
          url: string,
          options?: { waitUntil?: "domcontentloaded" | "networkidle" },
        ) => Promise<void>;
        content: () => Promise<string>;
        url: () => string;
      }>;
      close: () => Promise<void>;
    }>;
  }>;
};

let appPort = 0;
let mockPort = 0;
let appServerProcess: ChildProcess | null = null;
let mockServer: ReturnType<typeof createServer> | null = null;
let chromium: PlaywrightChromium | null = null;
let browserSmokeUnavailableReason: string | null = null;

const strictBrowserSmoke =
  process.env.REQUIRE_BROWSER_SMOKE === "1" || process.env.CI === "true";
const requestedServerMode = process.env.BROWSER_SMOKE_SERVER_MODE;
const browserSmokeServerMode = requestedServerMode === "dev" ? "dev" : "prod";

async function hasProductionBuild() {
  try {
    await access(".next/BUILD_ID");
    return true;
  } catch {
    return false;
  }
}

function assertBrowserSmokeRequirement(reason: string) {
  if (strictBrowserSmoke) {
    throw new Error(`Browser smoke is required in strict mode: ${reason}`);
  }

  browserSmokeUnavailableReason = reason;
}

function resolveBrowserInstallHint(error: unknown) {
  const message =
    error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
  const normalized = message.toLowerCase();

  if (
    normalized.includes("executable doesn't exist") ||
    normalized.includes("browserType.launch") ||
    normalized.includes("playwright install")
  ) {
    return "Playwright package is installed, but Chromium binaries are missing. Run `npx playwright install chromium` (or `npx playwright install`) to enable browser smoke tests.";
  }

  return `Playwright Chromium is unavailable in this environment: ${message}`;
}

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

function authenticatedCookieHeader() {
  const cookie = buildSessionCookieValue({
    uid: E2E_ADULT_USER_ID,
    email: "adult-e2e@example.test",
    fullName: "E2E Adult",
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

async function openPage(options?: { cookie?: string }) {
  if (!chromium || !appPort) {
    throw new Error("browser smoke is not ready");
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${appPort}`,
    extraHTTPHeaders: options?.cookie ? { cookie: options.cookie } : undefined,
  });
  const page = await context.newPage();

  return {
    page,
    async close() {
      await context.close();
      await browser.close();
    },
  };
}

before(async () => {
  try {
    const loadPlaywright = new Function(
      "return import('playwright')",
    ) as () => Promise<{
      chromium?: PlaywrightChromium;
    }>;
    const playwrightModule = await loadPlaywright();
    chromium = playwrightModule.chromium ?? null;
  } catch {
    assertBrowserSmokeRequirement(
      "Install 'playwright' to enable real browser smoke tests.",
    );
    return;
  }

  if (!chromium) {
    assertBrowserSmokeRequirement(
      "Install 'playwright' to enable real browser smoke tests.",
    );
    return;
  }

  try {
    const browser = await chromium.launch();
    await browser.close();
  } catch (error) {
    assertBrowserSmokeRequirement(resolveBrowserInstallHint(error));
    chromium = null;
    return;
  }

  mockPort = await allocatePort();
  appPort = await allocatePort();

  mockServer = createServer(handleMockSupabase);
  mockServer.listen(mockPort, "127.0.0.1");
  await once(mockServer, "listening");

  const hasBuild = await hasProductionBuild();
  const serverMode =
    browserSmokeServerMode === "prod" && !hasBuild
      ? "dev"
      : browserSmokeServerMode;

  if (browserSmokeServerMode === "prod" && !hasBuild && strictBrowserSmoke) {
    throw new Error(
      "Browser smoke strict mode requires a production build. Run `npm run build` before `npm run test:browser`.",
    );
  }

  if (browserSmokeServerMode === "prod" && !hasBuild) {
    console.warn(
      "[browser-smoke] .next/BUILD_ID was not found, falling back to `npm run dev`.",
    );
  }

  appServerProcess = spawn(
    "npm",
    [
      "run",
      serverMode === "prod" ? "start" : "dev",
      "--",
      "--port",
      String(appPort),
    ],
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
    } catch {
      // process already exited
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      process.kill(-appServerProcess.pid, "SIGKILL");
    } catch {
      // process already exited
    }
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

test("browser smoke: guest opens / and sees guest header CTA", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  {
    const runtime = await openPage();

    try {
      await runtime.page.goto("/", { waitUntil: "networkidle" });
      const html = await runtime.page.content();

      assert.match(html, /Войти/);
      assert.match(html, /Создать аккаунт/);
    } finally {
      await runtime.close();
    }
  }
});

test("browser smoke: authenticated user on / sees auth-aware header", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieHeader() });

  try {
    await runtime.page.goto("/", { waitUntil: "networkidle" });
    const html = await runtime.page.content();

    assert.match(html, /E2E Adult/);
  } finally {
    await runtime.close();
  }
});

test("browser smoke: guest on protected route is redirected to /login", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage();

  try {
    await runtime.page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    assert.equal(new URL(runtime.page.url()).pathname, "/login");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: authenticated /login redirects by access policy", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieHeader() });

  try {
    await runtime.page.goto("/login", { waitUntil: "domcontentloaded" });
    assert.equal(new URL(runtime.page.url()).pathname, "/dashboard");
  } finally {
    await runtime.close();
  }
});
