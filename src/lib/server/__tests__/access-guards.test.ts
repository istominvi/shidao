import test from "node:test";
import assert from "node:assert/strict";
import { ROUTES } from "../../auth";
import {
  resolvePrivateLayoutRedirect,
  resolveUserContextRedirect,
} from "../access-guards";

test("private layout redirects guest/degraded to login", () => {
  assert.equal(resolvePrivateLayoutRedirect("guest"), ROUTES.login);
  assert.equal(resolvePrivateLayoutRedirect("degraded"), ROUTES.login);
});

test("private layout does not redirect authenticated states", () => {
  assert.equal(resolvePrivateLayoutRedirect("adult-without-profile"), null);
  assert.equal(resolvePrivateLayoutRedirect("student"), null);
  assert.equal(resolvePrivateLayoutRedirect("adult-with-profile"), null);
});

test("requireUserContext contract redirects only guest and adult-without-profile", () => {
  assert.equal(resolveUserContextRedirect("guest"), ROUTES.login);
  assert.equal(
    resolveUserContextRedirect("adult-without-profile"),
    ROUTES.onboarding,
  );
  assert.equal(resolveUserContextRedirect("student"), null);
  assert.equal(resolveUserContextRedirect("adult-with-profile"), null);
  assert.equal(resolveUserContextRedirect("degraded"), null);
});
