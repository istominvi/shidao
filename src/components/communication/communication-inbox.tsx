"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommunicationAvatar,
  compactCommunicationTime,
  fullCommunicationTime,
  inboxItemSubtitle,
  unreadLabel,
} from "@/components/communication/communication-presenters";
import type { CommunicationCenterView } from "@/components/communication/communication-center-provider";
import type { InboxItem } from "@/modules/communication/domain";

function selectedItem(view: CommunicationCenterView, item: InboxItem) {
  if (item.kind === "system") return view.type === "system";
  if (item.kind === "assistant") {
    return (
      view.type === "assistant" && view.conversationId === item.conversationId
    );
  }
  return view.type === "thread" && view.threadId === item.threadId;
}

export function CommunicationInbox({
  items,
  view,
  loading,
  error,
  hasMore,
  loadingMore,
  onSelect,
  onRetry,
  onLoadMore,
  onNewConversation,
}: {
  items: InboxItem[];
  view: CommunicationCenterView;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onSelect: (item: InboxItem) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onNewConversation: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const visibleItems = useMemo(
    () =>
      normalizedQuery
        ? items.filter(
            (item) =>
              item.title.toLocaleLowerCase("ru-RU").includes(normalizedQuery) ||
              item.preview
                ?.toLocaleLowerCase("ru-RU")
                .includes(normalizedQuery) ||
              inboxItemSubtitle(item)
                .toLocaleLowerCase("ru-RU")
                .includes(normalizedQuery),
          )
        : items,
    [items, normalizedQuery],
  );

  return (
    <div className="communication-inbox-body">
      <div className="communication-inbox-tools">
        <label className="communication-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Найти диалог</span>
          <input
            type="search"
            value={query}
            placeholder="Найти диалог"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {loading && items.length === 0 ? (
        <div className="communication-loading" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Загружаем сообщения…
        </div>
      ) : error && items.length === 0 ? (
        <div className="communication-error" role="alert">
          <span>{error}</span>
          <Button variant="secondary" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="communication-empty" role="status">
          <span>
            {normalizedQuery
              ? "Диалоги не найдены."
              : "Сообщений пока нет. Начните диалог с ИИ, учеником или курсом."}
          </span>
          {!normalizedQuery ? (
            <button type="button" onClick={onNewConversation}>
              Новый диалог
            </button>
          ) : null}
        </div>
      ) : (
        <nav aria-label="Диалоги">
          <ul className="communication-inbox-list">
            {visibleItems.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <button
                  type="button"
                  className="communication-inbox-item"
                  aria-current={selectedItem(view, item) ? "true" : undefined}
                  onClick={() => onSelect(item)}
                >
                  <CommunicationAvatar kind={item.kind} title={item.title} />
                  <span className="communication-inbox-copy">
                    <span className="communication-inbox-title-row">
                      <strong>{item.title}</strong>
                      <time
                        dateTime={item.lastActivityAt}
                        title={fullCommunicationTime(item.lastActivityAt)}
                      >
                        {compactCommunicationTime(item.lastActivityAt)}
                      </time>
                    </span>
                    <span className="communication-inbox-preview">
                      {item.preview ?? inboxItemSubtitle(item)}
                    </span>
                  </span>
                  {item.unreadCount > 0 ? (
                    <span
                      className="communication-unread-count"
                      aria-label={`Непрочитанных: ${item.unreadCount}`}
                    >
                      {unreadLabel(item.unreadCount)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {hasMore && !normalizedQuery ? (
        <div className="flex justify-center px-3 pb-3">
          <button
            type="button"
            className="communication-load-older"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? "Загружаем…" : "Показать ещё"}
          </button>
        </div>
      ) : null}

      {error && items.length > 0 ? (
        <p className="communication-composer-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
