import test from "node:test";
import assert from "node:assert/strict";
import {
  isGuardedAuthRoute,
  isProtectedAppRoute,
  isRouteWithin,
  isSafeRelativePath,
  isSettingsRoute,
} from "../routes";
import {
  ROUTES,
  toCourseRoute,
  toCourseStudentPreviewRoute,
  toLessonRunRoute,
} from "../auth";
import {
  PROFILE_NAV_ITEMS,
  profileCompatibilityHref,
  profileSettingsStatusHref,
  profileTabHref,
  resolveProfileTab,
} from "../navigation/profile-nav";

test("isRouteWithin matches exact route and nested route", () => {
  assert.equal(isRouteWithin(ROUTES.settings, ROUTES.settings), true);
  assert.equal(isRouteWithin(ROUTES.settingsSecurity, ROUTES.settings), true);
  assert.equal(isRouteWithin("/settings-security", ROUTES.settings), false);
});

test("isSettingsRoute matches settings tree only", () => {
  assert.equal(isSettingsRoute("/settings"), true);
  assert.equal(isSettingsRoute("/settings/team"), true);
  assert.equal(isSettingsRoute("/dashboard"), false);
});

test("isProtectedAppRoute covers private app trees", () => {
  assert.equal(isProtectedAppRoute("/dashboard"), false);
  assert.equal(isProtectedAppRoute(ROUTES.schedule), true);
  assert.equal(isProtectedAppRoute(`${ROUTES.schedule}/day`), true);
  assert.equal(isProtectedAppRoute("/schedule-old"), false);
  assert.equal(isProtectedAppRoute(ROUTES.students), true);
  assert.equal(isProtectedAppRoute(`${ROUTES.students}/student-1`), true);
  assert.equal(isProtectedAppRoute("/studentship"), false);
  assert.equal(isProtectedAppRoute("/homework"), false);
  assert.equal(isProtectedAppRoute("/onboarding/step-2"), true);
  assert.equal(isProtectedAppRoute("/settings/team"), true);
  assert.equal(isProtectedAppRoute("/lessons/scheduled-1"), false);
  assert.equal(isProtectedAppRoute("/methodologies"), false);
  assert.equal(isProtectedAppRoute("/groups/class-1"), false);
  assert.equal(isProtectedAppRoute("/courses"), true);
  assert.equal(isProtectedAppRoute("/courses/course-1/student-preview"), true);
  assert.equal(isProtectedAppRoute(ROUTES.store), true);
  assert.equal(isProtectedAppRoute(`${ROUTES.store}/product-1`), true);
  assert.equal(isProtectedAppRoute("/storefront"), false);
  assert.equal(isProtectedAppRoute(ROUTES.profile), true);
  assert.equal(isProtectedAppRoute(`${ROUTES.profile}/history`), true);
  assert.equal(isProtectedAppRoute(ROUTES.learningProfile), true);
  assert.equal(isProtectedAppRoute(`${ROUTES.learningProfile}/history`), true);
  assert.equal(isProtectedAppRoute(ROUTES.observing), true);
  assert.equal(isProtectedAppRoute(`${ROUTES.observing}/profile-1`), true);
  assert.equal(isProtectedAppRoute("/settings-security"), false);
  assert.equal(isProtectedAppRoute("/login"), false);
  assert.equal(isProtectedAppRoute(null), false);
});

test("course route helpers encode ids and share one workspace route", () => {
  assert.equal(toCourseRoute("course/id"), "/courses/course%2Fid");
  assert.equal(
    toCourseStudentPreviewRoute("course/id"),
    "/courses/course%2Fid/student-preview",
  );
  assert.equal(
    toLessonRunRoute("course/id", "run/id"),
    "/courses/course%2Fid/runs/run%2Fid",
  );
});

test("settings routes are recognized only via settings tree helper", () => {
  assert.equal(isSettingsRoute("/settings/security"), true);
  assert.equal(isSettingsRoute("/settings-security"), false);
  assert.equal(isSettingsRoute(undefined), false);
});

test("isGuardedAuthRoute includes only login and join routes", () => {
  assert.equal(isGuardedAuthRoute("/login"), true);
  assert.equal(isGuardedAuthRoute("/join"), true);
  assert.equal(isGuardedAuthRoute("/join/check-email"), false);
  assert.equal(isGuardedAuthRoute("/dashboard"), false);
});

test("isSafeRelativePath rejects external and protocol-relative redirects", () => {
  assert.equal(isSafeRelativePath("/dashboard"), true);
  assert.equal(isSafeRelativePath("/settings/profile?emailChanged=1"), true);
  assert.equal(isSafeRelativePath("https://malicious.example"), false);
  assert.equal(isSafeRelativePath("//malicious.example"), false);
  assert.equal(isSafeRelativePath("/\\malicious.example"), false);
  assert.equal(isSafeRelativePath("/%5cmalicious.example"), false);
  assert.equal(isSafeRelativePath("/safe%0d%0aLocation:evil"), false);
  assert.equal(isSafeRelativePath("dashboard"), false);
});

test("profile tabs have stable addressable URLs and fail closed to profile", () => {
  assert.deepEqual(
    PROFILE_NAV_ITEMS.map((item) => item.id),
    ["profile", "history", "attestation", "observers", "settings"],
  );
  assert.equal(profileTabHref("profile"), ROUTES.profile);
  assert.equal(profileTabHref("observers"), `${ROUTES.profile}?tab=observers`);
  assert.equal(
    profileSettingsStatusHref("emailChanged"),
    `${ROUTES.profile}?tab=settings&emailChanged=1`,
  );
  assert.equal(resolveProfileTab("history"), "history");
  assert.equal(resolveProfileTab(["settings", "history"]), "settings");
  assert.equal(resolveProfileTab("unknown"), "profile");
  assert.equal(resolveProfileTab(undefined), "profile");
});

test("legacy profile redirects retain safe query values and forced tab semantics", () => {
  assert.equal(
    profileCompatibilityHref({
      tab: ["history", "settings"],
      filter: "семья и школа",
      empty: undefined,
    }),
    `${ROUTES.profile}?tab=history&tab=settings&filter=%D1%81%D0%B5%D0%BC%D1%8C%D1%8F+%D0%B8+%D1%88%D0%BA%D0%BE%D0%BB%D0%B0`,
  );
  assert.equal(
    profileCompatibilityHref(
      { tab: "history", emailChanged: "1", source: ["a", "b"] },
      { tab: "settings", fragment: "security" },
    ),
    `${ROUTES.profile}?tab=settings&emailChanged=1&source=a&source=b#security`,
  );
  assert.equal(
    profileCompatibilityHref({}, { tab: "profile" }),
    ROUTES.profile,
  );
});
