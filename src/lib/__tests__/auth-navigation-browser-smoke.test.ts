import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import net from "node:net";
import { after, before, test } from "node:test";
import {
  buildAppSessionSupabaseTokens,
  createAppSessionPayload,
  sealAppSession,
} from "../server/app-session";

const APP_SESSION_SECRET = "e2e-app-session-secret-value-with-minimum-32-chars";
const E2E_ADULT_USER_ID = "11111111-1111-4111-8111-111111111111";
const E2E_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const E2E_TEACHER_ID = "55555555-5555-4555-8555-555555555555";
const E2E_SCHOOL_ID = "66666666-6666-4666-8666-666666666666";
const E2E_COURSE_ID = "33333333-3333-4333-8333-333333333333";
const E2E_LESSON_ID = "44444444-4444-4444-8444-444444444444";
const E2E_COURSE_TITLE = "Английский для жизни";
const E2E_LESSON_TITLE = "Present Perfect · жизненный опыт";
const E2E_SUPABASE_ACCESS_TOKEN = "e2e-supabase-user-access-token";

const E2E_COURSE_ROW = {
  id: E2E_COURSE_ID,
  owner_account_id: E2E_ACCOUNT_ID,
  title: E2E_COURSE_TITLE,
  subject: "Английский язык",
  goal: "Научиться уверенно рассказывать о жизненном опыте.",
  level: "A2–B1",
  audience_description: "Взрослые ученики",
  target_lesson_count: 8,
  teacher_preferences: null,
  audience_type: "none",
  assembled_at: null,
  archived_at: null,
  created_at: "2026-08-05T08:00:00.000Z",
  updated_at: "2026-08-05T09:00:00.000Z",
};

const E2E_LESSON_ROW = {
  id: E2E_LESSON_ID,
  course_id: E2E_COURSE_ID,
  position: 4,
  title: E2E_LESSON_TITLE,
  summary: "Связываем форму времени с реальными историями ученика.",
  components: [],
  studentSlides: [],
  created_at: "2026-08-05T08:30:00.000Z",
  updated_at: "2026-08-05T09:00:00.000Z",
};

type PlaywrightLocator = {
  click: () => Promise<void>;
  waitFor: (options?: {
    state?: "attached" | "detached" | "visible" | "hidden";
    timeout?: number;
  }) => Promise<void>;
};

type PlaywrightChromium = {
  launch: () => Promise<{
    close: () => Promise<void>;
    newContext: (options?: {
      baseURL?: string;
      viewport?: { width: number; height: number };
    }) => Promise<{
      addCookies: (
        cookies: Array<{
          name: string;
          value: string;
          url: string;
        }>,
      ) => Promise<void>;
      newPage: () => Promise<{
        goto: (
          url: string,
          options?: { waitUntil?: "domcontentloaded" | "networkidle" },
        ) => Promise<void>;
        content: () => Promise<string>;
        evaluate: <T>(pageFunction: () => T) => Promise<T>;
        getByRole: (
          role: string,
          options?: {
            name?: string | RegExp;
            exact?: boolean;
            level?: number;
          },
        ) => PlaywrightLocator;
        url: () => string;
        waitForURL: (
          url: string | RegExp,
          options?: {
            timeout?: number;
            waitUntil?: "domcontentloaded" | "networkidle";
          },
        ) => Promise<void>;
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
const browserSmokeServerMode =
  requestedServerMode === "prod" ||
  (strictBrowserSmoke && requestedServerMode !== "dev")
    ? "prod"
    : "dev";

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
  const issuedAt = Date.now();
  const previousSecret = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = APP_SESSION_SECRET;

  try {
    const supabaseSession = buildAppSessionSupabaseTokens(
      {
        accessToken: E2E_SUPABASE_ACCESS_TOKEN,
        refreshToken: "e2e-supabase-user-refresh-token",
        expiresInSeconds: 3600,
      },
      issuedAt,
    );
    assert.ok(supabaseSession?.accessToken);

    return sealAppSession(
      createAppSessionPayload(
        {
          ...input,
          recoveryVerifiedAt: null,
          supabaseSession,
        },
        issuedAt,
      ),
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.APP_SESSION_SECRET;
    } else {
      process.env.APP_SESSION_SECRET = previousSecret;
    }
  }
}

function authenticatedCookieValue() {
  return buildSessionCookieValue({
    uid: E2E_ADULT_USER_ID,
    email: "adult-e2e@example.test",
    fullName: "E2E Adult",
  });
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
  return readEqFilter(requestUrl, "user_id");
}

function readEqFilter(requestUrl: URL, key: string) {
  const raw = requestUrl.searchParams.get(key);
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

  if (requestUrl.pathname === "/rest/v1/rpc/set_last_selected_school") {
    json(response, 200, null);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/current_session_invalid_before") {
    json(response, 200, null);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/account") {
    json(
      response,
      200,
      readEqFilter(requestUrl, "auth_user_id") === E2E_ADULT_USER_ID
        ? [{ id: E2E_ACCOUNT_ID, auth_user_id: E2E_ADULT_USER_ID }]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course") {
    const requestedCourseId = readEqFilter(requestUrl, "id");
    json(
      response,
      200,
      requestedCourseId && requestedCourseId !== E2E_COURSE_ID
        ? []
        : [E2E_COURSE_ROW],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/lesson") {
    const courseFilter = requestUrl.searchParams.get("course_id");
    if (courseFilter && !courseFilter.includes(E2E_COURSE_ID)) {
      json(response, 200, []);
      return;
    }

    const select = requestUrl.searchParams.get("select") ?? "";
    json(
      response,
      200,
      select.includes("components:lesson_component")
        ? [E2E_LESSON_ROW]
        : [{ id: E2E_LESSON_ID, course_id: E2E_COURSE_ID }],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_attachment") {
    json(response, 200, []);
    return;
  }

  const userId = readUserId(requestUrl);
  const isAdultUser = userId === E2E_ADULT_USER_ID;

  if (requestUrl.pathname === "/rest/v1/parent") {
    json(response, 200, []);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/teacher") {
    json(
      response,
      200,
      isAdultUser ? [{ id: E2E_TEACHER_ID, full_name: "E2E Adult" }] : [],
    );
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
              last_active_profile: "teacher",
              last_selected_school_id: null,
              theme: null,
              settings: {},
            },
          ]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/school_teacher") {
    const select = requestUrl.searchParams.get("select") ?? "";
    if (select === "teacher_id") {
      json(response, 200, [{ teacher_id: E2E_TEACHER_ID }]);
      return;
    }

    json(response, 200, [
      {
        id: "77777777-7777-4777-8777-777777777777",
        school_id: E2E_SCHOOL_ID,
        teacher_id: E2E_TEACHER_ID,
        role: "owner",
        school: {
          id: E2E_SCHOOL_ID,
          name: "Личное пространство E2E",
          kind: "personal",
          teacher_limit: 1,
        },
      },
    ]);
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

async function buildProductionApp(env: NodeJS.ProcessEnv) {
  const build = spawn("npm", ["run", "build"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const collect = (chunk: Buffer) => {
    output = `${output}${chunk.toString("utf8")}`.slice(-12_000);
  };
  build.stdout?.on("data", collect);
  build.stderr?.on("data", collect);

  const [code, signal] = (await once(build, "exit")) as [
    number | null,
    NodeJS.Signals | null,
  ];
  if (code !== 0) {
    throw new Error(
      `Production browser-smoke build failed (code=${String(code)}, signal=${String(signal)}).\n${output}`,
    );
  }
}

async function openPage(options?: {
  cookie?: string;
  viewport?: { width: number; height: number };
}) {
  if (!chromium || !appPort) {
    throw new Error("browser smoke is not ready");
  }

  const browser = await chromium.launch();
  const baseURL = `http://127.0.0.1:${appPort}`;
  const context = await browser.newContext({
    baseURL,
    viewport: options?.viewport,
  });
  if (options?.cookie) {
    await context.addCookies([
      {
        name: "shidao_session",
        value: options.cookie,
        url: baseURL,
      },
    ]);
  }
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

  const serverEnv = {
    ...process.env,
    APP_SESSION_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
  };

  if (browserSmokeServerMode === "prod") {
    await buildProductionApp(serverEnv);
  }

  appServerProcess = spawn(
    "npm",
    [
      "run",
      browserSmokeServerMode === "prod" ? "start" : "dev",
      "--",
      "--port",
      String(appPort),
    ],
    {
      cwd: process.cwd(),
      env: serverEnv,
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

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/api/auth/session", { waitUntil: "networkidle" });
    const sessionHtml = await runtime.page.content();
    assert.match(sessionHtml, /E2E Adult/);

    await runtime.page.goto("/", { waitUntil: "networkidle" });
    const html = await runtime.page.content();

    assert.match(html, /E2E Adult/);
  } finally {
    await runtime.close();
  }
});

test("browser smoke: guest on protected routes is redirected to /login", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  for (const protectedPath of ["/courses", "/schedule", "/students"]) {
    const runtime = await openPage();
    try {
      await runtime.page.goto(protectedPath, { waitUntil: "domcontentloaded" });
      assert.equal(new URL(runtime.page.url()).pathname, "/login");
    } finally {
      await runtime.close();
    }
  }
});

test("browser smoke: authenticated /login redirects by access policy", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/login", { waitUntil: "domcontentloaded" });
    await runtime.page.waitForURL(/\/courses$/, {
      timeout: 10_000,
      waitUntil: "domcontentloaded",
    });
    assert.equal(new URL(runtime.page.url()).pathname, "/courses");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: teacher navigates Schedule → Students with honest V2 states", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Расписание", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .getByRole("heading", { name: E2E_COURSE_TITLE, exact: true, level: 2 })
      .waitFor();

    const scheduleContract = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const title = document.querySelector<HTMLElement>(".app-page-title");
      const navLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          ".site-header-shell-demo .site-header-nav-pill",
        ),
      ).map((link) => ({
        label: link.textContent?.trim() ?? "",
        href: link.getAttribute("href"),
        current: link.getAttribute("aria-current"),
      }));

      if (!shell || !title) {
        throw new Error("Schedule shell contract is missing");
      }

      return {
        backgroundColor: getComputedStyle(shell).backgroundColor,
        backgroundImage: getComputedStyle(shell).backgroundImage,
        titleWeight: getComputedStyle(title).fontWeight,
        navLinks,
      };
    });

    assert.equal(scheduleContract.backgroundColor, "rgb(245, 241, 232)");
    assert.equal(scheduleContract.backgroundImage, "none");
    assert.equal(scheduleContract.titleWeight, "400");
    assert.deepEqual(scheduleContract.navLinks, [
      { label: "Расписание", href: "/schedule", current: "page" },
      { label: "Ученики", href: "/students", current: null },
      { label: "Курсы", href: "/courses", current: null },
    ]);

    let html = await runtime.page.content();
    assert.match(html, /Занятия пока не назначены/);
    assert.match(html, new RegExp(E2E_COURSE_TITLE));
    assert.doesNotMatch(html, /Миша Орлов|Food around the world/);

    const studentsLink = runtime.page.getByRole("link", {
      name: "Ученики",
      exact: true,
    });
    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      studentsLink.click(),
    ]);
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .getByRole("heading", { name: E2E_COURSE_TITLE, exact: true, level: 2 })
      .waitFor();

    html = await runtime.page.content();
    assert.match(html, /Ученики и группы появятся здесь/);
    assert.match(html, /Курсы ожидают назначения аудитории/);
    assert.match(html, new RegExp(E2E_COURSE_TITLE));
    assert.doesNotMatch(html, /Миша Орлов|Teen Talk|11 занятий/);

    const studentsCurrent = await runtime.page.evaluate(() =>
      document
        .querySelector<HTMLAnchorElement>(
          '.site-header-nav-pill[href="/students"]',
        )
        ?.getAttribute("aria-current"),
    );
    assert.equal(studentsCurrent, "page");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: mobile teacher menu exposes Schedule, Students and Courses", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({
    cookie: authenticatedCookieValue(),
    viewport: { width: 375, height: 812 },
  });

  try {
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("button", { name: "Открыть меню пользователя", exact: true })
      .click();

    await runtime.page
      .getByRole("menuitem", { name: "Расписание", exact: true })
      .waitFor();
    await runtime.page
      .getByRole("menuitem", { name: "Курсы", exact: true })
      .waitFor();
    const studentsMenuItem = runtime.page.getByRole("menuitem", {
      name: "Ученики",
      exact: true,
    });
    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      studentsMenuItem.click(),
    ]);
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();

    const mobileContract = await runtime.page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heading: document.querySelector("h1")?.textContent?.trim() ?? "",
    }));
    assert.equal(mobileContract.clientWidth, 375);
    assert.equal(mobileContract.scrollWidth, mobileContract.clientWidth);
    assert.equal(mobileContract.heading, "Ученики");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: course opens lesson workspace and returns to the course", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/courses", { waitUntil: "networkidle" });
    const courseLink = runtime.page.getByRole("link", {
      name: E2E_COURSE_TITLE,
      exact: true,
    });
    await courseLink.waitFor();
    const coursesVisual = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const topNav = document.querySelector<HTMLElement>(".course-top-nav");
      const header = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const title = document.querySelector<HTMLElement>(".app-page-title");
      const primaryButton = document.querySelector<HTMLElement>(
        ".product-btn-primary",
      );
      const navPill = document.querySelector<HTMLElement>(
        ".site-header-shell-demo .site-header-nav-pill",
      );
      const userTrigger = document.querySelector<HTMLElement>(
        ".site-header-shell-demo .nav-user-trigger",
      );

      if (
        !shell ||
        !topNav ||
        !header ||
        !title ||
        !primaryButton ||
        !navPill ||
        !userTrigger
      ) {
        throw new Error("Course visual contract elements are missing");
      }

      const shellStyle = getComputedStyle(shell);
      const titleStyle = getComputedStyle(title);
      const buttonStyle = getComputedStyle(primaryButton);
      const headerStyle = getComputedStyle(header);
      const navPillStyle = getComputedStyle(navPill);
      const userTriggerStyle = getComputedStyle(userTrigger);

      return {
        shellBackgroundColor: shellStyle.backgroundColor,
        shellBackgroundImage: shellStyle.backgroundImage,
        topNavPosition: getComputedStyle(topNav).position,
        headerHeight: headerStyle.height,
        headerRadius: headerStyle.borderRadius,
        titleFontFamily: titleStyle.fontFamily,
        titleFontSize: titleStyle.fontSize,
        titleFontWeight: titleStyle.fontWeight,
        bodyFontFamily: getComputedStyle(document.body).fontFamily,
        buttonRadius: buttonStyle.borderRadius,
        buttonFontSize: buttonStyle.fontSize,
        buttonFontWeight: buttonStyle.fontWeight,
        navPillRadius: navPillStyle.borderRadius,
        navPillFontWeight: navPillStyle.fontWeight,
        userTriggerRadius: userTriggerStyle.borderRadius,
        userTriggerFontWeight: userTriggerStyle.fontWeight,
      };
    });

    assert.equal(coursesVisual.shellBackgroundColor, "rgb(245, 241, 232)");
    assert.equal(coursesVisual.shellBackgroundImage, "none");
    assert.equal(coursesVisual.topNavPosition, "sticky");
    assert.equal(coursesVisual.headerHeight, "68px");
    assert.equal(coursesVisual.headerRadius, "20px");
    assert.equal(coursesVisual.titleFontFamily, coursesVisual.bodyFontFamily);
    assert.equal(coursesVisual.titleFontWeight, "400");
    assert.equal(coursesVisual.buttonRadius, "12px");
    assert.equal(coursesVisual.buttonFontWeight, "500");
    assert.equal(coursesVisual.navPillRadius, "12px");
    assert.equal(coursesVisual.navPillFontWeight, "500");
    assert.equal(coursesVisual.userTriggerRadius, "12px");
    assert.equal(coursesVisual.userTriggerFontWeight, "500");
    assert.ok(
      Math.abs(Number.parseFloat(coursesVisual.buttonFontSize) - 14.08) < 0.1,
    );

    await Promise.all([
      runtime.page.waitForURL(new RegExp(`/courses/${E2E_COURSE_ID}$`)),
      courseLink.click(),
    ]);

    const courseHeading = runtime.page.getByRole("heading", {
      name: E2E_COURSE_TITLE,
      exact: true,
      level: 1,
    });
    await courseHeading.waitFor();
    const courseVisual = await runtime.page.evaluate(() => {
      const pageHeader = document.querySelector<HTMLElement>(
        ".workspace-page-header",
      );
      const title = pageHeader?.querySelector<HTMLElement>(".app-page-title");
      const tab = document.querySelector<HTMLElement>(".workspace-tab");

      if (!pageHeader || !title || !tab) {
        throw new Error(
          "Course workspace visual contract elements are missing",
        );
      }

      const headerStyle = getComputedStyle(pageHeader);
      const titleStyle = getComputedStyle(title);
      const tabStyle = getComputedStyle(tab);

      return {
        headerBackgroundColor: headerStyle.backgroundColor,
        headerBackgroundImage: headerStyle.backgroundImage,
        headerBorderWidth: headerStyle.borderWidth,
        headerShadow: headerStyle.boxShadow,
        titleFontFamily: titleStyle.fontFamily,
        titleFontSize: titleStyle.fontSize,
        titleFontWeight: titleStyle.fontWeight,
        tabHeight: tabStyle.height,
        tabRadius: tabStyle.borderRadius,
        tabFontWeight: tabStyle.fontWeight,
      };
    });

    assert.equal(courseVisual.headerBackgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(courseVisual.headerBackgroundImage, "none");
    assert.equal(courseVisual.headerBorderWidth, "0px");
    assert.equal(courseVisual.headerShadow, "none");
    assert.equal(courseVisual.titleFontFamily, coursesVisual.titleFontFamily);
    assert.equal(courseVisual.titleFontWeight, "400");
    assert.ok(
      Number.parseFloat(courseVisual.titleFontSize) >
        Number.parseFloat(coursesVisual.titleFontSize),
    );
    assert.equal(courseVisual.tabHeight, "40px");
    assert.equal(courseVisual.tabRadius, "12px");
    assert.equal(courseVisual.tabFontWeight, "500");

    let html = await runtime.page.content();
    assert.match(html, /aria-label="Разделы курса"/);
    assert.match(html, /Уроки/);
    assert.match(html, /Описание/);
    assert.match(html, /Источники/);
    assert.match(html, /Материалы/);
    assert.match(html, /История/);

    const lessonButton = runtime.page.getByRole("button", {
      name: new RegExp(E2E_LESSON_TITLE),
    });
    await lessonButton.click();

    const lessonHeading = runtime.page.getByRole("heading", {
      name: `Урок 4. ${E2E_LESSON_TITLE}`,
      exact: true,
      level: 1,
    });
    await lessonHeading.waitFor();
    const lessonVisual = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const title = document.querySelector<HTMLElement>(
        ".workspace-page-header .app-page-title",
      );

      if (!shell || !title) {
        throw new Error("Lesson visual contract elements are missing");
      }

      const titleStyle = getComputedStyle(title);
      return {
        shellBackgroundImage: getComputedStyle(shell).backgroundImage,
        titleFontFamily: titleStyle.fontFamily,
        titleFontWeight: titleStyle.fontWeight,
      };
    });

    assert.equal(lessonVisual.shellBackgroundImage, "none");
    assert.equal(lessonVisual.titleFontFamily, coursesVisual.titleFontFamily);
    assert.equal(lessonVisual.titleFontWeight, "400");

    html = await runtime.page.content();
    assert.match(html, /aria-label="Разделы урока"/);
    assert.match(html, /План/);
    assert.match(html, /Экран ученика/);
    assert.match(html, /Домашнее задание/);

    await runtime.page
      .getByRole("button", {
        name: `Вернуться: ${E2E_COURSE_TITLE}`,
        exact: true,
      })
      .click();
    await courseHeading.waitFor();

    html = await runtime.page.content();
    assert.match(html, /aria-label="Разделы курса"/);
    assert.match(html, new RegExp(E2E_LESSON_TITLE));
  } finally {
    await runtime.close();
  }
});

test("browser smoke: mobile Course and Lesson keep the demo rhythm without page overflow", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({
    cookie: authenticatedCookieValue(),
    viewport: { width: 375, height: 812 },
  });

  try {
    await runtime.page.goto(`/courses/${E2E_COURSE_ID}`, {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", {
        name: E2E_COURSE_TITLE,
        exact: true,
        level: 1,
      })
      .waitFor();
    await runtime.page
      .getByRole("button", { name: new RegExp(E2E_LESSON_TITLE) })
      .click();
    await runtime.page
      .getByRole("heading", {
        name: `Урок 4. ${E2E_LESSON_TITLE}`,
        exact: true,
        level: 1,
      })
      .waitFor();

    const mobileVisual = await runtime.page.evaluate(() => {
      const title = document.querySelector<HTMLElement>(
        ".workspace-page-header .app-page-title",
      );
      const header = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const tabStrip = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );

      if (!title || !header || !tabStrip) {
        throw new Error("Mobile Course visual contract elements are missing");
      }

      const titleStyle = getComputedStyle(title);
      const titleRect = title.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();

      return {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        headerLeft: headerRect.left,
        headerRight: headerRect.right,
        titleLeft: titleRect.left,
        titleRight: titleRect.right,
        titleFontSize: titleStyle.fontSize,
        titleFontWeight: titleStyle.fontWeight,
        tabStripClientWidth: tabStrip.clientWidth,
        tabStripScrollWidth: tabStrip.scrollWidth,
      };
    });

    assert.equal(mobileVisual.documentClientWidth, 375);
    assert.equal(
      mobileVisual.documentScrollWidth,
      mobileVisual.documentClientWidth,
    );
    assert.ok(mobileVisual.headerLeft >= 0);
    assert.ok(mobileVisual.headerRight <= mobileVisual.documentClientWidth);
    assert.ok(mobileVisual.titleLeft >= 0);
    assert.ok(mobileVisual.titleRight <= mobileVisual.documentClientWidth);
    assert.equal(mobileVisual.titleFontSize, "36px");
    assert.equal(mobileVisual.titleFontWeight, "400");
    assert.ok(
      mobileVisual.tabStripScrollWidth >= mobileVisual.tabStripClientWidth,
    );
  } finally {
    await runtime.close();
  }
});
