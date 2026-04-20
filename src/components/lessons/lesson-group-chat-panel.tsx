"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";
import type { LessonGroupChatReadModel } from "@/lib/server/lesson-group-chat-service";

type LessonGroupChatPanelProps = {
  scheduledLessonId: string;
  initialModel?: LessonGroupChatReadModel | null;
  canWrite?: boolean;
};

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LessonGroupChatPanel({
  scheduledLessonId,
  initialModel,
  canWrite,
}: LessonGroupChatPanelProps) {
  const [model, setModel] = useState<LessonGroupChatReadModel | null>(initialModel ?? null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const resolvedCanWrite = canWrite ?? model?.canWrite ?? false;

  const refreshMessages = useCallback(async () => {
    const response = await fetch(`/api/lessons/${scheduledLessonId}/group-chat`, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Не удалось загрузить чат урока.");
    }
    const data = (await response.json()) as LessonGroupChatReadModel;
    setModel(data);
    setError(null);
  }, [scheduledLessonId]);

  useEffect(() => {
    setModel(initialModel ?? null);
  }, [initialModel]);

  useEffect(() => {
    void refreshMessages().catch((apiError) => {
      setError(apiError instanceof Error ? apiError.message : "Не удалось загрузить чат урока.");
    });
    const timer = window.setInterval(() => {
      void refreshMessages().catch((apiError) => {
        setError(apiError instanceof Error ? apiError.message : "Не удалось загрузить чат урока.");
      });
    }, 2800);

    return () => window.clearInterval(timer);
  }, [refreshMessages]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [model?.messages]);

  const onSend = async () => {
    if (!resolvedCanWrite || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/lessons/${scheduledLessonId}/group-chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      const data = (await response.json().catch(() => ({}))) as
        | LessonGroupChatReadModel
        | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Не удалось отправить сообщение.");
      }

      setModel(data as LessonGroupChatReadModel);
      setBody("");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Не удалось отправить сообщение.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={viewportRef}
        className="max-h-[24rem] space-y-2 overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
      >
        {!model || model.messages.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Пока нет сообщений. Напишите первое сообщение для группы.
          </p>
        ) : (
          model.messages.map((message) => (
            <article
              key={message.id}
              className={classNames(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                message.isOwn
                  ? "ml-auto border border-sky-200 bg-sky-50 text-sky-950"
                  : "mr-auto border border-neutral-200 bg-white text-neutral-900",
              )}
            >
              <p className="text-xs font-semibold text-neutral-700">
                @{message.authorLogin} — {message.authorName}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
              <p className="mt-1 text-right text-[11px] text-neutral-500">
                {formatMessageTime(message.createdAt)}
              </p>
            </article>
          ))
        )}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      {resolvedCanWrite ? (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            placeholder="Сообщение в общий чат урока"
            maxLength={2000}
          />
          <button
            type="button"
            className={productButtonClassName("secondary", "text-sm")}
            onClick={() => void onSend()}
            disabled={pending}
          >
            Отправить
          </button>
        </div>
      ) : (
        <p className="text-xs text-neutral-600">
          Родительский просмотр: писать в чат может преподаватель и ученики группы.
        </p>
      )}
    </div>
  );
}
