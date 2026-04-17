"use client";

import { useState } from "react";
import type { TeacherLessonHomeworkReadModel } from "@/lib/server/teacher-homework";
import { TeacherHomeworkIssueModal } from "@/components/lessons/teacher-homework-issue-modal";
import { TeacherHomeworkQuizPreviewPanel } from "@/components/lessons/teacher-homework-quiz-preview-panel";
import { classNames } from "@/lib/ui/classnames";

type Props = {
  homework: TeacherLessonHomeworkReadModel;
  scheduledLessonId: string;
  classId: string;
  communication: {
    lessonScoped: Array<{
      studentId: string;
      messages: Array<{ id: string }>;
    }>;
    homeworkScoped: Array<{
      studentId: string;
      messages: Array<{ id: string }>;
    }>;
  };
};

function kindLabel(kind: "practice_text" | "quiz_single_choice") {
  return kind === "quiz_single_choice" ? "Тест" : "Практика";
}

export function TeacherHomeworkPanel({
  homework,
  scheduledLessonId,
  classId,
  communication,
}: Props) {
  const [open, setOpen] = useState(false);
  const lessonMessagesByStudentId = new Map(
    communication.lessonScoped.map((item) => [item.studentId, item.messages.length]),
  );
  const homeworkMessagesByStudentId = new Map(
    communication.homeworkScoped.map((item) => [item.studentId, item.messages.length]),
  );
  const rosterWithSignals = homework.roster.map((row) => {
    const lessonMessagesCount = lessonMessagesByStudentId.get(row.studentId) ?? 0;
    const homeworkMessagesCount = homeworkMessagesByStudentId.get(row.studentId) ?? 0;
    return {
      ...row,
      lessonMessagesCount,
      homeworkMessagesCount,
      totalMessagesCount: lessonMessagesCount + homeworkMessagesCount,
    };
  });

  const statusWeight: Record<(typeof rosterWithSignals)[number]["status"], number> = {
    needs_revision: 0,
    submitted: 1,
    assigned: 2,
    reviewed: 3,
    not_assigned: 4,
  };
  const orderedRoster = rosterWithSignals
    .slice()
    .sort(
      (a, b) =>
        statusWeight[a.status] - statusWeight[b.status] ||
        b.totalMessagesCount - a.totalMessagesCount ||
        a.studentName.localeCompare(b.studentName),
    );

  const pendingReviewCount = homework.stats.submittedCount - homework.stats.reviewedCount - homework.stats.needsRevisionCount;
  const hasAssignment = Boolean(homework.assignment);
  const attentionCount = pendingReviewCount + homework.stats.needsRevisionCount;

  if (!homework.schemaReady) {
    return (
      <p className="mt-3 text-sm text-amber-700">
        Домашние задания временно недоступны: схема БД не обновлена. Примените миграцию homework runtime layer.
      </p>
    );
  }

  return (
    <>
      <section className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={classNames(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              hasAssignment
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            {hasAssignment ? "ДЗ выдано" : "ДЗ не выдано"}
          </span>
          <span className="text-xs text-neutral-600">
            {hasAssignment
              ? `Срок: ${homework.assignment?.dueAt ?? "без срока"}`
              : "Выдайте задание, чтобы начать сбор ответов."}
          </span>
        </div>
        {hasAssignment ? (
          <p className="mt-2 text-sm text-neutral-700">
            {attentionCount > 0
              ? `Нужно внимание: ${attentionCount} (${pendingReviewCount} на проверку, ${homework.stats.needsRevisionCount} на доработке).`
              : "Критичных задач нет: текущие отправки уже разобраны."}
          </p>
        ) : null}
      </section>

      {homework.definition ? (
        <div className="mt-3 space-y-4 text-sm text-neutral-700">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Из методики (только чтение)</p>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-neutral-900">{homework.definition.title}</p>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                {kindLabel(homework.definition.kind)}
              </span>
            </div>
            <p>{homework.definition.instructions}</p>
            {homework.definition.kind === "quiz_single_choice" ? (
              <p className="text-xs text-neutral-600">
                Вопросов: {homework.definition.questionCount ?? 0}
                {homework.definition.estimatedMinutes ? ` · ${homework.definition.estimatedMinutes} мин` : ""}
              </p>
            ) : null}
            {homework.definition.materialLinks.length ? (
              <ul className="space-y-1 text-neutral-700">
                {homework.definition.materialLinks.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}
          </section>

          {homework.definition.kind === "quiz_single_choice" && homework.definition.quizDefinition ? (
            <TeacherHomeworkQuizPreviewPanel quizDefinition={homework.definition.quizDefinition} />
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-600">
          Для этого урока методики домашнее задание пока не определено.
        </p>
      )}

      {homework.definition && !homework.assignment ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Задать ДЗ
        </button>
      ) : null}

      {homework.assignment ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-neutral-200 bg-white/80 p-3 text-sm text-neutral-700">
          <p>Выдано: {homework.assignment.recipientMode === "all" ? "всей группе" : "выбранным ученикам"}</p>
          <p>Срок: {homework.assignment.dueAt ?? "без срока"}</p>
          {homework.assignment.assignmentComment ? <p>Комментарий: {homework.assignment.assignmentComment}</p> : null}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-neutral-100 px-2 py-1">Назначено: {homework.stats.assignedCount}</span>
            <span className="rounded-full bg-neutral-100 px-2 py-1">Сдано: {homework.stats.submittedCount}</span>
            <span className="rounded-full bg-neutral-100 px-2 py-1">Проверено: {homework.stats.reviewedCount}</span>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">На проверку: {pendingReviewCount}</span>
            <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">Доработка: {homework.stats.needsRevisionCount}</span>
            {homework.definition?.kind === "quiz_single_choice" && homework.stats.averageScore !== null ? (
              <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">Средний балл: {Math.round(homework.stats.averageScore * 100)}%</span>
            ) : null}
          </div>
          <div className="space-y-2">
            {orderedRoster.map((row) => (
              <div key={row.studentId} className="rounded-xl border border-neutral-200 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-neutral-900">{row.studentName}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={classNames(
                        "rounded-full px-2 py-1",
                        row.status === "submitted"
                          ? "bg-amber-100 text-amber-800"
                          : row.status === "needs_revision"
                            ? "bg-rose-100 text-rose-800"
                            : row.status === "reviewed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-neutral-100 text-neutral-700",
                      )}
                    >
                      {row.statusLabel}
                    </span>
                    {row.totalMessagesCount > 0 ? (
                      <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">
                        Сообщения: {row.totalMessagesCount}
                      </span>
                    ) : null}
                  </div>
                </div>
                {row.score !== null && row.maxScore !== null ? <p className="text-xs text-neutral-600">Результат: {row.score} / {row.maxScore}</p> : null}
                {row.submittedAt ? <p className="text-xs text-neutral-600">Отправлено: {row.submittedAt}</p> : null}
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <a
                    href={`/groups/${classId}/students/${row.studentId}/communication?filter=lesson&scheduledLessonId=${scheduledLessonId}`}
                    className="text-sky-700 underline underline-offset-2"
                  >
                    Обсуждение урока ({row.lessonMessagesCount})
                  </a>
                  <a
                    href={`/groups/${classId}/students/${row.studentId}/communication?filter=homework&scheduledLessonId=${scheduledLessonId}`}
                    className="text-sky-700 underline underline-offset-2"
                  >
                    Обсуждение ДЗ ({row.homeworkMessagesCount})
                  </a>
                </div>
                {row.assigned && row.studentHomeworkAssignmentId ? (
                  <form className="mt-2 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2" action={`/api/teacher/lessons/${scheduledLessonId}/homework/review`} method="POST">
                    <input type="hidden" name="studentHomeworkAssignmentId" value={row.studentHomeworkAssignmentId} />
                    <select name="reviewStatus" defaultValue="reviewed" className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                      <option value="reviewed">Проверено</option>
                      <option value="needs_revision">Нужна доработка</option>
                    </select>
                    <textarea name="reviewNote" defaultValue={row.reviewNote ?? ""} rows={2} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="Комментарий преподавателя" />
                    <button type="submit" className="rounded-xl border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800">Сохранить проверку</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {homework.definition ? (
        <TeacherHomeworkIssueModal
          open={open}
          onClose={() => setOpen(false)}
          action={`/api/teacher/lessons/${scheduledLessonId}/homework/issue`}
          students={homework.roster.map((row) => ({ studentId: row.studentId, studentName: row.studentName }))}
          homeworkSummary={{
            title: homework.definition.title,
            kindLabel: kindLabel(homework.definition.kind),
            instructions: homework.definition.instructions,
          }}
        />
      ) : null}
    </>
  );
}
