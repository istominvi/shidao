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

test("AI and system bodies render a safe Markdown subset while human text stays literal", async () => {
  const [markdown, assistant, system, human, css, packageJson] =
    await Promise.all([
      source("src/components/communication/communication-markdown.tsx"),
      source("src/components/communication/assistant-conversation.tsx"),
      source("src/components/communication/system-conversation.tsx"),
      source("src/components/communication/human-conversation.tsx"),
      source("src/app/styles/communication-center.css"),
      source("package.json"),
    ]);

  assert.match(packageJson, /"react-markdown": "\^10\.1\.0"/);
  assert.match(markdown, /dynamic\(\(\) => import\("react-markdown"\)/);
  assert.match(markdown, /allowedElements=\{ALLOWED_ELEMENTS\}/);
  assert.match(markdown, /skipHtml/);
  assert.match(markdown, /unwrapDisallowed/);
  assert.match(markdown, /memo\(CommunicationMarkdownComponent\)/);
  assert.doesNotMatch(
    markdown,
    /dangerouslySetInnerHTML|rehype-raw|remark-gfm/,
  );
  assert.doesNotMatch(markdown, /^\s*"(?:a|img)",?\s*$/m);

  assert.match(
    assistant,
    /turn\.role === "assistant" \? \([\s\S]*?<CommunicationMarkdown body=\{turn\.body\} \/>/,
  );
  assert.match(assistant, /onAnnouncement\("Ответ ИИ получен\."\)/);
  assert.match(
    system,
    /<CommunicationMarkdown body=\{notification\.body\} \/>/,
  );
  assert.doesNotMatch(human, /CommunicationMarkdown/);

  assert.match(
    css,
    /\.communication-markdown\s*\{[\s\S]*?white-space: normal;/,
  );
  assert.match(css, /\.communication-markdown ul\s*\{\s*list-style: disc;/);
  assert.match(css, /\.communication-markdown ol\s*\{\s*list-style: decimal;/);
  assert.match(
    css,
    /\.communication-markdown pre\s*\{[\s\S]*?overflow-x: auto;/,
  );
  assert.match(css, /\.communication-system-card header > strong/);
  assert.doesNotMatch(css, /\.communication-system-card strong\s*\{/);
});

test("communication center keeps one narrow flow, quiet initial focus and canonical retry controls", async () => {
  const [
    center,
    provider,
    inbox,
    newConversation,
    system,
    assistant,
    presenters,
    css,
  ] = await Promise.all([
    source("src/components/communication/communication-center.tsx"),
    source("src/components/communication/communication-center-provider.tsx"),
    source("src/components/communication/communication-inbox.tsx"),
    source("src/components/communication/new-conversation-view.tsx"),
    source("src/components/communication/system-conversation.tsx"),
    source("src/components/communication/assistant-conversation.tsx"),
    source("src/components/communication/communication-presenters.tsx"),
    source("src/app/styles/communication-center.css"),
  ]);

  assert.doesNotMatch(center, /\bExpand\b|Minimize2|twoColumn|toggleExpanded/);
  assert.doesNotMatch(provider, /\bexpanded\b|toggleExpanded/);
  assert.doesNotMatch(css, /is-expanded|communication-center-expand-button/);
  assert.match(
    center,
    /\{view\.type === "inbox" \? inboxColumn : detailColumn\}/,
  );
  assert.match(center, /panel\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(center, /Все диалоги в одном месте/);
  assert.doesNotMatch(inbox, /data-communication-initial-focus/);
  assert.doesNotMatch(newConversation, /data-communication-initial-focus/);

  for (const communicationSource of [
    center,
    assistant,
    presenters,
    newConversation,
  ]) {
    assert.doesNotMatch(communicationSource, /ShiDao ИИ/);
  }

  for (const retrySource of [center, inbox, newConversation, system]) {
    assert.match(
      retrySource,
      /<Button[\s\S]*?variant="secondary"[\s\S]*?>[\s\S]*?Повторить[\s\S]*?<\/Button>/,
    );
  }
  assert.doesNotMatch(css, /\.communication-error button/);
  assert.match(css, /\.communication-center-header,[\s\S]*?min-height: 4rem;/);
  assert.match(
    css,
    /\.communication-center-icon-button\s*\{[\s\S]*?color: #141414;/,
  );
  assert.match(css, /\.communication-center-panel:focus\s*\{\s*outline: none;/);

  assert.match(presenters, /communication-system-mark">S<\/span>/);
  assert.match(
    css,
    /\.communication-avatar\.is-assistant\s*\{\s*background: #141414;\s*color: #fff;/,
  );
  assert.match(
    css,
    /\.communication-avatar\.is-system\s*\{\s*background: #141414;\s*color: #fff;/,
  );
  assert.match(center, /aria-label="О ленте ShiDao"/);
  assert.match(center, /aria-expanded=\{open\}/);
  assert.match(center, /aria-controls=\{SYSTEM_CHANNEL_NOTE_ID\}/);
  assert.match(center, /role="note"/);
  assert.match(center, /event\.key !== "Escape" \|\| !open/);
  assert.doesNotMatch(
    system,
    /Здесь ShiDao сообщает только о подтверждённых событиях и результатах/,
  );
  assert.doesNotMatch(assistant, /Контекст закреплён|разрешённый контекст/);
  assert.doesNotMatch(assistant, /<Sparkles/);
  assert.doesNotMatch(css, /communication-context-chip/);
  assert.match(assistant, /Что может делать ИИ/);
  assert.match(assistant, /Создай новый курс/);
  assert.doesNotMatch(assistant, /Создай черновик нового курса/);
  for (const prompt of [
    "Сравни мои курсы",
    "Кто учится на курсе?",
    "Кому нужно повторение?",
    "Что увидит ученик?",
    "Перенеси этот урок",
  ]) {
    assert.match(assistant, new RegExp(prompt.replace("?", "\\?")));
  }
  assert.match(
    css,
    /\.communication-assistant-conversation\s*\{\s*grid-template-rows: minmax\(0, 1fr\) auto;/,
  );
  assert.match(
    css,
    /\.communication-system-conversation\s*\{\s*grid-template-rows: minmax\(0, 1fr\) auto auto;/,
  );
  assert.match(
    css,
    /\.communication-assistant-empty button\s*\{[\s\S]*?font-size: var\(--course-demo-control-font-size, 0\.88rem\);[\s\S]*?font-weight: var\(--course-demo-control-font-weight, 400\);/,
  );

  assert.match(
    css,
    /\.communication-center-panel\s*\{[\s\S]*?border: 0;[\s\S]*?background: #fff;/,
  );
  assert.match(
    css,
    /\.communication-message-bubble\s*\{[\s\S]*?border-bottom-left-radius: 1px;/,
  );
  assert.match(
    css,
    /\.communication-message\.is-own \.communication-message-bubble\s*\{[\s\S]*?border-bottom-right-radius: 1px;[\s\S]*?border-bottom-left-radius: 0\.95rem;/,
  );
  assert.match(
    assistant,
    /communication-message-meta communication-message-time/,
  );
  assert.match(
    await source("src/components/communication/human-conversation.tsx"),
    /communication-message-meta communication-message-time/,
  );
  assert.match(
    css,
    /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.communication-message-time\s*\{[\s\S]*?opacity: 0;[\s\S]*?transition: opacity 250ms ease;/,
  );
  assert.match(
    css,
    /\.communication-message-bubble:hover ~ \.communication-message-time,[\s\S]*?opacity: 1;/,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.communication-message-time,[\s\S]*?transition: none;/,
  );
  assert.match(
    css,
    /\.communication-composer-footer\s*\{[\s\S]*?border-top: 1px solid #ececef;[\s\S]*?padding: 0\.75rem 0\.7rem 0\.7rem;/,
  );
  assert.match(assistant, /role="progressbar"/);
  assert.match(assistant, /const quotaRequestRef = useRef\(0\)/);
  assert.match(
    assistant,
    /quotaRequest === quotaRequestRef\.current[\s\S]*?setQuota\(nextQuota\)/,
  );
  assert.match(assistant, /aria-label="Месячный запас ИИ"/);
  assert.match(assistant, /aria-valuemax=\{quota\.limitTokens\}/);
  assert.match(assistant, /aria-valuenow=\{quota\.remainingTokens\}/);
  assert.doesNotMatch(assistant, /toLocaleString\("ru-RU"\).*токенов/);
  assert.match(
    css,
    /\.communication-assistant-quota\s*\{[\s\S]*?height: 4px;[\s\S]*?background: #ececef;/,
  );
  assert.match(
    css,
    /\.communication-assistant-quota > span\s*\{[\s\S]*?background: #15803d;/,
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
  assert.match(client, /quota: AssistantMonthlyQuota/);
  assert.match(client, /\/api\/v2\/assistant\/quota/);
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
