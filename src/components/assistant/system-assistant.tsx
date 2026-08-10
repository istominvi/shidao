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
} from "@/components/assistant/system-assistant-client";
import { useSystemAssistant } from "@/components/assistant/system-assistant-provider";
import type {
  SystemAssistantActionProposal,
  SystemAssistantActionResult,
  SystemAssistantPageContext,
} from "@/modules/ai/system-assistant-contracts";
import type {
  AiAssistantMessage,
  AiProviderUsage,
} from "@/modules/ai/course-builder-contracts";

const PANEL_ID = "system-assistant-panel";
const TRANSCRIPT_LIMIT = 32;

type TranscriptMessage = AiAssistantMessage & {
  id: string;
  proposal?: SystemAssistantActionProposal;
};

type ActionState =
  | { status: "applying" }
  | { status: "cancelled" }
  | { status: "failed"; message: string }
  | { status: "applied"; result: SystemAssistantActionResult };

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
    return ["Что важно в этом уроке?", "Добавь следующий урок в этот курс"];
  }
  if (surface === "course" || surface === "student_preview") {
    return ["Проверь структуру курса", "Добавь новый урок"];
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
  return proposal.action.type === "course.create_draft"
    ? "Создать курс"
    : "Добавить урок";
}

function verifiedMessage(result: SystemAssistantActionResult) {
  return result.type === "course.create_draft"
    ? `Готово: курс «${result.courseTitle}» создан.`
    : `Готово: урок «${result.lessonTitle}» добавлен в курс «${result.courseTitle}».`;
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
      ) : (
        <dl>
          <div>
            <dt>Курс</dt>
            <dd>{action.courseTitle}</dd>
          </div>
          <div>
            <dt>Урок</dt>
            <dd>{action.input.title}</dd>
          </div>
          {action.input.summary ? (
            <div>
              <dt>Комментарий</dt>
              <dd>{action.input.summary}</dd>
            </div>
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
      ) : (
        <div className="system-assistant-action-buttons">
          <button
            type="button"
            className="system-assistant-secondary-button"
            disabled={busy}
            onClick={onCancel}
          >
            Не сейчас
          </button>
          <button
            type="button"
            className="system-assistant-primary-button"
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
  const actionApplying = Object.values(actionStates).some(
    (state) => state.status === "applying",
  );

  useEffect(() => setMounted(true), []);

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

  async function send(content: string) {
    const normalized = content.trim();
    if (!normalized || sending) return;
    const userMessage: TranscriptMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: normalized,
    };
    const nextMessages = [...messages, userMessage].slice(-15);
    shouldAutoScrollRef.current = true;
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setError(null);
    try {
      const reply = await sendSystemAssistantMessage(
        pageRequestContext(page),
        nextMessages.map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        })),
      );
      const assistantMessage: TranscriptMessage = {
        id: crypto.randomUUID(),
        ...reply.message,
        ...(reply.proposedAction ? { proposal: reply.proposedAction } : {}),
      };
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
      setActionStates((current) => ({
        ...current,
        [key]: { status: "failed", message },
      }));
    }
  }

  function resetDialog() {
    shouldAutoScrollRef.current = true;
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
                ответить на вопрос или подготовить создание курса и пустого
                урока с отдельным подтверждением.
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
                {message.proposal ? (
                  <AssistantActionCard
                    proposal={message.proposal}
                    state={actionStates[message.proposal.idempotencyKey]}
                    busy={actionApplying}
                    onApply={() => void applyAction(message.proposal!)}
                    onCancel={() =>
                      setActionStates((current) => ({
                        ...current,
                        [message.proposal!.idempotencyKey]: {
                          status: "cancelled",
                        },
                      }))
                    }
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
              disabled={sending}
              placeholder="Спросите или попросите создать…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <button
              type="submit"
              aria-label="Отправить"
              disabled={sending || !draft.trim()}
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
