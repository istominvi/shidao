import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/server/communication-service.ts", "utf8");

test("communication service exposes neutral learner preview helper", () => {
  assert.equal(source.includes("getLearnerConversationPreviewReadModel"), true);
  assert.equal(source.includes("getConversationReadModelByClassStudent"), true);
});
