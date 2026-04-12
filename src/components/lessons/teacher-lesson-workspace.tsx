"use client";

import { useState } from "react";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { LessonContextChip } from "@/components/lessons/lesson-context-chip";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { TeacherHomeworkPanel } from "@/components/lessons/teacher-homework-panel";
import Link from "next/link";
import { toMethodologyLessonRoute, toScheduledLessonRoute } from "@/lib/auth";

type TeacherLessonWorkspaceProps = {
  workspace: TeacherLessonWorkspaceReadModel;
  runtimeFormFeedback?: {
    success?: string;
    error?: string;
  };
};

function statusBadgeTone(statusLabel: string) {
  if (statusLabel.includes("Идёт"))
    return "bg-sky-100 text-sky-800 border-sky-200";
  if (statusLabel.includes("Заверш"))
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (statusLabel.includes("Отмен"))
    return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

function tabButton(active: boolean) {
  return active
    ? "rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white"
    : "rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700";
}

export function TeacherLessonWorkspace({
  workspace,
  runtimeFormFeedback,
}: TeacherLessonWorkspaceProps) {
  const [tab, setTab] = useState<"scenario" | "student-content" | "homework">(
    "scenario",
  );
  const runtime = workspace.projection.runtimeShell;
  const { hero, quickSummary, methodologyReference, lessonFlow, notes } =
    workspace.presentation;

  return (
    <div className="space-y-8 lg:space-y-10">
      <AppPageHeader
        eyebrow="Рабочее пространство преподавателя"
        title={hero.lessonTitle}
        description={hero.lessonEssence}
        meta={(
          <>
            <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1.5 text-sm font-medium text-neutral-900">
              {hero.groupLabel}
            </span>
            <span className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm text-neutral-700">
              {hero.dateTimeLabel}
            </span>
            <span className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm text-neutral-700">
              {hero.formatLabel}
            </span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusBadgeTone(hero.statusLabel)}`}>
              {hero.statusLabel}
            </span>
            <LessonContextChip context="schedule" />
          </>
        )}
        actions={(
          <div className="text-sm text-neutral-600">
            <p>{hero.methodologyLine}</p>
            {workspace.sourceLesson ? (
              <p className="mt-1">
                Основан на уроке методики · <Link href={toMethodologyLessonRoute(workspace.sourceLesson.methodologySlug, workspace.sourceLesson.lessonId)} className="text-sky-700 underline underline-offset-2">Открыть исходный урок</Link>
              </p>
            ) : null}
          </div>
        )}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <div className="space-y-5">
          <AppCard className="p-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={tabButton(tab === "scenario")} onClick={() => setTab("scenario")}>
                Сценарий урока
              </button>
              <button type="button" className={tabButton(tab === "student-content")} onClick={() => setTab("student-content")}>
                Контент для ученика
              </button>
              <button type="button" className={tabButton(tab === "homework")} onClick={() => setTab("homework")}>
                Домашнее задание
              </button>
            </div>
          </AppCard>

          {tab === "scenario" ? (
            <TeacherLessonPedagogicalContent quickSummary={quickSummary} lessonFlow={lessonFlow} />
          ) : null}

          {tab === "student-content" ? (
            <AppCard className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-neutral-900">Контент для ученика</h2>
                <Link
                  href={`${toScheduledLessonRoute(workspace.scheduledLessonId)}?view=learner-preview`}
                  className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800"
                >
                  Предпросмотр ученической версии
                </Link>
              </div>
              {!workspace.studentContent.source ? (
                <div className="mt-3 space-y-2">
                  {workspace.studentContent.unavailableReason === "schema_missing" ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Контент урока для ученика временно недоступен. Примените миграцию lesson student content layer.
                    </p>
                  ) : workspace.studentContent.unavailableReason === "invalid_payload" ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Контент урока для ученика временно недоступен: source-данные урока заполнены некорректно.
                    </p>
                  ) : workspace.studentContent.unavailableReason === "load_failed" ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Не удалось загрузить контент урока для ученика. Основной сценарий урока остаётся доступен.
                    </p>
                  ) : null}
                  <p className="text-sm text-neutral-600">Для этого урока пока нет отдельного learner-facing контента.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {workspace.studentContent.source.sections.map((section, idx) => (
                    <article key={`${section.type}-${idx}`} className="rounded-2xl border border-neutral-200 bg-white p-3">
                      <h3 className="font-semibold text-neutral-900">{section.title}</h3>
                      <p className="text-xs text-neutral-500">Тип: {section.type}</p>
                    </article>
                  ))}
                </div>
              )}
            </AppCard>
          ) : null}

          {tab === "homework" ? (
            <AppCard className="border-sky-200/70 p-5">
              <h2 className="text-lg font-bold text-neutral-900">Домашнее задание</h2>
              <TeacherHomeworkPanel
                homework={workspace.homework}
                scheduledLessonId={workspace.scheduledLessonId}
              />
            </AppCard>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <AppCard className="border-emerald-200/70 p-5 md:p-6">
            <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-900">
              Проведение занятия
            </h2>
            <p className="mt-2 text-sm text-neutral-700">
              Обновляйте рабочий статус и заметки по этому занятию.
            </p>

            {runtimeFormFeedback?.success ? (
              <p className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {runtimeFormFeedback.success}
              </p>
            ) : null}
            {runtimeFormFeedback?.error ? (
              <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {runtimeFormFeedback.error}
              </p>
            ) : null}

            <form
              className="mt-4 space-y-4"
              action={`/api/teacher/lessons/${workspace.scheduledLessonId}/runtime`}
              method="POST"
            >
              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Статус занятия
                </span>
                <select
                  name="runtimeStatus"
                  defaultValue={runtime.runtimeStatus}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
                >
                  <option value="planned">Запланировано</option>
                  <option value="in_progress">Идёт занятие</option>
                  <option value="completed">Завершено</option>
                  <option value="cancelled">Отменено</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Короткая заметка перед уроком
                </span>
                <textarea
                  name="runtimeNotesSummary"
                  rows={2}
                  defaultValue={runtime.runtimeNotesSummary ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Заметки по проведению
                </span>
                <textarea
                  name="runtimeNotes"
                  rows={4}
                  defaultValue={workspace.projection.runtimeNotes ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Итоги после занятия
                </span>
                <textarea
                  name="outcomeNotes"
                  rows={4}
                  defaultValue={workspace.projection.outcomeNotes ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Сохранить изменения
              </button>
            </form>
          </AppCard>

          <AppCard className="p-5">
            <h2 className="text-lg font-bold text-neutral-900">Фокус преподавателя</h2>
            <article className="mt-3 rounded-2xl border border-neutral-200 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">
                Короткая заметка
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                {runtime.runtimeNotesSummary?.trim() ||
                  "Добавьте короткую заметку перед началом урока."}
              </p>
            </article>
            <article className="mt-3 rounded-2xl border border-neutral-200 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">
                Заметки по проведению
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                {notes.runtimeNotes ||
                  "Пока нет заметок по проведению занятия."}
              </p>
            </article>
            <article className="mt-3 rounded-2xl border border-neutral-200 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">
                Итоги после занятия
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                {notes.outcomeNotes ||
                  "После урока добавьте короткий итог по группе."}
              </p>
            </article>
          </AppCard>

          <AppCard className="border-violet-200/70 p-5">
            <h2 className="text-lg font-bold text-neutral-900">Ориентиры методики</h2>
            <p className="mt-2 text-sm text-neutral-700">{hero.methodologyTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li>
                <span className="font-semibold text-neutral-900">Позиция:</span>{" "}
                {methodologyReference.positionLabel}
              </li>
              <li>
                <span className="font-semibold text-neutral-900">Длительность:</span>{" "}
                {methodologyReference.durationLabel}
              </li>
              <li>
                <span className="font-semibold text-neutral-900">
                  Состояние методики:
                </span>{" "}
                {methodologyReference.readinessLabel}
              </li>
            </ul>
          </AppCard>

          <AppCard className="border-amber-200/70 p-5">
            <h2 className="text-lg font-bold text-neutral-900">Discussion for this lesson</h2>
            <div className="mt-3 space-y-2">
              {workspace.communication.lessonScoped.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-300 p-3 text-sm text-neutral-600">
                  В группе пока нет учеников для обсуждения.
                  <a
                    href={`/students/new?groupId=${workspace.classId}`}
                    className="ml-2 text-sky-700 underline underline-offset-2"
                  >
                    Добавить ученика
                  </a>
                </div>
              ) : null}
              {workspace.communication.lessonScoped.map((item) => (
                <article key={item.studentId} className="rounded-xl border border-neutral-200 p-3 text-sm">
                  <p className="font-semibold text-neutral-900">{item.studentName}</p>
                  <a
                    href={`/groups/${workspace.classId}/students/${item.studentId}/communication`}
                    className="text-xs text-sky-700 underline underline-offset-2"
                  >
                    Открыть полный диалог
                  </a>
                  <div className="mt-2 space-y-1">
                    {item.messages.length === 0 ? (
                      <p className="text-neutral-500">Нет сообщений по этому уроку.</p>
                    ) : (
                      item.messages.slice(-3).map((message) => (
                        <p key={message.id} className="text-neutral-700">
                          <span className="font-medium">{message.authorRole}:</span> {message.body}
                        </p>
                      ))
                    )}
                  </div>
                  <form action="/api/teacher/communication" method="POST" className="mt-2 space-y-2">
                    <input type="hidden" name="classId" value={workspace.classId} />
                    <input type="hidden" name="studentId" value={item.studentId} />
                    <input type="hidden" name="topicKind" value="lesson" />
                    <input type="hidden" name="scheduledLessonId" value={workspace.scheduledLessonId} />
                    <input type="hidden" name="redirectTo" value={toScheduledLessonRoute(workspace.scheduledLessonId)} />
                    <textarea name="body" rows={2} className="w-full rounded-xl border border-neutral-300 px-3 py-2" placeholder="Сообщение по уроку" />
                    <button type="submit" className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800">Отправить по уроку</button>
                  </form>
                </article>
              ))}
            </div>
          </AppCard>

          {workspace.communication.homeworkAssignmentId ? (
            <AppCard className="border-fuchsia-200/70 p-5">
              <h2 className="text-lg font-bold text-neutral-900">Discussion for this homework</h2>
              <div className="mt-3 space-y-2">
                {workspace.communication.homeworkScoped.map((item) => (
                  <article key={item.studentId} className="rounded-xl border border-neutral-200 p-3 text-sm">
                    <div className="space-y-1">
                      {item.messages.length === 0 ? (
                        <p className="text-neutral-500">Нет homework-сообщений.</p>
                      ) : (
                        item.messages.slice(-2).map((message) => (
                          <p key={message.id} className="text-neutral-700">
                            <span className="font-medium">{message.authorRole}:</span> {message.body}
                          </p>
                        ))
                      )}
                    </div>
                    <form action="/api/teacher/communication" method="POST" className="mt-2 space-y-2">
                      <input type="hidden" name="classId" value={workspace.classId} />
                      <input type="hidden" name="studentId" value={item.studentId} />
                      <input type="hidden" name="topicKind" value="homework" />
                      <input type="hidden" name="scheduledLessonId" value={workspace.scheduledLessonId} />
                      <input type="hidden" name="scheduledLessonHomeworkAssignmentId" value={workspace.communication.homeworkAssignmentId ?? ""} />
                      <input type="hidden" name="redirectTo" value={toScheduledLessonRoute(workspace.scheduledLessonId)} />
                      <textarea name="body" rows={2} className="w-full rounded-xl border border-neutral-300 px-3 py-2" placeholder="Сообщение по домашнему заданию" />
                      <button type="submit" className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800">Отправить по homework</button>
                    </form>
                  </article>
                ))}
              </div>
            </AppCard>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
