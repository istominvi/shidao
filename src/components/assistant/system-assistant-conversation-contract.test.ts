import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { applySystemAssistantAction } from "./system-assistant-client";
import type {
  SystemAssistantActionProposal,
  SystemAssistantActionResult,
} from "@/modules/ai/system-assistant-contracts";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

function between(value: string, start: string, end: string) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return value.slice(startIndex, endIndex);
}

test("assistant apply client sends the server-issued proposal signature unchanged", async () => {
  const proposal = {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    signature: "server-issued-payload.server-issued-mac",
    action: {
      type: "course.add_lesson",
      courseId: "22222222-2222-4222-8222-222222222222",
      courseTitle: "Математика для дошкольников",
      input: { title: "4 урок", summary: "" },
    },
  } satisfies SystemAssistantActionProposal;
  const result = {
    type: "course.add_lesson",
    courseId: proposal.action.courseId,
    courseTitle: proposal.action.courseTitle,
    lessonId: "33333333-3333-4333-8333-333333333333",
    lessonTitle: proposal.action.input.title,
    href: `/courses/${proposal.action.courseId}?lesson=33333333-3333-4333-8333-333333333333`,
  } satisfies SystemAssistantActionResult;
  const originalFetch = globalThis.fetch;
  let sentBody: unknown;

  globalThis.fetch = async (_input, init) => {
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    assert.deepEqual(await applySystemAssistantAction(proposal), result);
    assert.deepEqual(sentBody, {
      idempotencyKey: proposal.idempotencyKey,
      action: proposal.action,
      signature: proposal.signature,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("apply route verifies the signed proposal before any idempotent mutation", async () => {
  const [route, service] = await Promise.all([
    source("src/app/api/v2/assistant/actions/apply/route.ts"),
    source("src/modules/ai/system-assistant-service.ts"),
  ]);
  const verification = route.indexOf("verifySystemAssistantActionProposal(");
  const idempotentApply = route.indexOf("runIdempotentAiAssistantAction(");
  const mutation = route.indexOf("assistant.applyAction(parsed.data.action)");
  assert.ok(verification >= 0);
  assert.ok(idempotentApply > verification);
  assert.ok(mutation > idempotentApply);
  assert.match(route, /actorAuthUserId:\s*actor\.authUserId/);
  assert.match(
    route.slice(verification, idempotentApply),
    /verifySystemAssistantActionProposal\(parsed\.data\.signature/,
  );
  const reply = service.indexOf("proposedAction: unsignedProposal");
  const sealing = service.indexOf("sealSystemAssistantActionProposal(", reply);
  assert.ok(reply >= 0);
  assert.ok(sealing > reply);
  assert.match(
    service.slice(reply, sealing + 500),
    /actorAuthUserId:\s*actor\.authUserId/,
  );
  assert.match(
    service.slice(reply, sealing + 500),
    /proposal:\s*unsignedProposal/,
  );
});

test("communication action card renders every action kind and warns before destructive lesson deletion", async () => {
  const actionUi = await source(
    "src/components/communication/assistant-action-card.tsx",
  );
  const titles = between(
    actionUi,
    "export function actionTitle(",
    "export function verifiedMessage(",
  );
  for (const actionType of [
    "course.create_draft",
    "course.add_lesson",
    "course.add_lesson_with_plan",
    "lesson.fill",
    "lesson.delete",
    "lesson.schedule_run",
  ]) {
    assert.match(titles, new RegExp(`case ["']${actionType}["']:`));
  }
  const card = actionUi.slice(
    actionUi.indexOf("export function AssistantActionCard("),
  );
  assert.match(card, /action\.input\.plan\.components\.map/);
  assert.match(card, /Будет удалён урок/);
  assert.match(
    card,
    /Завершённые индивидуальные результаты учеников сохранятся/,
  );
  assert.match(card, /communication-assistant-danger-button/);
  assert.doesNotMatch(
    card,
    /system-assistant-(?:action|plan|danger|primary|secondary)/,
  );
});

test("exact confirmation or cancellation targets only the latest persisted proposal without a provider call", async () => {
  const [actionUi, conversation] = await Promise.all([
    source("src/components/communication/assistant-action-card.tsx"),
    source("src/components/communication/assistant-conversation.tsx"),
  ]);
  const confirmation = between(
    actionUi,
    "const CONFIRM_WORDS",
    "export function actionTitle(",
  );
  assert.match(confirmation, /["']да["']/);
  assert.match(confirmation, /["']нет["']/);
  assert.match(confirmation, /CONFIRM_WORDS\.has\(normalized\)/);
  assert.match(confirmation, /CANCEL_WORDS\.has\(normalized\)/);
  assert.doesNotMatch(confirmation, /includes\(normalized\)/);

  const pending = between(
    conversation,
    "function latestPendingProposal(",
    "function errorMessage(",
  );
  assert.match(
    pending,
    /for \(let index = turns\.length - 1; index >= 0; index -= 1\)/,
  );
  assert.match(pending, /if \(!proposal\) continue/);
  assert.match(pending, /return proposal/);

  const send = between(
    conversation,
    "async function send(",
    "function submit(",
  );
  const intentBranch = send.indexOf('if (proposal && intent === "confirm")');
  const providerCall = send.indexOf("sendAssistantTurn(");
  assert.ok(intentBranch >= 0);
  assert.ok(providerCall > intentBranch);
  const beforeProvider = send.slice(intentBranch, providerCall);
  assert.match(beforeProvider, /applyAction\(proposal\)/);
  assert.match(beforeProvider, /intent === "cancel"/);
  assert.match(beforeProvider, /cancelAction\(proposal\)/);
  assert.match(beforeProvider, /return;/);
});

test("a new persisted assistant request supersedes an older pending proposal", async () => {
  const conversation = await source(
    "src/components/communication/assistant-conversation.tsx",
  );
  const send = between(
    conversation,
    "async function send(",
    "function submit(",
  );
  const cancelOld = send.indexOf("if (proposal) cancelAction(proposal);");
  const providerCall = send.indexOf("sendAssistantTurn(");
  assert.ok(cancelOld >= 0);
  assert.ok(providerCall > cancelOld);
  assert.match(
    send.slice(providerCall),
    /if \(exchange\.proposedAction\)[\s\S]*next\[prior\.idempotencyKey\] = \{ status: "cancelled" \}/,
  );
});

test("quick replies are one-time choices on only the latest persisted turn", async () => {
  const conversation = await source(
    "src/components/communication/assistant-conversation.tsx",
  );
  assert.match(
    conversation,
    /type AssistantTurnMetadata = \{[\s\S]*quickReplies: SystemAssistantQuickReply\[\]/,
  );
  const rendering = between(
    conversation,
    "{turnMetadata.quickReplies",
    "{turnMetadata.proposedAction",
  );
  assert.match(rendering, /turn\.id === latestTurnId/);
  assert.match(rendering, /turn\.id !== hiddenQuickRepliesForTurnId/);
  assert.match(rendering, /turnMetadata\.quickReplies\.map/);
  assert.match(rendering, /onClick=\{\(\) => void send\(reply\.message\)\}/);
  assert.match(rendering, /disabled=\{Boolean\(pending\) \|\| applying\}/);
  assert.match(
    conversation,
    /className="communication-assistant-quick-replies"/,
  );
});

test("persisted proposals are restored stale and only a live reply can be applied", async () => {
  const conversation = await source(
    "src/components/communication/assistant-conversation.tsx",
  );
  assert.match(conversation, /loadAssistantTurns\(conversation\.id\)/);
  assert.match(conversation, /loadedProposals\.map/);
  assert.match(conversation, /status: "stale" as const/);
  assert.match(conversation, /setLiveProposalKey\(null\)/);
  assert.match(conversation, /idempotencyKey !==[\s\S]*liveProposalKey/);
  assert.match(
    conversation,
    /Подготовьте это предложение заново перед применением/,
  );
  assert.doesNotMatch(conversation, /pageContextKey|proposalContextKeysRef/);
});

test("Course workspace reloads and opens, refreshes, or leaves a deleted Lesson after assistant apply", async () => {
  const workspace = await source(
    "src/components/course-builder/course-workspace.tsx",
  );
  const callback = between(
    workspace,
    "const handleAssistantActionApplied",
    "useSystemAssistantPageContext(",
  );
  const reload = callback.indexOf("const workspace = await reload()");
  const deleteBranch = callback.indexOf('result.type === "lesson.delete"');
  const openLesson = callback.indexOf("openCourseWorkspaceLesson(");
  assert.ok(reload >= 0);
  assert.ok(deleteBranch > reload);
  assert.ok(openLesson > deleteBranch);
  assert.match(callback, /returnToCourseWorkspace\(current\)/);
  assert.match(callback, /result\.lessonId/);
  assert.match(callback, /window\.history\.replaceState/);
  const registration = workspace.slice(
    workspace.indexOf("useSystemAssistantPageContext("),
    workspace.indexOf(
      "if (!course)",
      workspace.indexOf("useSystemAssistantPageContext("),
    ),
  );
  assert.match(
    registration,
    /surface:\s*selectedLesson \? "lesson" : "course"/,
  );
  assert.match(registration, /lessonId:\s*selectedLesson\?\.id \?\? null/);
  assert.match(registration, /onActionApplied:\s*handleAssistantActionApplied/);
});
