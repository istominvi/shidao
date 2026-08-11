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
      input: {
        title: "4 урок",
        summary: "",
      },
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

test("assistant renders every action kind and warns before destructive lesson deletion", async () => {
  const assistant = await source(
    "src/components/assistant/system-assistant.tsx",
  );
  const titles = between(
    assistant,
    "function actionTitle(",
    "function verifiedMessage(",
  );

  for (const actionType of [
    "course.create_draft",
    "course.add_lesson",
    "course.add_lesson_with_plan",
    "lesson.fill",
    "lesson.delete",
  ]) {
    assert.match(titles, new RegExp(`case [\"']${actionType}[\"']:`));
  }

  const card = between(
    assistant,
    "function AssistantActionCard(",
    "export function SystemAssistant()",
  );
  assert.match(card, /action\.type === "course\.add_lesson_with_plan"/);
  assert.match(card, /action\.type === "lesson\.fill"/);
  assert.match(card, /action\.input\.plan\.components\.map/);
  assert.match(card, /action\.type === "lesson\.delete"/);
  assert.match(card, /Будет удалён урок/);
  assert.match(
    card,
    /Завершённые индивидуальные результаты учеников сохранятся/,
  );
  assert.match(card, /system-assistant-danger-button/);
});

test("exact confirmation or cancellation targets only the latest pending proposal without a provider call", async () => {
  const assistant = await source(
    "src/components/assistant/system-assistant.tsx",
  );
  const confirmation = between(
    assistant,
    "const CONFIRM_WORDS",
    "function localDate(",
  );
  assert.match(confirmation, /[\"']да[\"']/);
  assert.match(confirmation, /[\"']нет[\"']/);
  assert.match(confirmation, /CONFIRM_WORDS\.has\(normalized\)/);
  assert.match(confirmation, /CANCEL_WORDS\.has\(normalized\)/);
  assert.doesNotMatch(confirmation, /includes\(normalized\)/);
  assert.match(
    confirmation,
    /for \(let index = messages\.length - 1; index >= 0; index -= 1\)/,
  );
  assert.match(confirmation, /if \(!proposal\) continue/);
  assert.match(confirmation, /return proposal/);

  const send = between(assistant, "async function send(", "function submit(");
  const intentBranch = send.indexOf("if (pendingProposal && intent)");
  const providerCall = send.indexOf("sendSystemAssistantMessage(");
  assert.ok(intentBranch >= 0);
  assert.ok(providerCall > intentBranch);
  const beforeProvider = send.slice(intentBranch, providerCall);
  assert.match(beforeProvider, /intent === "confirm"/);
  assert.match(beforeProvider, /applyAction\(pendingProposal\)/);
  assert.match(beforeProvider, /cancelAction\(pendingProposal\)/);
  assert.match(beforeProvider, /return;/);
});

test("a new user request supersedes an older pending proposal", async () => {
  const assistant = await source(
    "src/components/assistant/system-assistant.tsx",
  );
  const send = between(assistant, "async function send(", "function submit(");
  const cancelOld = send.indexOf(
    "if (pendingProposal) cancelAction(pendingProposal, false);",
  );
  const providerCall = send.indexOf("sendSystemAssistantMessage(");
  assert.ok(cancelOld >= 0);
  assert.ok(providerCall > cancelOld);
  assert.match(
    send.slice(providerCall),
    /if \(reply\.proposedAction\)[\s\S]*next\[key\] = \{ status: "cancelled" \}/,
  );
});

test("quick replies are one-time choices on only the latest turn and send their structured message", async () => {
  const assistant = await source(
    "src/components/assistant/system-assistant.tsx",
  );

  assert.match(
    assistant,
    /type TranscriptMessage = AiAssistantMessage & \{[\s\S]*quickReplies\?: SystemAssistantQuickReply\[\]/,
  );
  assert.match(assistant, /const latestMessageId = messages\.at\(-1\)\?\.id/);
  const replyRendering = between(
    assistant,
    "{message.quickReplies",
    "{message.proposal",
  );
  assert.match(replyRendering, /message\.id === latestMessageId/);
  assert.match(replyRendering, /message\.quickReplies\.map/);
  assert.match(replyRendering, /quickReply\.label/);
  assert.match(
    replyRendering,
    /onClick=\{\(\) => void send\(quickReply\.message\)\}/,
  );
  assert.match(replyRendering, /disabled=\{sending \|\| actionApplying\}/);

  const send = between(assistant, "async function send(", "function submit(");
  assert.match(send, /quickReplies: reply\.quickReplies/);
  assert.match(send, /sendingRef\.current/);
});

test("changing Course or Lesson context invalidates pending proposals", async () => {
  const assistant = await source(
    "src/components/assistant/system-assistant.tsx",
  );
  const contextLifecycle = between(
    assistant,
    "const pageContextKey =",
    "useEffect(() => {\n    if (!open) return;",
  );
  assert.match(
    contextLifecycle,
    /page\.surface.*page\.view.*page\.courseId.*page\.lessonId/,
  );
  assert.match(contextLifecycle, /previousPageContextKeyRef\.current/);
  assert.match(contextLifecycle, /next\[key\] = \{ status: "cancelled" \}/);
  assert.match(
    contextLifecycle,
    /Открытая страница изменилась\. Неподтверждённое действие отменено/,
  );
  assert.match(contextLifecycle, /delete next\.quickReplies;/);
  assert.match(contextLifecycle, /delete next\.quickRepliesContextKey;/);

  const send = between(assistant, "async function send(", "function submit(");
  assert.match(send, /requestPageContextKey = pageContextKey/);
  assert.match(send, /pageContextKeyRef\.current !== requestPageContextKey/);
  assert.match(send, /старое предложение не показано/);
  assert.match(
    assistant,
    /proposalContextKeysRef\.current\[reply\.proposedAction\.idempotencyKey\]/,
  );
  assert.match(
    assistant,
    /proposalContextKeysRef\.current\[key\] !== pageContextKeyRef\.current/,
  );
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
