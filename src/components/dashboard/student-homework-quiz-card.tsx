"use client";

import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { HomeworkQuizExperience } from "@/components/lessons/homework-quiz-experience";
import type { StudentHomeworkCard } from "@/lib/server/student-homework";
import { normalizeQuizSingleChoicePayload } from "@/lib/homework/quiz";

export function StudentHomeworkQuizCard({ item }: { item: StudentHomeworkCard }) {
  const quiz = useMemo(() => normalizeQuizSingleChoicePayload(item.quizDefinition ?? null), [item.quizDefinition]);

  if (!quiz) {
    return <p className="mt-2 text-sm text-rose-700">Тест временно недоступен.</p>;
  }

  const submitted = item.status !== "assigned";

  if (submitted) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <p className="flex items-center gap-1.5 text-base font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          {quiz.completionTitle ?? "Миссия завершена!"}
        </p>
        <p className="mt-1 text-emerald-800">
          Результат: {item.score ?? 0} из {item.maxScore ?? quiz.questions.length}
        </p>
        <p className="mt-1 text-emerald-800">
          {quiz.completionText ?? "Отлично! Ты повторил(а) слова с фермы. Если хочешь — открой урок и повтори их ещё раз."}
        </p>
        {item.reviewNote ? (
          <p className="mt-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sky-900">
            Комментарий преподавателя: {item.reviewNote}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <HomeworkQuizExperience
      quiz={quiz}
      mode="student"
      studentAssignmentId={item.studentHomeworkAssignmentId}
    />
  );
}
