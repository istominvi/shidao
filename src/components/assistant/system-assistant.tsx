"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type UIEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import {
  applySystemAssistantAction,
  sendSystemAssistantMessage,
  SystemAssistantClientError,
} from "@/components/assistant/system-assistant-client";
import { useSystemAssistant } from "@/components/assistant/system-assistant-provider";
import type {
  SystemAssistantActionProposal,
  SystemAssistantActionResult,
  SystemAssistantPageContext,
  SystemAssistantQuickReply,
} from "@/modules/ai/system-assistant-contracts";
import type {
  AiAssistantMessage,
  AiLessonComponentPlan,
  AiProviderUsage,
} from "@/modules/ai/course-builder-contracts";

const PANEL_ID = "system-assistant-panel";
const TRANSCRIPT_LIMIT = 32;

type TranscriptMessage = AiAssistantMessage & {
  id: string;
  proposal?: SystemAssistantActionProposal;
  quickReplies?: SystemAssistantQuickReply[];
  quickRepliesContextKey?: string;
};

type ActionState =
  | { status: "applying" }
  | { status: "cancelled" }
  | { status: "stale"; message: string }
  | { status: "failed"; message: string }
  | { status: "applied"; result: SystemAssistantActionResult };

const CONFIRM_WORDS = new Set([
  "да",
  "верно",
  "всё верно",
  "подтверждаю",
  "подтверждаю действие",
  "согласен",
  "согласна",
  "выполняй",
  "применяй",
  "да, выполняй",
  "да, применяй",
  "да, подтверждаю",
  "да, всё верно",
]);
const CANCEL_WORDS = new Set([
  "нет",
  "нет, отмени",
  "отмена",
  "отмени",
  "не надо",
  "не нужно",
]);

function confirmationIntent(value: string) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/[.!?]+$/u, "")
    .trim();
  if (CONFIRM_WORDS.has(normalized)) return "confirm" as const;
  if (CANCEL_WORDS.has(normalized)) return "cancel" as const;
  return null;
}

function latestPendingProposal(
  messages: TranscriptMessage[],
  actionStates: Record<string, ActionState>,
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const proposal = messages[index]?.proposal;
    if (!proposal) continue;
    const state = actionStates[proposal.idempotencyKey];
    if (!state || state.status === "failed") return proposal;
  }
  return null;
}

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pageRequestContext(
  page: ReturnType<typeof useSystemAssistant>["page"],
): SystemAssistantPageContext {
  return {
    surface: page.surface,
    view: page.view ?? null,
    courseId: page.courseId,
    lessonId: page.lessonId,
    localDate: page.localDate ?? localDate(),
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  };
}

function quickPrompts(
  surface: SystemAssistantPageContext["surface"],
  view: SystemAssistantPageContext["view"],
) {
  if (surface === "lesson") {
    return ["Что важно в этом уроке?", "Заполни этот урок содержанием"];
  }
  if (surface === "course" || surface === "student_preview") {
    return ["Проверь структуру курса", "Помоги создать следующий урок"];
  }
  if (surface === "schedule") {
    return ["Что у меня в выбранный день?", "Какие курсы требуют внимания?"];
  }
  if (surface === "students") {
    if (view === "students_observing") {
      return [
        "Какие данные доступны ассистенту здесь?",
        "Расскажи о моих курсах",
      ];
    }
    return ["Сколько у меня учеников?", "Расскажи о моих группах"];
  }
  return ["Расскажи о моих курсах", "Создай черновик нового курса"];
}

function actionTitle(proposal: SystemAssistantActionProposal) {
  switch (proposal.action.type) {
    case "course.create_draft":
      return "Создать курс";
    case "course.add_lesson":
      return "Добавить пустой урок";
    case "course.add_lesson_with_plan":
      return "Создать наполненный урок";
    case "lesson.fill":
      return "Дополнить урок";
    case "lesson.delete":
      return "Удалить урок";
  }
}

function verifiedMessage(result: SystemAssistantActionResult) {
  switch (result.type) {
    case "course.create_draft":
      return `Готово: курс «${result.courseTitle}» создан.`;
    case "course.add_lesson":
    case "course.add_lesson_with_plan":
      return `Готово: урок «${result.lessonTitle}» добавлен в курс «${result.courseTitle}».`;
    case "lesson.fill":
      return `Готово: в урок «${result.lessonTitle}» добавлено ${result.componentIds.length} блоков.`;
    case "lesson.delete":
      return `Готово: урок «${result.lessonTitle}» удалён из курса «${result.courseTitle}».`;
  }
}

function lessonComponentPreview(component: AiLessonComponentPlan) {
  switch (component.typeKey) {
    case "heading":
      return { label: "Заголовок", content: component.payload.text };
    case "rich_text":
      return {
        label: "Текст",
        content: component.payload.title
          ? `${component.payload.title}: ${component.payload.content}`
          : component.payload.content,
      };
    case "callout":
      return {
        label: "Акцент",
        content: component.payload.title
          ? `${component.payload.title}: ${component.payload.text}`
          : component.payload.text,
      };
    case "single_choice_poll":
      return {
        label: "Опрос",
        content: `${component.payload.question} — ${component.payload.options
          .map((option) => option.label)
          .join(" / ")}`,
      };
    case "matching_game":
      return {
        label: "Сопоставление",
        content: `${component.payload.instruction} — ${component.payload.pairs
          .map((pair) => `${pair.left} ↔ ${pair.right}`)
          .join("; ")}`,
      };
  }
}

function AssistantActionCard({
  proposal,
  state,
  busy,
  onApply,
  onCancel,
}: {
  proposal: SystemAssistantActionProposal;
  state: ActionState | undefined;
  busy: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const action = proposal.action;
  const pending = !state || state.status === "failed";
  return (
    <article className="system-assistant-action-card">
      <div className="system-assistant-action-title">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <strong>Предлагаемое действие</strong>
      </div>
      {action.type === "course.create_draft" ? (
        <dl>
          <div>
            <dt>Курс</dt>
            <dd>{action.input.title}</dd>
          </div>
          <div>
            <dt>Предмет и уровень</dt>
            <dd>
              {action.input.subject} · {action.input.level}
            </dd>
          </div>
          <div>
            <dt>Цель</dt>
            <dd>{action.input.goal}</dd>
          </div>
          <div>
            <dt>Уроков</dt>
            <dd>{action.input.targetLessonCount}</dd>
          </div>
          {action.input.audienceDescription ? (
            <div>
              <dt>Аудитория</dt>
              <dd>{action.input.audienceDescription}</dd>
            </div>
          ) : null}
          {action.input.teacherPreferences ? (
            <div>
              <dt>Пожелания</dt>
              <dd>{action.input.teacherPreferences}</dd>
            </div>
          ) : null}
        </dl>
      ) : action.type === "lesson.delete" ? (
        <>
          <dl>
            <div>
              <dt>Курс</dt>
              <dd>{action.courseTitle}</dd>
            </div>
            <div>
              <dt>Будет удалён урок</dt>
              <dd>{action.lessonTitle}</dd>
            </div>
          </dl>
          <p className="system-assistant-action-warning">
            План, назначения и история проведений урока будут удалены.
            Завершённые индивидуальные результаты учеников сохранятся.
          </p>
        </>
      ) : (
        <dl>
          <div>
            <dt>Курс</dt>
            <dd>{action.courseTitle}</dd>
          </div>
          <div>
            <dt>Урок</dt>
            <dd>
              {action.type === "lesson.fill"
                ? action.lessonTitle
                : action.input.title}
            </dd>
          </div>
          {action.type === "course.add_lesson" && action.input.summary ? (
            <div>
              <dt>Комментарий</dt>
              <dd>{action.input.summary}</dd>
            </div>
          ) : null}
          {action.type === "course.add_lesson_with_plan" ||
          action.type === "lesson.fill" ? (
            <>
              <div>
                <dt>
                  {action.type === "lesson.fill"
                    ? "Комментарий преподавателя"
                    : "Содержание"}
                </dt>
                <dd>
                  {action.type === "lesson.fill" ? "Заменится на: " : null}
                  {action.input.plan.summary}
                </dd>
              </div>
              <div>
                <dt>Блоки ({action.input.plan.components.length})</dt>
                <dd>
                  <ol className="system-assistant-plan-preview">
                    {action.input.plan.components.map((component, index) => {
                      const preview = lessonComponentPreview(component);
                      return (
                        <li key={`${component.typeKey}-${index}`}>
                          <strong>{preview.label}</strong>
                          <span>{preview.content}</span>
                        </li>
                      );
                    })}
                  </ol>
                </dd>
              </div>
              {action.type === "lesson.fill" ? (
                <div>
                  <dt>Существующий план</dt>
                  <dd>Сохранится; новые блоки будут добавлены в конец.</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>
      )}

      {state?.status === "applied" ? (
        <div className="system-assistant-action-result">
          <span>
            <Check className="h-4 w-4" aria-hidden="true" /> Применено
          </span>
          <a href={state.result.href}>
            Открыть <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      ) : state?.status === "cancelled" ? (
        <p className="system-assistant-action-note">Действие не применено.</p>
      ) : state?.status === "stale" ? (
        <p className="system-assistant-action-error" role="alert">
          {state.message}
        </p>
      ) : (
        <div className="system-assistant-action-buttons">
          <button
            type="button"
            className="system-assistant-secondary-button"
            disabled={busy}
            onClick={onCancel}
          >
            Отменить
          </button>
          <button
            type="button"
            className={
              action.type === "lesson.delete"
                ? "system-assistant-danger-button"
                : "system-assistant-primary-button"
            }
            disabled={!pending || busy}
            onClick={onApply}
          >
            {state?.status === "applying" ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {actionTitle(proposal)}
          </button>
        </div>
      )}
      {state?.status === "failed" ? (
        <p className="system-assistant-action-error" role="alert">
          {state.message}
        </p>
      ) : null}
    </article>
  );
}

export function SystemAssistant() {
  const { page } = useSystemAssistant();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<AiProviderUsage | null>(null);
  const [sharedHistoryUsed, setSharedHistoryUsed] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {},
  );
  const [announcement, setAnnouncement] = useState("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const sendingRef = useRef(false);
  const proposalContextKeysRef = useRef<Record<string, string>>({});
  const pageContextKey = `${page.surface}:${page.view ?? ""}:${page.courseId ?? ""}:${page.lessonId ?? ""}:${page.localDate ?? ""}`;
  const pageContextKeyRef = useRef(pageContextKey);
  pageContextKeyRef.current = pageContextKey;
  const previousPageContextKeyRef = useRef(pageContextKey);
  const actionApplying = Object.values(actionStates).some(
    (state) => state.status === "applying",
  );
  const latestMessageId = messages.at(-1)?.id;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (previousPageContextKeyRef.current === pageContextKey) return;
    previousPageContextKeyRef.current = pageContextKey;
    setMessages((current) =>
      current.map((message) => {
        if (!message.quickReplies?.length) return message;
        const next = { ...message };
        delete next.quickReplies;
        delete next.quickRepliesContextKey;
        return next;
      }),
    );
    const pendingKeys = messages.flatMap((message) => {
      const key = message.proposal?.idempotencyKey;
      if (!key) return [];
      const state = actionStates[key];
      return !state || state.status === "failed" ? [key] : [];
    });
    if (pendingKeys.length === 0) return;
    setActionStates((current) => {
      const next = { ...current };
      for (const key of pendingKeys) {
        next[key] = { status: "cancelled" };
      }
      return next;
    });
    setAnnouncement(
      "Открытая страница изменилась. Неподтверждённое действие отменено.",
    );
  }, [actionStates, messages, pageContextKey]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      textareaRef.current?.focus(),
    );
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        return;
      }
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => launcherRef.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !shouldAutoScrollRef.current) return;
    transcriptEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open, sending]);

  function handleTranscriptScroll(event: UIEvent<HTMLDivElement>) {
    const transcript = event.currentTarget;
    shouldAutoScrollRef.current =
      transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight <
      48;
  }

  function close() {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function cancelAction(
    proposal: SystemAssistantActionProposal,
    appendReply = true,
  ) {
    setActionStates((current) => ({
      ...current,
      [proposal.idempotencyKey]: { status: "cancelled" },
    }));
    if (appendReply) {
      const content =
        "Понял, это действие отменено. Что именно нужно изменить в предложении?";
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content },
      ]);
      setAnnouncement(content);
    }
  }

  async function send(content: string) {
    const normalized = content.trim();
    if (!normalized || sendingRef.current || actionApplying) return;
    const userMessage: TranscriptMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: normalized,
    };
    const pendingProposal = latestPendingProposal(messages, actionStates);
    const intent = pendingProposal ? confirmationIntent(normalized) : null;
    if (pendingProposal && intent) {
      shouldAutoScrollRef.current = true;
      setMessages((current) =>
        [...current, userMessage].slice(-TRANSCRIPT_LIMIT),
      );
      setDraft("");
      setError(null);
      if (intent === "confirm") {
        void applyAction(pendingProposal);
      } else {
        cancelAction(pendingProposal);
      }
      return;
    }
    if (pendingProposal) cancelAction(pendingProposal, false);
    const nextMessages = [...messages, userMessage].slice(-15);
    const requestPageContextKey = pageContextKey;
    const requestPage = pageRequestContext(page);
    shouldAutoScrollRef.current = true;
    setMessages(nextMessages);
    setDraft("");
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const reply = await sendSystemAssistantMessage(
        requestPage,
        nextMessages.map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        })),
      );
      if (pageContextKeyRef.current !== requestPageContextKey) {
        const contextChangedMessage =
          "Открытая страница изменилась, поэтому старое предложение не показано. Повторите запрос в текущем контексте.";
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: contextChangedMessage,
          },
        ]);
        setAnnouncement(contextChangedMessage);
        return;
      }
      const assistantMessage: TranscriptMessage = {
        id: crypto.randomUUID(),
        ...reply.message,
        ...(reply.proposedAction ? { proposal: reply.proposedAction } : {}),
        quickReplies: reply.quickReplies,
        ...(reply.quickReplies?.length
          ? {
              quickRepliesContextKey: requestPageContextKey,
            }
          : {}),
      };
      if (reply.proposedAction) {
        proposalContextKeysRef.current[reply.proposedAction.idempotencyKey] =
          requestPageContextKey;
        setActionStates((current) => {
          const next = { ...current };
          for (const message of messages) {
            const key = message.proposal?.idempotencyKey;
            if (!key) continue;
            const state = current[key];
            if (!state || state.status === "failed") {
              next[key] = { status: "cancelled" };
            }
          }
          return next;
        });
      }
      setMessages((current) =>
        [...current, assistantMessage].slice(-TRANSCRIPT_LIMIT),
      );
      setLastUsage(reply.usage);
      setSharedHistoryUsed(reply.sharedHistoryUsed);
      setAnnouncement(reply.message.content);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось получить ответ ассистента.",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    void send(draft);
  }

  async function applyAction(proposal: SystemAssistantActionProposal) {
    const key = proposal.idempotencyKey;
    if (proposalContextKeysRef.current[key] !== pageContextKeyRef.current) {
      const message =
        "Открытая страница изменилась. Подготовьте действие заново в текущем контексте.";
      setActionStates((current) => ({
        ...current,
        [key]: { status: "stale", message },
      }));
      setAnnouncement(message);
      return;
    }
    shouldAutoScrollRef.current = true;
    setActionStates((current) => ({
      ...current,
      [key]: { status: "applying" },
    }));
    setError(null);
    try {
      const result = await applySystemAssistantAction(proposal);
      setActionStates((current) => ({
        ...current,
        [key]: { status: "applied", result },
      }));
      const content = verifiedMessage(result);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content },
      ]);
      setAnnouncement(content);
      try {
        await page.onActionApplied?.(result);
      } catch {
        // The write is already verified. A local page refresh failure must not
        // turn it into a false mutation failure; the result link remains valid.
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Не удалось применить действие.";
      const terminal =
        caught instanceof SystemAssistantClientError &&
        [
          "ai_action_proposal_invalid",
          "ai_action_stale",
          "ai_plan_stale",
          "ai_consent_stale",
        ].includes(caught.code ?? "");
      setActionStates((current) => ({
        ...current,
        [key]: terminal
          ? {
              status: "stale",
              message: `${message} Попросите ассистента подготовить новое предложение.`,
            }
          : { status: "failed", message },
      }));
    }
  }

  function resetDialog() {
    shouldAutoScrollRef.current = true;
    proposalContextKeysRef.current = {};
    setMessages([]);
    setActionStates({});
    setDraft("");
    setError(null);
    setLastUsage(null);
    setSharedHistoryUsed(false);
    setAnnouncement("Начат новый диалог.");
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  if (!mounted) return null;

  return createPortal(
    <div className="system-assistant-layer">
      {open ? (
        <aside
          id={PANEL_ID}
          className="system-assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${PANEL_ID}-title`}
        >
          <header className="system-assistant-header">
            <span className="system-assistant-avatar" aria-hidden="true">
              <WandSparkles className="h-5 w-5" />
            </span>
            <div>
              <strong id={`${PANEL_ID}-title`}>Shidao ИИ</strong>
              <span>Помнит диалог до перезагрузки страницы</span>
            </div>
            <button
              type="button"
              className="system-assistant-icon-button"
              aria-label="Новый диалог"
              disabled={sending || actionApplying}
              onClick={resetDialog}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="system-assistant-icon-button"
              aria-label="Закрыть ИИ-ассистента"
              onClick={close}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="system-assistant-context-chip">
            <span aria-hidden="true" />
            Контекст: {page.label}
          </div>

          <div
            className="system-assistant-transcript"
            onScroll={handleTranscriptScroll}
          >
            {messages.length === 0 ? (
              <div className="system-assistant-message is-assistant">
                Я вижу текущий раздел и разрешённые данные вашего аккаунта. Могу
                обсуждать работу с вами, создавать пустые или наполненные уроки,
                дополнять и удалять их — каждое изменение только после вашего
                подтверждения.
              </div>
            ) : null}
            {messages.map((message) => (
              <div key={message.id} className="system-assistant-turn">
                <div
                  className={`system-assistant-message ${
                    message.role === "assistant" ? "is-assistant" : "is-user"
                  }`}
                >
                  {message.content}
                </div>
                {message.quickReplies?.length &&
                message.id === latestMessageId &&
                message.quickRepliesContextKey === pageContextKey ? (
                  <div
                    className="system-assistant-quick-replies"
                    role="group"
                    aria-label="Варианты ответа"
                  >
                    {message.quickReplies.map((quickReply) => (
                      <button
                        key={`${message.id}:${quickReply.message}`}
                        type="button"
                        disabled={sending || actionApplying}
                        onClick={() => void send(quickReply.message)}
                      >
                        {quickReply.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.proposal ? (
                  <AssistantActionCard
                    proposal={message.proposal}
                    state={actionStates[message.proposal.idempotencyKey]}
                    busy={actionApplying}
                    onApply={() => void applyAction(message.proposal!)}
                    onCancel={() => cancelAction(message.proposal!)}
                  />
                ) : null}
              </div>
            ))}
            {sending ? (
              <div className="system-assistant-typing" role="status">
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Ассистент думает…
              </div>
            ) : null}
            <div ref={transcriptEndRef} />
          </div>

          {messages.length === 0 ? (
            <div
              className="system-assistant-prompts"
              aria-label="Быстрые вопросы"
            >
              {quickPrompts(page.surface, page.view ?? null).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending}
                  onClick={() => void send(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="system-assistant-error" role="alert">
              {error}
            </p>
          ) : null}

          <form className="system-assistant-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="system-assistant-message">
              Сообщение ИИ-ассистенту
            </label>
            <textarea
              ref={textareaRef}
              id="system-assistant-message"
              rows={1}
              maxLength={6_000}
              value={draft}
              disabled={sending || actionApplying}
              placeholder="Спросите или попросите изменить…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <button
              type="submit"
              aria-label="Отправить"
              disabled={sending || actionApplying || !draft.trim()}
            >
              {sending ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </form>

          <footer className="system-assistant-meta">
            <span>
              Enter — отправить · Shift+Enter — новая строка
              {lastUsage
                ? ` · ${lastUsage.totalTokens.toLocaleString("ru-RU")} токенов`
                : ""}
            </span>
            {sharedHistoryUsed ? (
              <span>Использована разрешённая обезличенная история</span>
            ) : null}
          </footer>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
        </aside>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        className={`system-assistant-launcher ${open ? "is-open" : ""}`}
        aria-label={open ? "Закрыть ИИ-ассистента" : "Открыть ИИ-ассистента"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <strong>ИИ</strong>
          </>
        )}
      </button>
    </div>,
    document.body,
  );
}
