"use client";

import { useMemo, useState } from "react";
import type { StudentHomeworkCard } from "@/lib/server/student-homework";
import { normalizeQuizSingleChoicePayload } from "@/lib/homework/quiz";

export function StudentHomeworkQuizCard({ item }: { item: StudentHomeworkCard }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const quiz = useMemo(() => {
    const normalized = normalizeQuizSingleChoicePayload(item.quizDefinition ?? null);
    return normalized;
  }, [item.quizDefinition]);

  if (!quiz) {
    return <p className="mt-2 text-sm text-rose-700">Тест временно недоступен.</p>;
  }

  const submitted = item.status !== "assigned";

  if (submitted) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p className="font-semibold text-emerald-900">Результат: {item.score ?? 0} из {item.maxScore ?? quiz.questions.length}</p>
        <p className="mt-1 text-emerald-800">Отлично! Ты уже прошёл(ла) мини-тест.</p>
        {item.reviewNote ? <p className="mt-1 text-sky-800">Комментарий преподавателя: {item.reviewNote}</p> : null}
      </div>
    );
  }

  const question = quiz.questions[step];
  const selected = answers[question.id] ?? "";
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Вопрос {step + 1} из {quiz.questions.length}</p>
      <p className="mt-2 text-base font-semibold text-neutral-900">{question.prompt}</p>
      {question.helperText ? <p className="mt-1 text-sm text-neutral-600">{question.helperText}</p> : null}
      <div className="mt-3 space-y-2">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-base font-semibold transition ${
              selected === option.id
                ? "border-sky-600 bg-sky-100 text-sky-900"
                : "border-sky-200 bg-white text-neutral-800 hover:border-sky-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep((prev) => Math.max(0, prev - 1))}
          disabled={step === 0}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Назад
        </button>
        {step < quiz.questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((prev) => Math.min(quiz.questions.length - 1, prev + 1))}
            disabled={!selected}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-sky-300"
          >
            Далее
          </button>
        ) : (
          <form action={`/api/student/homework/${item.studentHomeworkAssignmentId}/submit`} method="POST">
            <input
              type="hidden"
              name="submissionPayload"
              value={JSON.stringify({
                answers: quiz.questions.map((q) => ({
                  questionId: q.id,
                  selectedOptionId: answers[q.id] ?? "",
                })),
              })}
            />
            <button
              type="submit"
              disabled={answeredCount !== quiz.questions.length}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-emerald-300"
            >
              Готово
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
