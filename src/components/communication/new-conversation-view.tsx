"use client";

import {
  BookOpen,
  LoaderCircle,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { loadMessageTargets } from "@/components/communication/communication-client";
import { Button } from "@/components/ui/button";
import type {
  CourseMessageTarget,
  DirectMessageTarget,
  MessageTargets,
} from "@/modules/communication/domain";

const EMPTY_TARGETS: MessageTargets = { direct: [], courses: [] };

function message(caught: unknown) {
  return caught instanceof Error
    ? caught.message
    : "Не удалось загрузить доступные диалоги.";
}

export function NewConversationView({
  contextLabel,
  busy,
  actionError,
  onCreateAssistant,
  onOpenDirect,
  onOpenCourse,
}: {
  contextLabel: string;
  busy: boolean;
  actionError?: string | null;
  onCreateAssistant: () => void;
  onOpenDirect: (target: DirectMessageTarget) => void;
  onOpenCourse: (target: CourseMessageTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [targets, setTargets] = useState<MessageTargets>(EMPTY_TARGETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(
      () => {
        setLoading(true);
        void loadMessageTargets(query)
          .then((next) => {
            if (!active) return;
            setTargets(next);
            setError(null);
          })
          .catch((caught: unknown) => {
            if (!active) return;
            setError(message(caught));
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      query.trim() ? 220 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [query, reloadKey]);

  return (
    <div className="communication-new-body">
      {actionError ? (
        <p className="communication-new-action-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <div className="communication-new-search">
        <label className="communication-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Найти ученика или курс</span>
          <input
            type="search"
            value={query}
            placeholder="Найти ученика или курс"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {!query.trim() ? (
        <>
          <h3 className="communication-section-title">ИИ</h3>
          <ul className="communication-target-list">
            <li>
              <button
                type="button"
                className="communication-target-item"
                disabled={busy}
                onClick={onCreateAssistant}
              >
                <span
                  className="communication-avatar is-assistant"
                  aria-hidden="true"
                >
                  <Sparkles />
                </span>
                <span className="communication-target-copy">
                  <strong>Новый диалог с ShiDao ИИ</strong>
                  <span>Контекст: {contextLabel}</span>
                </span>
              </button>
            </li>
          </ul>
        </>
      ) : null}

      {loading &&
      targets.direct.length === 0 &&
      targets.courses.length === 0 ? (
        <div className="communication-loading" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Загружаем адресатов…
        </div>
      ) : error ? (
        <div className="communication-error" role="alert">
          <span>{error}</span>
          <Button
            variant="secondary"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Повторить
          </Button>
        </div>
      ) : (
        <>
          {targets.direct.length > 0 ? (
            <>
              <h3 className="communication-section-title">Ученики</h3>
              <ul className="communication-target-list">
                {targets.direct.map((target) => (
                  <li key={target.learnerProfileId}>
                    <button
                      type="button"
                      className="communication-target-item"
                      disabled={busy}
                      onClick={() => onOpenDirect(target)}
                    >
                      <span className="communication-avatar" aria-hidden="true">
                        <UserRound />
                      </span>
                      <span className="communication-target-copy">
                        <strong>{target.title}</strong>
                        <span>
                          {target.existingThreadId
                            ? "Открыть личный диалог"
                            : "Начать личный диалог"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {targets.courses.length > 0 ? (
            <>
              <h3 className="communication-section-title">Курсы</h3>
              <ul className="communication-target-list">
                {targets.courses.map((target) => (
                  <li key={target.courseId}>
                    <button
                      type="button"
                      className="communication-target-item"
                      disabled={busy}
                      onClick={() => onOpenCourse(target)}
                    >
                      <span
                        className="communication-avatar is-course"
                        aria-hidden="true"
                      >
                        <BookOpen />
                      </span>
                      <span className="communication-target-copy">
                        <strong>{target.title}</strong>
                        <span>
                          {target.existingThreadId
                            ? "Открыть чат курса"
                            : "Начать чат курса"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {!loading &&
          targets.direct.length === 0 &&
          targets.courses.length === 0 ? (
            <div className="communication-empty" role="status">
              {query.trim()
                ? "Подходящих учеников и курсов не найдено."
                : "Подключённые ученики и доступные чаты курсов появятся здесь."}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
