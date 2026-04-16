"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import {
  gradeQuizSingleChoice,
  normalizeQuizSubmissionPayload,
  type QuizSingleChoicePayload,
} from "@/lib/homework/quiz";

export type HomeworkQuizExperienceProps = {
  quiz: QuizSingleChoicePayload;
  mode: "student" | "preview";
  studentAssignmentId?: string;
};

function toneClass(tone?: QuizSingleChoicePayload["tone"]) {
  if (tone === "sky") return "border-sky-200 bg-sky-50/60";
  if (tone === "violet") return "border-violet-200 bg-violet-50/60";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50/60";
  if (tone === "amber") return "border-amber-200 bg-amber-50/60";
  if (tone === "rose") return "border-rose-200 bg-rose-50/60";
  return "border-sky-200 bg-sky-50/60";
}

export function HomeworkQuizExperience({
  quiz,
  mode,
  studentAssignmentId,
}: HomeworkQuizExperienceProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [previewCompleted, setPreviewCompleted] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const question = quiz.questions[step];
  const selected = answers[question.id] ?? "";
  const progressRatio = (step + 1) / quiz.questions.length;

  const previewResult = useMemo(() => {
    if (mode !== "preview" || !previewCompleted) return null;
    const submission = normalizeQuizSubmissionPayload({
      answers: quiz.questions.map((q) => ({
        questionId: q.id,
        selectedOptionId: answers[q.id] ?? "",
      })),
    });
    if (!submission) return null;
    return gradeQuizSingleChoice(quiz, submission);
  }, [answers, mode, previewCompleted, quiz]);

  if (mode === "preview" && previewCompleted) {
    return (
      <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm">
        <p className="flex items-center gap-1.5 text-base font-semibold text-violet-900">
          <CheckCircle2 className="h-4 w-4" />
          Предпросмотр завершён
        </p>
        <p className="mt-1 text-violet-800">Так ученик увидит итог после прохождения.</p>
        <p className="mt-1 text-violet-900">
          Результат: {previewResult?.score ?? 0} из {previewResult?.maxScore ?? quiz.questions.length}
        </p>
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            setStep(0);
            setPreviewCompleted(false);
          }}
          className="mt-3 rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-900"
        >
          Начать заново
        </button>
      </div>
    );
  }

  return (
    <div className={`mt-3 rounded-2xl border p-4 ${toneClass(quiz.tone)}`}>
      <div className="rounded-2xl border border-sky-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-neutral-900">{quiz.title ?? "Мини-миссия после урока"}</p>
            {quiz.subtitle ? <p className="text-sm text-neutral-600">{quiz.subtitle}</p> : null}
            <p className="mt-1 text-sm text-neutral-700">{quiz.introText ?? "Помоги Сяо Лону и Сяо Мей вспомнить животных на ферме."}</p>
          </div>
          {quiz.illustrationSrc ? (
            <Image src={quiz.illustrationSrc} alt="Иллюстрация миссии" width={72} height={72} className="rounded-xl border border-black/10 bg-neutral-50" />
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">
          <span>Вопрос {step + 1} из {quiz.questions.length}</span>
          <span>{Math.round(progressRatio * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/80">
          <div className="h-2 rounded-full bg-sky-500 transition-all" style={{ width: `${Math.max(8, progressRatio * 100)}%` }} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/80 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {question.sceneLabel ? <Chip tone="sky" size="sm">{question.sceneLabel}</Chip> : null}
            {question.title ? <p className="mt-2 text-sm font-semibold text-neutral-800">{question.title}</p> : null}
            <p className="mt-1 text-lg font-semibold text-neutral-900">{question.prompt}</p>
            {question.helperText ? <p className="mt-1 text-sm text-neutral-600">{question.helperText}</p> : null}
            {question.skillTag ? <p className="mt-1 text-xs text-neutral-500">Тренируем: {question.skillTag}</p> : null}
          </div>
          {question.illustrationSrc ? (
            <Image src={question.illustrationSrc} alt="Иллюстрация вопроса" width={72} height={72} className="rounded-xl border border-black/10 bg-neutral-50" />
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                selected === option.id
                  ? "border-sky-500 bg-sky-100 text-sky-950"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-sky-300"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{option.label}</p>
                  {option.description ? <p className="text-xs text-neutral-600">{option.description}</p> : null}
                </div>
                {option.illustrationSrc ? (
                  <Image src={option.illustrationSrc} alt={option.label} width={40} height={40} className="rounded-lg border border-black/10 bg-neutral-50" />
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep((prev) => Math.max(0, prev - 1))}
          disabled={step === 0}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
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
        ) : mode === "student" ? (
          <form action={`/api/student/homework/${studentAssignmentId}/submit`} method="POST">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-emerald-300"
            >
              <Sparkles className="h-4 w-4" />
              Завершить миссию
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setPreviewCompleted(true)}
            disabled={answeredCount !== quiz.questions.length}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-violet-300"
          >
            <Sparkles className="h-4 w-4" />
            Посмотреть результат
          </button>
        )}
      </div>
    </div>
  );
}
