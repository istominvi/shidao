import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const routePaths = [
  "src/app/api/v2/inbox/route.ts",
  "src/app/api/v2/message-targets/route.ts",
  "src/app/api/v2/communication-threads/route.ts",
  "src/app/api/v2/communication-threads/[threadId]/messages/route.ts",
  "src/app/api/v2/communication-threads/[threadId]/read/route.ts",
  "src/app/api/v2/assistant/conversations/route.ts",
  "src/app/api/v2/assistant/quota/route.ts",
  "src/app/api/v2/assistant/conversations/[conversationId]/route.ts",
  "src/app/api/v2/assistant/conversations/[conversationId]/turns/route.ts",
  "src/app/api/v2/assistant/conversations/[conversationId]/read/route.ts",
  "src/app/api/v2/system-notifications/route.ts",
  "src/app/api/v2/system-notifications/read/route.ts",
];

test("every communication route resolves the active Account and none embeds service credentials", () => {
  for (const path of routePaths) {
    const contents = source(path);
    assert.match(contents, /getCommunicationContext\(/, path);
    assert.doesNotMatch(contents, /SUPABASE_SERVICE_ROLE_KEY/, path);
    assert.doesNotMatch(contents, /recipientAccountId|ownerAccountId/, path);
  }
});

test("trusted assistant persistence is dynamically loaded only after provider success", () => {
  const route = source(
    "src/app/api/v2/assistant/conversations/[conversationId]/turns/route.ts",
  );
  const orchestration = source(
    "src/modules/communication/assistant-orchestration.ts",
  );
  assert.match(
    route,
    /await import\(\s*"@\/modules\/communication\/admin-repository"/,
  );
  assert.ok(
    orchestration.indexOf("await dependencies.chat(") <
      orchestration.indexOf("await dependencies.loadAdminAppender()"),
    "provider reply must precede elevated repository loading",
  );
  assert.doesNotMatch(
    source("src/modules/communication/repository.ts"),
    /SUPABASE_SERVICE_ROLE_KEY|append_assistant_turn_admin/,
  );
});

test("monthly assistant meter is loaded independently from turns and exchange", () => {
  const quotaRoute = source("src/app/api/v2/assistant/quota/route.ts");
  const turnsRoute = source(
    "src/app/api/v2/assistant/conversations/[conversationId]/turns/route.ts",
  );

  assert.match(quotaRoute, /service\.getAssistantMonthlyQuota\(actor\)/);
  assert.doesNotMatch(turnsRoute, /getAssistantMonthlyQuota/);
  assert.doesNotMatch(turnsRoute, /\bquota\b/);
});
