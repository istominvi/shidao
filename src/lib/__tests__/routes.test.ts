import test from "node:test";
import assert from "node:assert/strict";
import {
  isGuardedAuthRoute,
  isProtectedAppRoute,
  isRouteWithin,
  isSafeRelativePath,
  isSettingsRoute,
} from "../routes";
import { ROUTES, toCourseRoute, toCourseStudentPreviewRoute } from "../auth";

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
  assert.equal(isProtectedAppRoute("/schedule"), false);
  assert.equal(isProtectedAppRoute("/homework"), false);
  assert.equal(isProtectedAppRoute("/onboarding/step-2"), true);
  assert.equal(isProtectedAppRoute("/settings/team"), true);
  assert.equal(isProtectedAppRoute("/lessons/scheduled-1"), false);
  assert.equal(isProtectedAppRoute("/methodologies"), false);
  assert.equal(isProtectedAppRoute("/groups/class-1"), false);
  assert.equal(isProtectedAppRoute("/courses"), true);
  assert.equal(isProtectedAppRoute("/courses/course-1/student-preview"), true);
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
  assert.equal(isSafeRelativePath("dashboard"), false);
});
