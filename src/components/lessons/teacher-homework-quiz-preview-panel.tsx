"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/ui/chip";
import { HomeworkQuizExperience } from "@/components/lessons/homework-quiz-experience";
import { normalizeQuizSingleChoicePayload } from "@/lib/homework/quiz";

export function TeacherHomeworkQuizPreviewPanel({
  quizDefinition,
}: {
  quizDefinition: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);
  const quiz = useMemo(() => normalizeQuizSingleChoicePayload(quizDefinition), [quizDefinition]);

  if (!quiz) return null;

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">Как это увидит ученик</h3>
            <Chip tone="violet" size="sm">Предпросмотр ученической версии</Chip>
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            Это локальный предпросмотр. Ответы не сохраняются и не влияют на ДЗ учеников.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-800"
        >
          {open ? "Скрыть предпросмотр" : "Открыть предпросмотр"}
        </button>
      </div>

      {open ? <HomeworkQuizExperience quiz={quiz} mode="preview" /> : null}
    </section>
  );
}
