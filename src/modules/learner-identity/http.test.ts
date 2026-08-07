import assert from "node:assert/strict";
import test from "node:test";
import { readIdentityJson } from "./http";
import { LearnerIdentityApplicationError } from "./service";

test("identity JSON parsing maps malformed request bodies to a 400 validation error", async () => {
  await assert.rejects(
    readIdentityJson(
      new Request("https://v2.shidao.ru/api/v2/observers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{broken",
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof LearnerIdentityApplicationError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "learner_identity_validation");
      return true;
    },
  );
});

test("identity JSON parsing preserves valid structured bodies", async () => {
  assert.deepEqual(
    await readIdentityJson(
      new Request("https://v2.shidao.ru/api/v2/observers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }),
    ),
    { action: "accept" },
  );
});
