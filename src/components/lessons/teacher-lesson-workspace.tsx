"use client";

import { useState } from "react";
import Link from "next/link";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { LessonContextChip } from "@/components/lessons/lesson-context-chip";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { TeacherHomeworkPanel } from "@/components/lessons/teacher-homework-panel";
import { TeacherLessonTabs, type TeacherLessonTabKey } from "@/components/lessons/teacher-lesson-tabs";
import { toMethodologyLessonRoute, toScheduledLessonRoute } from "@/lib/auth";

type TeacherLessonWorkspaceProps = {
  workspace: TeacherLessonWorkspaceReadModel;
  runtimeFormFeedback?: {
    success?: string;
    error?: string;
  };
};

function statusBadgeTone(statusLabel: string) {
  if (statusLabel.includes("Идёт")) return "bg-sky-100 text-sky-800 border-sky-200";
  if (statusLabel.includes("Заверш")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (statusLabel.includes("Отмен")) return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export function TeacherLessonWorkspace({ workspace, runtimeFormFeedback }: TeacherLessonWorkspaceProps) {
  const [tab, setTab] = useState<TeacherLessonTabKey>("plan");
  const runtime = workspace.projection.runtimeShell;
  const { hero, quickSummary, lessonFlow } = workspace.presentation;

  return (
    <div className="space-y-8 lg:space-y-10">
      <AppPageHeader
        eyebrow="Рабочее пространство преподавателя"
        title={hero.lessonTitle}
        description={hero.lessonEssence}
        meta={(
          <>
            <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1.5 text-sm font-medium text-neutral-900">{hero.groupLabel}</span>
            <span className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm text-neutral-700">{hero.dateTimeLabel}</span>
            <span className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm text-neutral-700">{hero.formatLabel}</span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusBadgeTone(hero.statusLabel)}`}>{hero.statusLabel}</span>
            <LessonContextChip context="schedule" />
          </>
        )}
        actions={(
          <div className="text-sm text-neutral-600">
            <p>{hero.methodologyLine}</p>
            {workspace.sourceLesson ? (
              <p className="mt-1">
                Основан на уроке методики ·{" "}
                <Link href={toMethodologyLessonRoute(workspace.sourceLesson.methodologySlug, workspace.sourceLesson.lessonId)} className="text-sky-700 underline underline-offset-2">
                  Открыть исходный урок
                </Link>
              </p>
            ) : null}
          </div>
        )}
      />

      <section className="space-y-5">
        <TeacherLessonTabs tabs={["plan", "content", "homework", "conduct", "chat"]} activeTab={tab} onTabChange={setTab} />

        {tab === "plan" ? <TeacherLessonPedagogicalContent quickSummary={quickSummary} lessonFlow={lessonFlow} /> : null}

        {tab === "content" ? (
          <LessonStudentContentPanel
            source={workspace.studentContent.source}
            unavailableReason={workspace.studentContent.unavailableReason}
            assetsById={workspace.studentContent.assetsById}
            previewHref={`${toScheduledLessonRoute(workspace.scheduledLessonId)}?view=learner-preview`}
          />
        ) : null}

        {tab === "homework" ? (
          <AppCard className="border-sky-200/70 p-5">
            <h2 className="text-lg font-bold text-neutral-900">Домашнее задание</h2>
            <TeacherHomeworkPanel homework={workspace.homework} scheduledLessonId={workspace.scheduledLessonId} />
          </AppCard>
        ) : null}

        {tab === "conduct" ? (
          <AppCard className="border-emerald-200/70 p-5 md:p-6">
            <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-900">Проведение занятия</h2>
            <p className="mt-2 text-sm text-neutral-700">Обновляйте рабочий статус и заметки по этому занятию.</p>

            {runtimeFormFeedback?.success ? (
              <p className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{runtimeFormFeedback.success}</p>
            ) : null}
            {runtimeFormFeedback?.error ? (
              <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{runtimeFormFeedback.error}</p>
            ) : null}

            <form className="mt-4 space-y-4" action={`/api/teacher/lessons/${workspace.scheduledLessonId}/runtime`} method="POST">
              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">Статус занятия</span>
                <select name="runtimeStatus" defaultValue={runtime.runtimeStatus} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900">
                  <option value="planned">Запланировано</option>
                  <option value="in_progress">Идёт занятие</option>
                  <option value="completed">Завершено</option>
                  <option value="cancelled">Отменено</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">Короткая заметка перед уроком</span>
                <textarea name="runtimeNotesSummary" rows={2} defaultValue={runtime.runtimeNotesSummary ?? ""} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900" />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">Заметки по проведению</span>
                <textarea name="runtimeNotes" rows={4} defaultValue={workspace.projection.runtimeNotes ?? ""} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900" />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">Итоги после занятия</span>
                <textarea name="outcomeNotes" rows={4} defaultValue={workspace.projection.outcomeNotes ?? ""} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900" />
              </label>

              <button type="submit" className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800">
                Сохранить изменения
              </button>
            </form>
          </AppCard>
        ) : null}

        {tab === "chat" ? (
          <AppCard className="border-amber-200/70 p-5 md:p-6">
            <h2 className="text-xl font-bold text-neutral-900">Чат</h2>

            <section className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">По уроку</h3>
              {workspace.communication.lessonScoped.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-300 p-3 text-sm text-neutral-600">
                  В группе пока нет учеников для обсуждения.
                  <a href={`/students/new?groupId=${workspace.classId}`} className="ml-2 text-sky-700 underline underline-offset-2">
                    Добавить ученика
                  </a>
                </div>
              ) : null}
              {workspace.communication.lessonScoped.map((item) => (
                <article key={item.studentId} className="rounded-xl border border-neutral-200 p-3 text-sm">
                  <p className="font-semibold text-neutral-900">{item.studentName}</p>
                  <a href={`/groups/${workspace.classId}/students/${item.studentId}/communication`} className="text-xs text-sky-700 underline underline-offset-2">
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
            </section>

            {workspace.communication.homeworkAssignmentId ? (
              <section className="mt-5 space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">По домашнему заданию</h3>
                {workspace.communication.homeworkScoped.map((item) => (
                  <article key={item.studentId} className="rounded-xl border border-neutral-200 p-3 text-sm">
                    <div className="space-y-1">
                      {item.messages.length === 0 ? (
                        <p className="text-neutral-500">Нет сообщений по домашнему заданию.</p>
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
                      <button type="submit" className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800">Отправить по домашнему заданию</button>
                    </form>
                  </article>
                ))}
              </section>
            ) : null}
          </AppCard>
        ) : null}
      </section>
    </div>
  );
}
