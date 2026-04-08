"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/app-card";
import type { TeacherMethodologyLessonDetail } from "@/lib/server/teacher-methodologies";

type MethodologyLessonCardProps = {
  lesson: TeacherMethodologyLessonDetail;
};

function positionLabel(lesson: TeacherMethodologyLessonDetail) {
  return `Модуль ${lesson.moduleIndex} · Урок ${lesson.lessonIndex}${lesson.unitIndex ? ` · Раздел ${lesson.unitIndex}` : ""}`;
}

export function MethodologyLessonCard({ lesson }: MethodologyLessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <AppCard as="article" className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900">
            Урок методики
          </span>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">{positionLabel(lesson)}</p>
          <h3 className="text-lg font-semibold text-neutral-950">{lesson.title}</h3>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
        >
          {isExpanded ? "Скрыть содержание" : "Показать содержание"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-700">
        {lesson.durationMinutes ? (
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">~ {lesson.durationMinutes} мин</span>
        ) : null}
        <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">Статус: {lesson.readinessLabel}</span>
        {lesson.vocabularySummary.length ? (
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
            Слова: {lesson.vocabularySummary.slice(0, 3).join(", ")}
            {lesson.vocabularySummary.length > 3 ? "…" : ""}
          </span>
        ) : null}
        {lesson.phraseSummary.length ? (
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
            Фразы: {lesson.phraseSummary.slice(0, 2).join(", ")}
            {lesson.phraseSummary.length > 2 ? "…" : ""}
          </span>
        ) : null}
      </div>

      {isExpanded ? (
        <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
          <p className="rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            Это урок методики. Чтобы создать конкретное занятие, перейдите в нужную группу и запланируйте занятие.
          </p>

          {lesson.blocks.length === 0 ? (
            <p className="text-sm text-neutral-500">Для этого урока методики пока не добавлено детализированное содержание.</p>
          ) : (
            <div className="space-y-3">
              {lesson.blocks.map((block, index) => (
                <article key={block.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    Блок {index + 1} · {block.blockTypeLabel}
                  </p>
                  <h4 className="mt-1 text-sm font-semibold text-neutral-900">{block.title || "Без названия"}</h4>
                  {block.contentPreview ? (
                    <p className="mt-2 text-sm text-neutral-700">{block.contentPreview}</p>
                  ) : null}
                  {block.contentJson ? (
                    <pre className="mt-2 overflow-x-auto rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700">{block.contentJson}</pre>
                  ) : null}

                  {block.assets.length ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Материалы</p>
                      <ul className="space-y-1 text-sm text-neutral-700">
                        {block.assets.map((asset) => (
                          <li key={asset.id}>
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">{asset.kindLabel}</span>{" "}
                            {asset.sourceUrl ? (
                              <a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-sky-700 underline underline-offset-2">
                                {asset.title}
                              </a>
                            ) : (
                              <span className="font-medium text-neutral-900">{asset.title}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </AppCard>
  );
}
