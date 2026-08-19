"use client";

import { LoaderCircle, Send } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  CommunicationClientError,
  loadCommunicationMessages,
  markCommunicationThreadRead,
  sendCommunicationMessage,
} from "@/components/communication/communication-client";
import { fullCommunicationTime } from "@/components/communication/communication-presenters";
import { usePageVisible } from "@/components/communication/use-page-visible";
import type {
  CommunicationMessage,
  CommunicationThread,
} from "@/modules/communication/domain";
import { errorMessageFromUnknown } from "@/lib/error-message";

export type HumanThreadSummary = Pick<
  CommunicationThread,
  "id" | "kind" | "title" | "lastMessageId" | "canSend"
>;

type PendingMessage = {
  clientMessageId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
};

export function HumanConversation({
  thread,
  onActivity,
  onAnnouncement,
  onAccessRevoked,
}: {
  thread: HumanThreadSummary;
  onActivity: () => void;
  onAnnouncement: (message: string) => void;
  onAccessRevoked: (threadId: string) => void;
}) {
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pageVisible = usePageVisible();
  const latestMessageId = messages.at(-1)?.id ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);
    setNextCursor(null);
    setLoadError(null);
    setPending(null);
    void loadCommunicationMessages(thread.id)
      .then((page) => {
        if (!active) return;
        setMessages([...page.items].sort((left, right) => left.id - right.id));
        setNextCursor(page.nextCursor);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (
          caught instanceof CommunicationClientError &&
          caught.status === 404
        ) {
          onAccessRevoked(thread.id);
          return;
        }
        setLoadError(
          errorMessageFromUnknown(
            caught,
            "Не удалось загрузить сообщения диалога.",
          ),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onAccessRevoked, thread.id]);

  useEffect(() => {
    if (!loading) {
      const frame = window.requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({ block: "nearest" }),
      );
      return () => window.cancelAnimationFrame(frame);
    }
  }, [loading, messages.length]);

  useEffect(() => {
    if (!latestMessageId || !pageVisible) return;
    void markCommunicationThreadRead(thread.id, latestMessageId)
      .then(onActivity)
      .catch(() => undefined);
  }, [latestMessageId, onActivity, pageVisible, thread.id]);

  useEffect(() => {
    if (
      loading ||
      !pageVisible ||
      thread.lastMessageId === null ||
      thread.lastMessageId === latestMessageId
    ) {
      return;
    }
    let active = true;
    void loadCommunicationMessages(thread.id)
      .then((page) => {
        if (!active) return;
        setMessages((current) => {
          const known = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...page.items.filter((item) => !known.has(item.id)),
          ].sort((left, right) => left.id - right.id);
        });
        setNextCursor(page.nextCursor);
        setLoadError(null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [latestMessageId, loading, pageVisible, thread.id, thread.lastMessageId]);

  useEffect(() => {
    if (!pageVisible) return;
    let active = true;
    const interval = window.setInterval(() => {
      void loadCommunicationMessages(thread.id)
        .then((page) => {
          if (!active) return;
          setMessages((current) => {
            const known = new Set(current.map((item) => item.id));
            return [
              ...current,
              ...page.items.filter((item) => !known.has(item.id)),
            ].sort((left, right) => left.id - right.id);
          });
          setNextCursor(page.nextCursor);
        })
        .catch((caught: unknown) => {
          if (
            active &&
            caught instanceof CommunicationClientError &&
            caught.status === 404
          ) {
            onAccessRevoked(thread.id);
          }
        });
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [onAccessRevoked, pageVisible, thread.id]);

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    setLoadError(null);
    try {
      const page = await loadCommunicationMessages(thread.id, nextCursor);
      setMessages((current) => {
        const known = new Set(current.map((item) => item.id));
        return [
          ...page.items.filter((item) => !known.has(item.id)),
          ...current,
        ].sort((left, right) => left.id - right.id);
      });
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setLoadError(
        errorMessageFromUnknown(
          caught,
          "Не удалось загрузить предыдущие сообщения.",
        ),
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(body: string, clientMessageId = crypto.randomUUID()) {
    const normalized = body.trim();
    if (!normalized || pending?.status === "sending") return;
    const optimistic: PendingMessage = {
      clientMessageId,
      body: normalized,
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    setPending(optimistic);
    setDraft("");
    setLoadError(null);
    try {
      const message = await sendCommunicationMessage(
        thread.id,
        normalized,
        clientMessageId,
      );
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message].sort((left, right) => left.id - right.id),
      );
      setPending(null);
      onAnnouncement("Сообщение отправлено.");
      onActivity();
    } catch (caught) {
      setPending((current) =>
        current?.clientMessageId === clientMessageId
          ? { ...current, status: "failed" }
          : current,
      );
      setLoadError(
        errorMessageFromUnknown(caught, "Не удалось отправить сообщение."),
      );
    } finally {
      window.requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
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

  return (
    <div className="communication-conversation">
      {thread.kind === "course" ? (
        <p className="communication-course-notice">
          Всю историю видят текущие и будущие участники курса.
        </p>
      ) : (
        <span aria-hidden="true" />
      )}

      <div
        className="communication-message-log"
        role="log"
        aria-label={`Сообщения: ${thread.title}`}
      >
        {nextCursor ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="communication-load-older"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? "Загружаем…" : "Предыдущие сообщения"}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="communication-loading" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Загружаем диалог…
          </div>
        ) : messages.length === 0 && !pending && !loadError ? (
          <div className="communication-empty" role="status">
            {thread.kind === "course"
              ? "В чате курса пока нет сообщений."
              : "В этом диалоге пока нет сообщений."}
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`communication-message ${message.isOwn ? "is-own" : ""}`}
            >
              {!message.isOwn ? (
                <span className="communication-message-sender">
                  {message.senderLabel}
                </span>
              ) : null}
              <div className="communication-message-bubble">{message.body}</div>
              <time
                className="communication-message-meta communication-message-time"
                dateTime={message.createdAt}
              >
                {fullCommunicationTime(message.createdAt)}
              </time>
            </article>
          ))
        )}

        {pending ? (
          <article className="communication-message is-own">
            <div className="communication-message-bubble">{pending.body}</div>
            <span
              className={`communication-message-meta ${pending.status === "failed" ? "communication-message-error" : ""}`}
            >
              {pending.status === "sending" ? "Отправляется…" : "Не отправлено"}
            </span>
            {pending.status === "failed" ? (
              <button
                type="button"
                className="communication-load-older mt-1"
                onClick={() => void send(pending.body, pending.clientMessageId)}
              >
                Повторить
              </button>
            ) : null}
          </article>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="communication-composer-footer">
        {loadError ? (
          <p className="communication-composer-error" role="alert">
            {loadError}
          </p>
        ) : null}

        {thread.canSend ? (
          <form className="communication-composer" onSubmit={submit}>
            <label
              className="sr-only"
              htmlFor={`communication-message-${thread.id}`}
            >
              Сообщение в диалог «{thread.title}»
            </label>
            <textarea
              ref={composerRef}
              id={`communication-message-${thread.id}`}
              rows={1}
              maxLength={6_000}
              value={draft}
              disabled={pending?.status === "sending"}
              placeholder="Сообщение…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="submit"
              aria-label="Отправить"
              disabled={pending?.status === "sending" || !draft.trim()}
            >
              {pending?.status === "sending" ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </form>
        ) : (
          <p className="communication-course-notice" role="status">
            Этот диалог доступен только для чтения.
          </p>
        )}
      </div>
    </div>
  );
}
