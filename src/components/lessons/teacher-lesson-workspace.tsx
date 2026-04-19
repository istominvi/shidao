"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { TeacherHomeworkPanel } from "@/components/lessons/teacher-homework-panel";
import {
  TeacherLessonTabs,
  type TeacherLessonTabKey,
} from "@/components/lessons/teacher-lesson-tabs";
import { SurfaceCard } from "@/components/ui/surface-card";
import { toScheduledLessonRoute } from "@/lib/auth";

type TeacherLessonWorkspaceProps = {
  workspace: TeacherLessonWorkspaceReadModel;
  runtimeFormFeedback?: {
    success?: string;
    error?: string;
  };
};

export function TeacherLessonWorkspace({
  workspace,
  runtimeFormFeedback,
}: TeacherLessonWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TeacherLessonTabKey>("plan");
  const [liveActionError, setLiveActionError] = useState<string | null>(null);
  const runtime = workspace.projection.runtimeShell;
  const { quickSummary } = workspace.unifiedReadModel;
  const planSteps = workspace.unifiedReadModel.steps;

  const callLiveAction = async (payload: Record<string, unknown>) => {
    setLiveActionError(null);
    const response = await fetch(
      `/api/teacher/lessons/${workspace.scheduledLessonId}/live-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Не удалось обновить live-состояние урока.");
    }
    router.refresh();
  };

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="space-y-5">
        <TeacherLessonTabs
          tabs={["plan", "student_screen", "homework", "conduct", "chat"]}
          activeTab={tab}
          onTabChange={setTab}
        />

        {tab === "plan" ? (
          <TeacherLessonPedagogicalContent
            quickSummary={quickSummary}
            steps={planSteps}
            activeStudentStepId={workspace.liveActiveStepId}
            assetsById={workspace.unifiedReadModel.assetsById}
            onShowOnStudentScreen={(stepId) => {
              const step = workspace.unifiedReadModel.steps.find((item) => item.id === stepId);
              if (!step) return;
              void callLiveAction({
                action: "set_step",
                stepId: step.id,
                stepOrder: step.order,
              }).catch((error) => {
                setLiveActionError(
                  error instanceof Error ? error.message : "Не удалось показать шаг ученикам.",
                );
              });
            }}
          />
        ) : null}

        {tab === "student_screen" ? (
          <LessonStudentContentPanel
            source={workspace.studentContent.source}
            unavailableReason={workspace.studentContent.unavailableReason}
            steps={workspace.unifiedReadModel.steps}
            assetsById={workspace.unifiedReadModel.assetsById}
            previewHref={`${toScheduledLessonRoute(workspace.scheduledLessonId)}?view=learner-preview`}
            mode="teacher_preview"
            controlledStepId={workspace.liveActiveStepId ?? undefined}
          />
        ) : null}

        {tab === "homework" ? (
          <SurfaceCard title="Домашнее задание">
            <TeacherHomeworkPanel
              homework={workspace.homework}
              scheduledLessonId={workspace.scheduledLessonId}
            />
          </SurfaceCard>
        ) : null}

        {tab === "conduct" ? (
          <SurfaceCard
            title="Проведение занятия"
            description="Обновляйте рабочий статус и заметки по этому занятию."
          >
            <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <p className="font-semibold">
                {workspace.liveState.runtimeStatus === "in_progress"
                  ? "Идёт занятие"
                  : workspace.liveState.runtimeStatus === "completed"
                    ? "Урок завершён"
                    : workspace.liveState.runtimeStatus === "cancelled"
                      ? "Урок отменён"
                      : "Урок запланирован"}
              </p>
              <p className="mt-1">
                Сейчас у учеников: Шаг {workspace.unifiedReadModel.steps.find((step) => step.id === workspace.liveActiveStepId)?.order ?? 1}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold" onClick={() => void callLiveAction({ action: "start" }).catch((error) => setLiveActionError(error instanceof Error ? error.message : "Не удалось начать урок."))}>
                  Начать урок
                </button>
                <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold" onClick={() => void callLiveAction({ action: "previous" }).catch((error) => setLiveActionError(error instanceof Error ? error.message : "Не удалось переключить шаг."))}>
                  Предыдущий шаг
                </button>
                <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold" onClick={() => void callLiveAction({ action: "next" }).catch((error) => setLiveActionError(error instanceof Error ? error.message : "Не удалось переключить шаг."))}>
                  Следующий шаг
                </button>
                <button type="button" className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => void callLiveAction({ action: "complete" }).catch((error) => setLiveActionError(error instanceof Error ? error.message : "Не удалось завершить урок."))}>
                  Завершить урок
                </button>
              </div>
              {liveActionError ? (
                <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">{liveActionError}</p>
              ) : null}
            </div>

            {runtimeFormFeedback?.success ? (
              <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
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
          </SurfaceCard>
        ) : null}

        {tab === "chat" ? (
          <SurfaceCard title="Чат">

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                По уроку
              </h3>
              {workspace.communication.lessonScoped.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-300 p-3 text-sm text-neutral-600">
                  В группе пока нет учеников для обсуждения.
                  <a
                    href={`/groups/${workspace.classId}`}
                    className="ml-2 text-sky-700 underline underline-offset-2"
                  >
                    Добавить ученика
                  </a>
                </div>
              ) : null}
              {workspace.communication.lessonScoped.map((item) => (
                <article
                  key={item.studentId}
                  className="rounded-xl border border-neutral-200 p-3 text-sm"
                >
                  <p className="font-semibold text-neutral-900">
                    {item.studentName}
                  </p>
                  <a
                    href={`/groups/${workspace.classId}/students/${item.studentId}/communication`}
                    className="text-xs text-sky-700 underline underline-offset-2"
                  >
                    Открыть полный диалог
                  </a>
                  <div className="mt-2 space-y-1">
                    {item.messages.length === 0 ? (
                      <p className="text-neutral-500">
                        Нет сообщений по этому уроку.
                      </p>
                    ) : (
                      item.messages.slice(-3).map((message) => (
                        <p key={message.id} className="text-neutral-700">
                          <span className="font-medium">
                            {message.authorRole}:
                          </span>{" "}
                          {message.body}
                        </p>
                      ))
                    )}
                  </div>
                  <form
                    action="/api/teacher/communication"
                    method="POST"
                    className="mt-2 space-y-2"
                  >
                    <input
                      type="hidden"
                      name="classId"
                      value={workspace.classId}
                    />
                    <input
                      type="hidden"
                      name="studentId"
                      value={item.studentId}
                    />
                    <input type="hidden" name="topicKind" value="lesson" />
                    <input
                      type="hidden"
                      name="scheduledLessonId"
                      value={workspace.scheduledLessonId}
                    />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={toScheduledLessonRoute(
                        workspace.scheduledLessonId,
                      )}
                    />
                    <textarea
                      name="body"
                      rows={2}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      placeholder="Сообщение по уроку"
                    />
                    <button
                      type="submit"
                      className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800"
                    >
                      Отправить по уроку
                    </button>
                  </form>
                </article>
              ))}
            </section>

            {workspace.communication.homeworkAssignmentId ? (
              <section className="mt-5 space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  По домашнему заданию
                </h3>
                {workspace.communication.homeworkScoped.map((item) => (
                  <article
                    key={item.studentId}
                    className="rounded-xl border border-neutral-200 p-3 text-sm"
                  >
                    <div className="space-y-1">
                      {item.messages.length === 0 ? (
                        <p className="text-neutral-500">
                          Нет сообщений по домашнему заданию.
                        </p>
                      ) : (
                        item.messages.slice(-2).map((message) => (
                          <p key={message.id} className="text-neutral-700">
                            <span className="font-medium">
                              {message.authorRole}:
                            </span>{" "}
                            {message.body}
                          </p>
                        ))
                      )}
                    </div>
                    <form
                      action="/api/teacher/communication"
                      method="POST"
                      className="mt-2 space-y-2"
                    >
                      <input
                        type="hidden"
                        name="classId"
                        value={workspace.classId}
                      />
                      <input
                        type="hidden"
                        name="studentId"
                        value={item.studentId}
                      />
                      <input type="hidden" name="topicKind" value="homework" />
                      <input
                        type="hidden"
                        name="scheduledLessonId"
                        value={workspace.scheduledLessonId}
                      />
                      <input
                        type="hidden"
                        name="scheduledLessonHomeworkAssignmentId"
                        value={
                          workspace.communication.homeworkAssignmentId ?? ""
                        }
                      />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={toScheduledLessonRoute(
                          workspace.scheduledLessonId,
                        )}
                      />
                      <textarea
                        name="body"
                        rows={2}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                        placeholder="Сообщение по домашнему заданию"
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800"
                      >
                        Отправить по домашнему заданию
                      </button>
                    </form>
                  </article>
                ))}
              </section>
            ) : null}
          </SurfaceCard>
        ) : null}
      </section>
    </div>
  );
}
