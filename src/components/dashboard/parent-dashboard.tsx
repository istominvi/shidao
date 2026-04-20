"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  DashboardEmptyState,
  DashboardSection,
} from "@/components/dashboard/dashboard-section";
import { toScheduledLessonRoute } from "@/lib/auth";

type ParentContext = {
  studentId: string;
  studentName: string;
  login: string;
  classes: Array<{
    classId: string;
    className: string;
    schoolId: string;
    schoolName: string;
  }>;
};

type ParentHomeworkItem = {
  studentId: string;
  scheduledLessonId: string;
  lessonTitle: string;
  homeworkTitle: string;
  dueAt: string | null;
  statusLabel: string;
  assignmentComment: string | null;
  reviewNote: string | null;
  score: number | null;
  maxScore: number | null;
};

type ParentMessage = {
  id: string;
  authorRole: "teacher" | "student" | "parent";
  body: string;
  scheduledLessonId: string | null;
  scheduledLessonHomeworkAssignmentId: string | null;
  createdAt: string;
};

type ParentLesson = {
  scheduledLessonId: string;
  lessonTitle: string;
  startsAt: string;
  startsAtIso: string;
  statusLabel: string;
};

type ParentDashboardProps = {
  childrenContexts: ParentContext[];
  homeworkByStudent: Record<string, ParentHomeworkItem[]>;
  communicationByStudent: Record<string, ParentMessage[]>;
  lessonsByStudent: Record<string, ParentLesson[]>;
};

function getAuthorRoleLabel(role: ParentMessage["authorRole"]) {
  if (role === "teacher") return "Преподаватель";
  if (role === "student") return "Ученик";
  return "Родитель";
}

function formatClassLabel(classes: ParentContext["classes"]) {
  if (classes.length === 0) return "Группа пока не назначена";
  return classes.map((item) => item.className).join(", ");
}

function UpcomingLessons({ lessons }: { lessons: ParentLesson[] }) {
  if (lessons.length === 0) {
    return <DashboardEmptyState>Ближайший урок пока не запланирован.</DashboardEmptyState>;
  }

  return (
    <ul className="space-y-2">
      {lessons.slice(0, 5).map((lesson) => (
        <li key={lesson.scheduledLessonId} className="rounded-xl border border-neutral-200 p-3">
          <p className="font-semibold text-neutral-900">{lesson.lessonTitle}</p>
          <p className="text-xs text-neutral-600">{lesson.startsAt}</p>
          <p className="mt-1 text-xs text-neutral-600">{lesson.statusLabel}</p>
          <Link
            href={toScheduledLessonRoute(lesson.scheduledLessonId)}
            className="mt-2 inline-flex rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-800"
          >
            Открыть урок
          </Link>
        </li>
      ))}
    </ul>
  );
}

function HomeworkList({ items }: { items: ParentHomeworkItem[] }) {
  if (items.length === 0) {
    return <DashboardEmptyState>Нет активных заданий.</DashboardEmptyState>;
  }

  return (
    <ul className="space-y-2">
      {items.slice(0, 5).map((item) => (
        <li key={`${item.scheduledLessonId}-${item.homeworkTitle}`} className="rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-neutral-900">{item.homeworkTitle}</p>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
              {item.statusLabel}
            </span>
          </div>
          <p className="text-xs text-neutral-500">{item.lessonTitle}</p>
          <p className="mt-1 text-xs text-neutral-600">Срок: {item.dueAt ?? "без срока"}</p>
          {item.score !== null && item.maxScore !== null ? (
            <p className="mt-1 text-xs text-neutral-700">Результат: {item.score} / {item.maxScore}</p>
          ) : null}
          {item.assignmentComment ? (
            <p className="mt-1 text-xs text-neutral-700">Комментарий к заданию: {item.assignmentComment}</p>
          ) : null}
          {item.reviewNote ? (
            <p className="mt-1 text-xs text-neutral-700">Комментарий после проверки: {item.reviewNote}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function MessagesList({ messages }: { messages: ParentMessage[] }) {
  if (messages.length === 0) {
    return <DashboardEmptyState>Сообщений пока нет.</DashboardEmptyState>;
  }

  return (
    <ul className="space-y-2">
      {messages.slice(0, 5).map((message) => (
        <li key={message.id} className="rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700">
          <p>
            <span className="font-medium text-neutral-900">{getAuthorRoleLabel(message.authorRole)}:</span>{" "}
            {message.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ParentDashboard({
  childrenContexts,
  homeworkByStudent,
  communicationByStudent,
  lessonsByStudent,
}: ParentDashboardProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    childrenContexts[0]?.studentId ?? null,
  );

  const selectedChild = useMemo(
    () => childrenContexts.find((child) => child.studentId === selectedStudentId) ?? null,
    [childrenContexts, selectedStudentId],
  );

  const selectedLessons = selectedChild ? lessonsByStudent[selectedChild.studentId] ?? [] : [];
  const selectedHomework = selectedChild ? homeworkByStudent[selectedChild.studentId] ?? [] : [];
  const selectedMessages = selectedChild
    ? [...(communicationByStudent[selectedChild.studentId] ?? [])]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const nextLesson = selectedLessons[0] ?? null;
  const activeHomeworkCount = selectedHomework.length;
  const latestMessage = selectedMessages[0] ?? null;

  return (
    <DashboardShell
      roleTone="parent"
    >
      {childrenContexts.length === 0 ? (
        <DashboardSection
          title="Детей пока нет"
          description="Когда преподаватель привяжет ученика к вашему аккаунту, здесь появятся уроки, домашние задания и сообщения."
        >
          <DashboardEmptyState>
            Когда преподаватель привяжет ученика к вашему аккаунту, здесь появятся уроки, домашние задания и сообщения.
          </DashboardEmptyState>
        </DashboardSection>
      ) : selectedChild ? (
        <div className="space-y-4">
          {childrenContexts.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {childrenContexts.map((child) => {
                const isActive = child.studentId === selectedChild.studentId;
                return (
                  <button
                    key={child.studentId}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSelectedStudentId(child.studentId)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    {child.studentName}
                  </button>
                );
              })}
            </div>
          ) : null}

          <section className="rounded-2xl border border-neutral-200 bg-white/70 p-4">
            <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <dt className="text-xs text-neutral-500">Ребёнок</dt>
                <dd className="font-semibold text-neutral-900">{selectedChild.studentName}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Логин ученика</dt>
                <dd className="font-semibold text-neutral-900">{selectedChild.login}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Группа</dt>
                <dd className="font-semibold text-neutral-900">{formatClassLabel(selectedChild.classes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Ближайший урок</dt>
                <dd className="font-semibold text-neutral-900">
                  {nextLesson ? `${nextLesson.lessonTitle} · ${nextLesson.startsAt}` : "Ближайший урок пока не запланирован"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Домашние задания</dt>
                <dd className="font-semibold text-neutral-900">
                  {activeHomeworkCount > 0 ? `${activeHomeworkCount} активных` : "Нет активных заданий"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Последнее сообщение</dt>
                <dd className="font-semibold text-neutral-900">
                  {latestMessage ? latestMessage.body : "Сообщений пока нет"}
                </dd>
              </div>
            </dl>
          </section>

          <div className="grid gap-3 lg:grid-cols-3">
            <DashboardSection title="Ближайшие уроки">
              <UpcomingLessons lessons={selectedLessons} />
            </DashboardSection>
            <DashboardSection title="Домашние задания">
              <HomeworkList items={selectedHomework} />
            </DashboardSection>
            <DashboardSection title="Комментарии и сообщения" description="Режим просмотра">
              <MessagesList messages={selectedMessages} />
            </DashboardSection>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
