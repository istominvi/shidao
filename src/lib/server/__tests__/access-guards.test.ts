import test from "node:test";
import assert from "node:assert/strict";
import { ROUTES } from "../../auth";
import {
  resolveAppLayoutRedirect,
  resolveAuthEntryRedirect,
} from "../access-guards";

test("the private app boundary enforces Account authentication", () => {
  for (const status of ["guest", "degraded"] as const) {
    assert.equal(resolveAppLayoutRedirect(status), ROUTES.login);
  }

  assert.equal(resolveAppLayoutRedirect("account"), null);
});

test("auth entry routes redirect a resolved Account to courses", () => {
  assert.equal(resolveAuthEntryRedirect({ status: "account" }), ROUTES.courses);
  assert.equal(resolveAuthEntryRedirect({ status: "guest" }), null);
  assert.equal(resolveAuthEntryRedirect({ status: "degraded" }), null);
});
