import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES } from "../../auth";
import { resolvePostLoginRedirectForContext } from "../post-login-redirect";

test("post-login redirect is capability-neutral for every Account", () => {
  assert.equal(resolvePostLoginRedirectForContext(), ROUTES.courses);
});
