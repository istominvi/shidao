import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("one communication center owns messages, system events and persisted AI dialogs", async () => {
  const [layout, center, provider, inbox, system, assistant] =
    await Promise.all([
      source("src/app/(app)/layout.tsx"),
      source("src/components/communication/communication-center.tsx"),
      source("src/components/communication/communication-center-provider.tsx"),
      source("src/components/communication/communication-inbox.tsx"),
      source("src/components/communication/system-conversation.tsx"),
      source("src/components/communication/assistant-conversation.tsx"),
    ]);

  assert.match(layout, /<CommunicationCenterProvider>/);
  assert.match(layout, /<CommunicationCenter\s*\/>/);
  assert.doesNotMatch(layout, /<SystemAssistant\s*\/>/);
  assert.match(center, /className="communication-center-launcher"/);
  assert.match(center, /<MessageCircle/);
  assert.match(center, /totalUnread/);
  assert.match(center, /lastMessageId: item\.lastMessageId/);
  assert.match(center, /canSend: item\.canSend/);
  assert.match(center, /lastNotificationId/);
  assert.match(inbox, /item\.kind === "system"/);
  assert.match(inbox, /item\.kind === "assistant"/);
  assert.match(provider, /type: "direct-target"/);
  assert.match(provider, /learnerProfileId: string/);
  assert.doesNotMatch(provider, /authUserId|accountId/i);
  assert.doesNotMatch(system, /<form[^>]*communication-composer|<textarea/);
  assert.match(system, /role="log"/);
  assert.match(system, /refreshKey/);
  assert.match(center, /refreshKey={systemRefreshKey}/);
  assert.match(assistant, /loadAssistantTurns/);
  assert.match(assistant, /sendAssistantTurn/);
  assert.match(assistant, /markAssistantConversationRead/);
  assert.match(
    await source("src/components/communication/human-conversation.tsx"),
    /thread\.lastMessageId === latestMessageId/,
  );
  assert.match(
    await source("src/components/communication/human-conversation.tsx"),
    /thread\.canSend \? \(/,
  );
  assert.match(
    await source("src/components/communication/human-conversation.tsx"),
    /caught\.status === 404[\s\S]*?onAccessRevoked\(thread\.id\)/,
  );
});

test("communication client uses only the canonical V2 API and atomic persisted AI exchange", async () => {
  const client = await source(
    "src/components/communication/communication-client.ts",
  );

  for (const route of [
    "/api/v2/inbox",
    "/api/v2/message-targets",
    "/api/v2/communication-threads",
    "/api/v2/assistant/conversations",
    "/api/v2/system-notifications",
  ]) {
    assert.match(client, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(client, /exchange: AssistantExchange/);
  assert.match(client, /localDate/);
  assert.match(client, /utcOffsetMinutes: -now\.getTimezoneOffset\(\)/);
  assert.doesNotMatch(client, /sendSystemAssistantMessage/);
  assert.doesNotMatch(client, /authUserId|accountId/i);
});

test("persisted AI proposals fail closed and reuse signed explicit apply", async () => {
  const [assistant, actionClient, actionUi] = await Promise.all([
    source("src/components/communication/assistant-conversation.tsx"),
    source("src/components/assistant/system-assistant-client.ts"),
    source("src/components/assistant/system-assistant.tsx"),
  ]);

  assert.match(assistant, /applySystemAssistantAction\(proposal\)/);
  assert.match(assistant, /confirmationIntent\(normalized\)/);
  assert.match(assistant, /liveProposalKey/);
  assert.match(assistant, /status: "stale" as const/);
  assert.match(assistant, /Подготовьте это предложение заново/);
  assert.match(actionClient, /proposal\.signature/);
  assert.match(actionUi, /case "lesson\.schedule_run"/);
  assert.match(actionUi, /Назначить урок/);
  assert.match(actionUi, /existingLessonRunId/);
});

test("context shortcuts expose only eligible learner and child-course chat targets", async () => {
  const [students, workspace, courses] = await Promise.all([
    source("src/components/teaching-hub/student-directory-table.tsx"),
    source("src/components/teaching-hub/students-workspace.tsx"),
    source("src/components/course-builder/course-actions.tsx"),
  ]);

  assert.match(students, /identityState !== "claimed"/);
  assert.match(students, /identityState !== "merged"/);
  assert.match(students, /onMessage\(entry\.profile\)/);
  assert.match(workspace, /openDirect\(profile\.id, profile\.displayName\)/);
  assert.match(courses, /educatorCourse[\s\S]*?message-course/);
  assert.match(courses, /openCourse\(course\.id, course\.title\)/);
});

test("communication center is full-screen and focus-trapped only on mobile", async () => {
  const [center, css] = await Promise.all([
    source("src/components/communication/communication-center.tsx"),
    source("src/app/styles/communication-center.css"),
  ]);

  assert.match(center, /MOBILE_MEDIA = "\(max-width: 640px\)"/);
  assert.match(center, /event\.key !== "Tab" \|\| !mobile/);
  assert.match(center, /document\.body\.style\.overflow = "hidden"/);
  assert.match(center, /aria-modal=\{mobile\}/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
});
