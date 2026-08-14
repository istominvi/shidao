import { CheckCircle2, Clock3, RotateCcw, UserX } from "lucide-react";
import profileStyles from "@/components/profile/profile-workspace.module.css";
import { Button } from "@/components/ui/button";
import type { LearnerSafeHistoryItem } from "@/modules/learner-identity/domain";
import { formatIdentityDate, IdentityEmpty } from "./identity-ui";

export function SafeHistoryList({
  items,
  nextCursor,
  loadingMore,
  onLoadMore,
}: {
  items: LearnerSafeHistoryItem[];
  nextCursor: string | null;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  if (items.length === 0) {
    return (
      <IdentityEmpty
        surface="card"
        title="История пока пуста"
        description="Появятся только завершённые занятия и комментарии, которые преподаватель явно добавил в учебный профиль."
      />
    );
  }
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {items.map((item) => (
          <li
            key={item.key}
            className={profileStyles.card}
            data-profile-surface="card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {item.subject || "Без предмета"}
                </p>
                <h3 className="mt-1 font-bold text-neutral-950">
                  {item.lessonTitle}
                </h3>
                <p className="mt-1 text-sm text-neutral-600">
                  {item.courseTitle} · {formatIdentityDate(item.occurredAt)}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.wasPresent ? "bg-emerald-100 text-emerald-900" : "bg-neutral-100 text-neutral-700"}`}
              >
                {item.wasPresent ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {item.wasPresent ? "Присутствовал(а)" : "Отсутствовал(а)"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-neutral-700">
              {item.needsRepeat === true ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Рекомендован повтор
                </span>
              ) : null}
              {item.actualDurationMinutes !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-sky-900">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.actualDurationMinutes} мин фактически
                </span>
              ) : null}
            </div>
            {item.comment ? (
              <blockquote className="mt-4 rounded-xl border-l-4 border-sky-300 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-neutral-800">
                <p>{item.comment.text}</p>
                <footer className="mt-2 text-xs text-neutral-500">
                  Добавлено в учебный профиль{" "}
                  {formatIdentityDate(item.comment.sharedAt)}
                </footer>
              </blockquote>
            ) : null}
          </li>
        ))}
      </ol>
      {nextCursor && onLoadMore ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? "Загружаем…" : "Показать ещё"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
