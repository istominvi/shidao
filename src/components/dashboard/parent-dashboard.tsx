"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/dashboard-section";
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

function formatDateTimeLabel(value: string | null): string {
  if (value === null) return "без срока";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(parsedDate);
}

function getAuthorRoleLabel(role: ParentMessage["authorRole"]) {
  if (role === "teacher") return "Преподаватель";
  if (role === "student") return "Ученик";
  return "Родитель";
}

function getLessonStatusTone(statusLabel: string) {
  if (statusLabel === "Идёт") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (statusLabel === "Завершено") return "bg-neutral-100 text-neutral-700 border-neutral-200";
  if (statusLabel === "Отменено") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-sky-100 text-sky-700 border-sky-200";
}

function getHomeworkStatusTone(statusLabel: string) {
  if (statusLabel === "Проверено") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (statusLabel === "Сдано") return "bg-sky-100 text-sky-700 border-sky-200";
  if (statusLabel === "Нужна доработка") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function formatClassLabel(classes: ParentContext["classes"]) {
  if (classes.length === 0) return "Группа пока не назначена";
  return classes.map((item) => item.className).join(", ");
}

function getInitials(name: string) {
  const [first, second] = name.trim().split(/\s+/);
  return `${first?.[0] ?? "У"}${second?.[0] ?? ""}`.toUpperCase();
}

function ChildOverviewCard({
  child,
  isActive,
  lessonsCount,
  homeworkCount,
  messagesCount,
  nextLessonLabel,
  onClick,
}: {
  child: ParentContext;
  isActive: boolean;
  lessonsCount: number;
  homeworkCount: number;
  messagesCount: number;
  nextLessonLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`group w-full rounded-3xl border bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isActive
          ? "border-sky-300/80 ring-2 ring-sky-200/70"
          : "border-neutral-200/70 hover:border-sky-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 via-violet-50 to-amber-100 text-sm font-semibold text-neutral-700">
          {getInitials(child.studentName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-900">{child.studentName}</p>
          <p className="truncate text-xs text-neutral-500">{child.login}</p>
          <p className="mt-1 truncate text-xs text-neutral-600">{formatClassLabel(child.classes)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium">
        <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">Уроки: {lessonsCount}</span>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">ДЗ: {homeworkCount}</span>
        <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">Сообщения: {messagesCount}</span>
      </div>
      <p className="mt-3 text-xs text-neutral-600">{nextLessonLabel}</p>
    </button>
  );
}

function UpcomingLessons({ lessons }: { lessons: ParentLesson[] }) {
  if (lessons.length === 0) {
    return <DashboardEmptyState>Ближайший урок пока не запланирован.</DashboardEmptyState>;
  }

  return (
    <ul className="space-y-2.5">
      {lessons.slice(0, 5).map((lesson, index) => (
        <li
          key={lesson.scheduledLessonId}
          className={`rounded-2xl border bg-white/80 p-3.5 shadow-sm ${
            index === 0 ? "border-sky-200 bg-sky-50/60" : "border-neutral-200/80"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-neutral-900">{lesson.lessonTitle}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-600">
                <Clock3 className="size-3.5" />
                {lesson.startsAt}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getLessonStatusTone(lesson.statusLabel)}`}
            >
              {lesson.statusLabel}
            </span>
          </div>
          <Link
            href={toScheduledLessonRoute(lesson.scheduledLessonId)}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:border-neutral-400"
          >
            Открыть урок
            <ChevronRight className="size-3.5" />
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
    <ul className="space-y-2.5">
      {items.slice(0, 5).map((item) => (
        <li
          key={`${item.scheduledLessonId}-${item.homeworkTitle}`}
          className="rounded-2xl border border-neutral-200/80 bg-white/80 p-3.5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-neutral-900">{item.homeworkTitle}</p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getHomeworkStatusTone(item.statusLabel)}`}
            >
              {item.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Урок: {item.lessonTitle}</p>
          <p className="mt-1 text-xs text-neutral-600">Срок: {formatDateTimeLabel(item.dueAt)}</p>
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
    <ul className="space-y-2.5">
      {messages.slice(0, 5).map((message) => (
        <li
          key={message.id}
          className="rounded-2xl border border-neutral-200/80 bg-white/80 p-3.5 text-sm text-neutral-700 shadow-sm"
        >
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <MessageCircle className="size-3.5" />
            {getAuthorRoleLabel(message.authorRole)}
          </p>
          <p className="mt-1.5">{message.body}</p>
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

  useEffect(() => {
    if (!childrenContexts.some((child) => child.studentId === selectedStudentId)) {
      setSelectedStudentId(childrenContexts[0]?.studentId ?? null);
    }
  }, [childrenContexts, selectedStudentId]);

  const selectedChild = useMemo(
    () => childrenContexts.find((child) => child.studentId === selectedStudentId) ?? null,
    [childrenContexts, selectedStudentId],
  );

  const selectedLessons = selectedChild ? lessonsByStudent[selectedChild.studentId] ?? [] : [];
  const selectedHomework = selectedChild ? homeworkByStudent[selectedChild.studentId] ?? [] : [];
  const selectedMessages = selectedChild
    ? [...(communicationByStudent[selectedChild.studentId] ?? [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )
    : [];

  const nextLesson = selectedLessons[0] ?? null;
  const latestMessage = selectedMessages[0] ?? null;

  const homeworkStatusDistribution = selectedHomework.reduce<Record<string, number>>((acc, item) => {
    acc[item.statusLabel] = (acc[item.statusLabel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardShell
      roleLabel="Родитель"
      roleTone="parent"
      title="Кабинет родителя"
      subtitle="Спокойный обзор обучения ребёнка: ближайшие уроки, домашние задания и комментарии преподавателя."
    >
      {childrenContexts.length === 0 ? (
        <section className="surface-card rounded-3xl border border-neutral-200/70 bg-white/80 p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Детей пока нет</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Когда преподаватель привяжет ученика к вашему аккаунту, здесь появятся уроки, домашние
            задания и сообщения.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            <AlertCircle className="size-3.5" />
            Родительский кабинет работает в режиме просмотра.
          </p>
        </section>
      ) : selectedChild ? (
        <div className="space-y-4 md:space-y-5">
          <div
            className={
              childrenContexts.length > 1
                ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                : "grid grid-cols-1"
            }
          >
            {childrenContexts.map((child) => {
              const childLessons = lessonsByStudent[child.studentId] ?? [];
              const childHomework = homeworkByStudent[child.studentId] ?? [];
              const childMessages = communicationByStudent[child.studentId] ?? [];
              const childNextLesson = childLessons[0];

              return (
                <ChildOverviewCard
                  key={child.studentId}
                  child={child}
                  isActive={child.studentId === selectedChild.studentId}
                  lessonsCount={Math.min(childLessons.length, 5)}
                  homeworkCount={childHomework.length}
                  messagesCount={childMessages.length}
                  nextLessonLabel={
                    childNextLesson
                      ? `Ближайший урок: ${childNextLesson.startsAt}`
                      : "Ближайший урок пока не запланирован"
                  }
                  onClick={() => setSelectedStudentId(child.studentId)}
                />
              );
            })}
          </div>

          <section className="rounded-3xl border border-neutral-200/70 bg-white/85 p-5 shadow-sm md:p-6">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Учебная сводка
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                  {selectedChild.studentName}
                </h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-neutral-700">
                    <UserRound className="mt-0.5 size-4 text-neutral-500" />
                    <div>
                      <dt className="text-xs text-neutral-500">Логин ученика</dt>
                      <dd className="font-medium text-neutral-900">{selectedChild.login}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-neutral-700">
                    <BookOpenCheck className="mt-0.5 size-4 text-neutral-500" />
                    <div>
                      <dt className="text-xs text-neutral-500">Группа</dt>
                      <dd className="font-medium text-neutral-900">{formatClassLabel(selectedChild.classes)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-neutral-700">
                    <CalendarDays className="mt-0.5 size-4 text-neutral-500" />
                    <div>
                      <dt className="text-xs text-neutral-500">Следующий урок</dt>
                      <dd className="font-medium text-neutral-900">
                        {nextLesson
                          ? `${nextLesson.lessonTitle} · ${nextLesson.startsAt}`
                          : "Ближайший урок пока не запланирован"}
                      </dd>
                    </div>
                  </div>
                </dl>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                  <CheckCircle2 className="size-3.5" />
                  Родитель видит процесс обучения, но не изменяет уроки, задания и переписку.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-white p-3 ring-1 ring-sky-100">
                    <p className="text-xs text-neutral-500">Ближайшие уроки</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-900">{Math.min(selectedLessons.length, 5)}</p>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-3 ring-1 ring-amber-100">
                    <p className="text-xs text-neutral-500">Активные ДЗ</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-900">{selectedHomework.length}</p>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-white p-3 ring-1 ring-violet-100">
                    <p className="text-xs text-neutral-500">Сообщения</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-900">{selectedMessages.length}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-3">
                  <p className="text-xs font-semibold text-neutral-600">Статусы домашних заданий</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(homeworkStatusDistribution).length === 0 ? (
                      <span className="text-xs text-neutral-500">Пока нет назначенных заданий</span>
                    ) : (
                      Object.entries(homeworkStatusDistribution).map(([status, count]) => (
                        <span
                          key={status}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getHomeworkStatusTone(status)}`}
                        >
                          {status}: {count}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200/80 bg-white p-3 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-700">Последний комментарий</p>
                  <p className="mt-1 truncate">
                    {latestMessage ? `${getAuthorRoleLabel(latestMessage.authorRole)}: ${latestMessage.body}` : "Сообщений пока нет"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3 xl:grid-cols-2">
            <DashboardSection title="Ближайшие уроки">
              <UpcomingLessons lessons={selectedLessons} />
            </DashboardSection>
            <DashboardSection title="Домашние задания">
              <HomeworkList items={selectedHomework} />
            </DashboardSection>
          </div>
          <DashboardSection title="Комментарии и сообщения" description="Режим просмотра">
            <MessagesList messages={selectedMessages} />
          </DashboardSection>
        </div>
      ) : null}
    </DashboardShell>
  );
}
