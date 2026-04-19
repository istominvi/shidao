import test from "node:test";
import assert from "node:assert/strict";
import {
  isGuardedAuthRoute,
  isProtectedAppRoute,
  isRouteWithin,
  isSafeRelativePath,
  isSettingsRoute,
} from "../routes";
import { ROUTES } from "../auth";

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
  assert.equal(isProtectedAppRoute("/dashboard"), true);
  assert.equal(isProtectedAppRoute("/schedule"), true);
  assert.equal(isProtectedAppRoute("/homework"), true);
  assert.equal(isProtectedAppRoute("/onboarding/step-2"), true);
  assert.equal(isProtectedAppRoute("/settings/team"), true);
  assert.equal(isProtectedAppRoute("/lessons/scheduled-1"), true);
  assert.equal(isProtectedAppRoute("/methodologies"), true);
  assert.equal(isProtectedAppRoute("/groups/class-1"), true);
  assert.equal(isProtectedAppRoute("/settings-security"), false);
  assert.equal(isProtectedAppRoute("/login"), false);
  assert.equal(isProtectedAppRoute(null), false);
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
