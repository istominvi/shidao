"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  loadSystemNotifications,
  markSystemNotificationsRead,
} from "@/components/communication/communication-client";
import { CommunicationMarkdown } from "@/components/communication/communication-markdown";
import { fullCommunicationTime } from "@/components/communication/communication-presenters";
import { usePageVisible } from "@/components/communication/use-page-visible";
import { Button } from "@/components/ui/button";
import type { SystemNotification } from "@/modules/communication/domain";

function errorMessage(caught: unknown) {
  return caught instanceof Error
    ? caught.message
    : "Не удалось загрузить уведомления.";
}

export function SystemConversation({
  refreshKey,
  onActivity,
}: {
  refreshKey: number | null;
  onActivity: () => void;
}) {
  const [items, setItems] = useState<SystemNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const pageVisible = usePageVisible();
  const latestNotificationId = items.reduce(
    (latest, item) => Math.max(latest, item.id),
    0,
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void loadSystemNotifications()
      .then((page) => {
        if (!active) return;
        setItems([...page.items].sort((left, right) => right.id - left.id));
        setNextCursor(page.nextCursor);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey, reloadKey]);

  useEffect(() => {
    if (!latestNotificationId || !pageVisible) return;
    void markSystemNotificationsRead(latestNotificationId)
      .then(onActivity)
      .catch(() => undefined);
  }, [latestNotificationId, onActivity, pageVisible]);

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    setError(null);
    try {
      const page = await loadSystemNotifications(nextCursor);
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...page.items.filter((item) => !known.has(item.id)),
        ].sort((left, right) => right.id - left.id);
      });
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <div className="communication-conversation communication-system-conversation">
      <div
        className="communication-system-feed"
        role="log"
        aria-label="Системные уведомления ShiDao"
      >
        {loading ? (
          <div className="communication-loading" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Загружаем уведомления…
          </div>
        ) : error && items.length === 0 ? (
          <div className="communication-error" role="alert">
            <span>{error}</span>
            <Button
              variant="secondary"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Повторить
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="communication-empty" role="status">
            Важные события ShiDao появятся здесь.
          </div>
        ) : (
          items.map((notification) => {
            return (
              <article
                key={notification.id}
                className="communication-system-card"
                data-severity={notification.severity}
              >
                <header>
                  <strong>{notification.title}</strong>
                  <time
                    dateTime={notification.occurredAt}
                    title={fullCommunicationTime(notification.occurredAt)}
                  >
                    {fullCommunicationTime(notification.occurredAt)}
                  </time>
                </header>
                {notification.body ? (
                  <CommunicationMarkdown body={notification.body} />
                ) : null}
              </article>
            );
          })
        )}

        {nextCursor ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="communication-load-older"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? "Загружаем…" : "Предыдущие уведомления"}
            </button>
          </div>
        ) : null}
      </div>
      {error && items.length > 0 ? (
        <p className="communication-composer-error" role="alert">
          {error}
        </p>
      ) : (
        <span aria-hidden="true" />
      )}
      <span aria-hidden="true" />
    </div>
  );
}
