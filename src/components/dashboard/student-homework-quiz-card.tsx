"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, GripVertical, Volume2 } from "lucide-react";
import { HomeworkQuizExperience } from "@/components/lessons/homework-quiz-experience";
import type { StudentHomeworkCard } from "@/lib/server/student-homework";
import { normalizeQuizSingleChoicePayload, type QuizPracticeSection } from "@/lib/homework/quiz";
import Image from "next/image";

function MatchingPractice({ section }: { section: Extract<QuizPracticeSection, { type: "matching" }> }) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
      <p className="text-sm font-semibold text-violet-900">{section.title}</p>
      <p className="mt-1 text-sm text-neutral-700">{section.prompt}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {section.items.map((item) => (
          <button
            key={item.id}
            draggable
            onDragStart={() => setDragged(item.label)}
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-3 py-1 text-sm font-semibold text-violet-900"
          >
            <GripVertical className="h-3.5 w-3.5" /> {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {section.items.map((item) => (
          <article
            key={`slot-${item.id}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!dragged) return;
              setMatches((prev) => ({ ...prev, [item.id]: dragged }));
              setDragged(null);
            }}
            className="rounded-xl border border-violet-200 bg-white p-2"
          >
            {item.illustrationSrc ? (
              <Image src={item.illustrationSrc} alt={item.label} width={140} height={100} className="h-24 w-full rounded-md object-contain" />
            ) : null}
            <p className="mt-1 text-xs text-neutral-600">Перетащи сюда иероглиф</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{matches[item.id] ?? "—"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AudioReviewPractice({ section }: { section: Extract<QuizPracticeSection, { type: "audio_review" }> }) {
  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
      <p className="text-sm font-semibold text-sky-900">{section.title}</p>
      <div className="mt-2 space-y-2">
        {section.groups.map((group) => (
          <article key={group.id} className="rounded-lg border border-sky-200 bg-white p-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-700">{group.title}</p>
            <div className="mt-2 grid gap-2">
              {group.entries.map((entry) => (
                <div key={entry.id} className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
                  <p className="text-lg font-semibold text-neutral-900">{entry.hanzi}</p>
                  <p className="text-xs text-neutral-700">{entry.pinyin ?? ""} · {entry.meaning}</p>
                  {entry.audioUrl ? (
                    <a href={entry.audioUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
                      <Volume2 className="h-3 w-3" /> Слушать
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HomeworkPracticeSections({ sections }: { sections: QuizPracticeSection[] }) {
  if (!sections.length) return null;
  return (
    <div className="mt-3 space-y-3">
      {sections.map((section) => {
        if (section.type === "matching") {
          return <MatchingPractice key={section.id} section={section} />;
        }
        return <AudioReviewPractice key={section.id} section={section} />;
      })}
    </div>
  );
}

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
        <HomeworkPracticeSections sections={quiz.practiceSections ?? []} />
        {item.reviewNote ? (
          <p className="mt-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sky-900">
            Комментарий преподавателя: {item.reviewNote}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <HomeworkPracticeSections sections={quiz.practiceSections ?? []} />
      <HomeworkQuizExperience
        quiz={quiz}
        mode="student"
        studentAssignmentId={item.studentHomeworkAssignmentId}
      />
    </>
  );
}
