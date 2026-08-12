import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("active auth and shell resolve only the universal Account context", () => {
  const activeSources = [
    "src/lib/server/access-policy.ts",
    "src/lib/server/session-view.ts",
    "src/app/api/auth/login/route.ts",
    "src/app/api/onboarding/route.ts",
    "src/app/api/settings/security/pin/route.ts",
    "src/app/api/settings/profile/email/route.ts",
    "src/app/api/auth/reset-password/route.ts",
  ].map(source);
  const combined = activeSources.join("\n");

  assert.match(
    combined,
    /current_account_auth_context|CurrentAccountAuthContext/,
  );
  assert.doesNotMatch(combined, /getUserContextById/);
  assert.doesNotMatch(combined, /findStudentAuthEmail|verifyUserPin/);
  assert.doesNotMatch(combined, /ensureUserPreference|setLastActiveProfile/);
  assert.doesNotMatch(combined, /supabase-admin/);
  assert.doesNotMatch(combined, /\/rest\/v1\/(parent|teacher|student)/);
  assert.doesNotMatch(
    combined,
    /availableAdultProfiles|activeProfile|actorKind/,
  );
});

test("browser session projection excludes internal Account and Auth IDs", () => {
  const browserView = source("src/lib/session-view.ts");
  const serverView = source("src/lib/server/session-view.ts");
  assert.doesNotMatch(browserView, /userId|accountId/);
  assert.doesNotMatch(serverView, /userId:|accountId:/);
  assert.match(source("src/app/api/auth/session/route.ts"), /no-store/);
  const confirmRoute = source("src/app/(auth)/auth/confirm/route.ts");
  assert.match(confirmRoute, /Referrer-Policy", "no-referrer"/);
  assert.match(confirmRoute, /Cache-Control", "no-store"/);
});

test("role switch and legacy school preference endpoints are retired", () => {
  for (const path of [
    "src/app/api/preferences/profile/route.ts",
    "src/app/api/preferences/school/route.ts",
  ]) {
    const route = source(path);
    assert.match(route, /status: 410/);
    assert.doesNotMatch(route, /supabase-admin|getUserContextById/);
  }
});

test("active request validation has no role or school-switch contract", () => {
  const validation = source("src/lib/server/validation.ts");
  assert.doesNotMatch(
    validation,
    /ProfileKind|profileSwitch|onboardingPayloadSchema|schoolSwitch/,
  );
});

test("Account navigation has no role switch client or teacher-only guard", () => {
  const sessionMenu = source("src/components/session-nav-actions.tsx");
  const accountNav = source("src/lib/navigation/primary-nav.ts");
  const teacherGroup = source("src/app/(app)/(teacher-required)/layout.tsx");

  assert.doesNotMatch(sessionMenu, /preferences\/profile|SegmentedControl/);
  const primaryNavIndices = ["Расписание", "Ученики", "Курсы", "Магазин"].map(
    (label) => accountNav.indexOf(`label: "${label}"`),
  );
  assert.ok(primaryNavIndices.every((index) => index >= 0));
  assert.deepEqual(
    primaryNavIndices,
    [...primaryNavIndices].sort((left, right) => left - right),
  );
  assert.doesNotMatch(accountNav, /Мой учебный профиль|label: "Наблюдение"/);
  assert.match(sessionMenu, /ROUTES\.learningProfile/);
  assert.match(sessionMenu, /Учебный профиль/);
  assert.ok(
    sessionMenu.indexOf("Учебный профиль") < sessionMenu.indexOf("Настройки") &&
      sessionMenu.indexOf("Настройки") < sessionMenu.indexOf("Выход"),
  );
  assert.doesNotMatch(teacherGroup, /activeProfile|teacher/);
});

test("sensitive Account flows use password-first recent reauthentication", () => {
  const reauthRoute = source("src/app/api/auth/reauth/route.ts");
  const pinRoute = source("src/app/api/settings/security/pin/route.ts");
  const onboardingRoute = source("src/app/api/onboarding/route.ts");

  assert.ok(
    reauthRoute.indexOf("await trySignInAccountWithPassword") <
      reauthRoute.indexOf("await verifyCurrentAccountPin"),
  );
  assert.match(reauthRoute, /reauthenticatedAt: Date\.now\(\)/);
  assert.match(reauthRoute, /isSessionRevoked/);
  assert.ok(
    pinRoute.indexOf("const passwordConfirmed") <
      pinRoute.indexOf("await verifyCurrentAccountPin"),
  );
  assert.ok(
    pinRoute.indexOf("await verifyCurrentAccountPin") <
      pinRoute.indexOf("await setCurrentAccountPin"),
  );
  assert.match(onboardingRoute, /isSessionRevoked/);
  assert.ok(
    onboardingRoute.indexOf("await getCurrentAccountAuthContext") <
      onboardingRoute.indexOf("await updateCurrentAccountProfile"),
  );
});

test("public signup and recovery endpoints are rate limited", () => {
  for (const path of [
    "src/app/api/auth/signup/route.ts",
    "src/app/api/auth/recovery/route.ts",
  ]) {
    const route = source(path);
    assert.match(route, /hitRateLimit/);
    assert.match(route, /status: 429/);
    assert.match(route, /Retry-After/);
  }
});

test("security settings never render a new PIN as plain text", () => {
  const securityForm = source(
    "src/app/(app)/(profile-required)/settings/security/security-settings-form.tsx",
  );

  assert.match(securityForm, /type="password"[\s\S]{0,240}value=\{newPin\}/);
  assert.match(securityForm, /autoComplete="new-password"/);
  assert.match(securityForm, /pattern="\[0-9\]\{4,8\}"/);
});

test("signup carries only a validated invitation return path", () => {
  const joinPage = source("src/app/(auth)/(entry)/join/page.tsx");
  const signupRoute = source("src/app/api/auth/signup/route.ts");

  assert.match(joinPage, /const safeNext = afterLogin\(/);
  assert.match(joinPage, /next: safeNext/);
  assert.match(signupRoute, /resolveSafeAuthRedirect\(/);
  assert.match(
    signupRoute,
    /emailRedirectTo\.searchParams\.set\("next", next\)/,
  );
  assert.doesNotMatch(signupRoute, /token_hash.*redirectTo/);
});
