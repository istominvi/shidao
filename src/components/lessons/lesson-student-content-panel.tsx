import Link from "next/link";
import { SurfaceCard } from "@/components/ui/surface-card";
import { classNames } from "@/lib/ui/classnames";
import type { MethodologyLessonStudentContent, ReusableAsset } from "@/lib/lesson-content";

type Props = {
  title?: string;
  source: MethodologyLessonStudentContent | null;
  unavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
  assetsById: Record<string, ReusableAsset>;
  previewHref?: string;
  embedded?: boolean;
};

export function LessonStudentContentPanel({
  title = "Контент",
  source,
  unavailableReason,
  assetsById,
  previewHref,
  embedded = false,
}: Props) {
  const content = (
    <>
      {!embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          {previewHref ? (
            <Link
              href={previewHref}
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800"
            >
              Предпросмотр ученической версии
            </Link>
          ) : null}
        </div>
      ) : previewHref ? (
        <div className="mb-4">
          <Link
            href={previewHref}
            className="inline-flex rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800"
          >
            Предпросмотр ученической версии
          </Link>
        </div>
      ) : null}

      {!source ? (
        <div className="space-y-2">
          {unavailableReason === "schema_missing" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Контент урока для ученика временно недоступен. Примените миграцию lesson student content layer.
            </p>
          ) : unavailableReason === "invalid_payload" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Контент урока для ученика временно недоступен: source-данные урока заполнены некорректно.
            </p>
          ) : unavailableReason === "load_failed" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Не удалось загрузить контент урока для ученика.
            </p>
          ) : null}
          <p className="text-sm text-neutral-600">Для этого урока пока нет отдельного learner-facing контента.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {source.sections.map((section, idx) => (
            <article
              key={`${section.type}-${idx}`}
              className={classNames(
                "rounded-2xl border border-neutral-200 p-3",
                embedded ? "bg-neutral-50/60" : "bg-white",
              )}
            >
              <h3 className="font-semibold text-neutral-900">{section.title}</h3>
              <p className="text-xs text-neutral-500">Тип: {section.type}</p>
              {section.type === "media_asset" && assetsById[section.assetId]?.sourceUrl ? (
                <a
                  href={assetsById[section.assetId]?.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-sky-700 underline underline-offset-2"
                >
                  Открыть материал
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <section aria-label={title}>{content}</section>;
  }

  return <SurfaceCard>{content}</SurfaceCard>;
}
