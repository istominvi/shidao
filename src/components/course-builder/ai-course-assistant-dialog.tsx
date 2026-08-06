"use client";

import { useRef, useState, type FormEvent } from "react";
import { Bot, LoaderCircle, Send, Sparkles, UserRound } from "lucide-react";
import { sendCourseAssistantMessage } from "@/components/course-builder/course-builder-client";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type {
  AiAssistantMessage,
  AiProviderUsage,
} from "@/modules/ai/course-builder-contracts";

const QUICK_PROMPTS = [
  "Проверь логику программы курса",
  "Предложи идеи для следующего урока",
  "Как сделать материал понятнее ученику?",
] as const;

export function AiCourseAssistantDialog({
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  onClose,
}: {
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle?: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<AiAssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<AiProviderUsage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function send(content: string) {
    const normalized = content.trim();
    if (!normalized || sending) return;
    const nextMessages = [
      ...messages,
      { role: "user" as const, content: normalized },
    ].slice(-15);
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setError(null);
    try {
      const reply = await sendCourseAssistantMessage(
        courseId,
        lessonId,
        nextMessages,
      );
      setMessages((current) => [...current, reply.message].slice(-16));
      setLastUsage(reply.usage);
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

  return (
    <DialogShell
      title="ИИ-ассистент преподавателя"
      description={
        lessonTitle
          ? `Контекст: «${courseTitle}» → «${lessonTitle}»`
          : `Контекст курса: «${courseTitle}»`
      }
      onClose={() => {
        if (!sending) onClose();
      }}
      panelClassName="max-w-3xl"
    >
      <div className="grid gap-4">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
          Ассистент видит сохранённую структуру курса и выбранного урока. Он
          консультирует, но не меняет данные из чата. Содержимое прикреплённых
          файлов пока ему недоступно.
        </div>

        {messages.length === 0 ? (
          <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2 font-bold text-neutral-900">
              <Sparkles
                className="h-4 w-4 text-violet-600"
                aria-hidden="true"
              />
              С чего начать
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-700 transition hover:border-neutral-400 disabled:opacity-50"
                  onClick={() => void send(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol
            className="max-h-[48vh] space-y-3 overflow-y-auto pr-1"
            aria-live="polite"
          >
            {messages.map((message, index) => {
              const assistant = message.role === "assistant";
              const Icon = assistant ? Bot : UserRound;
              return (
                <li
                  key={`${message.role}-${index}`}
                  className={`flex gap-3 rounded-2xl border p-4 ${
                    assistant
                      ? "border-violet-200 bg-violet-50/70"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                      assistant
                        ? "bg-violet-600 text-white"
                        : "bg-neutral-900 text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                    {message.content}
                  </p>
                </li>
              );
            })}
            {sending ? (
              <li className="flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-900">
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Ассистент думает…
              </li>
            ) : null}
          </ol>
        )}

        {error ? (
          <p
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form className="grid gap-3" onSubmit={submit}>
          <label className="sr-only" htmlFor="course-ai-assistant-message">
            Сообщение ассистенту
          </label>
          <textarea
            ref={textareaRef}
            id="course-ai-assistant-message"
            autoFocus
            required
            maxLength={6000}
            className="field-input min-h-24 resize-y"
            placeholder="Спросите о программе, уроке или методике…"
            value={draft}
            disabled={sending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              void send(draft);
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              Enter — отправить · Shift+Enter — новая строка
              {lastUsage
                ? ` · последний ответ: ${lastUsage.totalTokens.toLocaleString("ru-RU")} токенов`
                : ""}
            </p>
            <Button type="submit" disabled={sending || !draft.trim()}>
              {sending ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Отправить
            </Button>
          </div>
        </form>
      </div>
    </DialogShell>
  );
}
