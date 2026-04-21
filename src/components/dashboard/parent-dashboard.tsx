"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  UserRound,
} from "lucide-react";
import { toScheduledLessonRoute } from "@/lib/auth";
import { AppPageHeader } from "@/components/app/page-header";
import {
  DashboardEmptyState,
  DashboardSection,
} from "@/components/dashboard/dashboard-section";
import { TopNav } from "@/components/top-nav";
import { SurfaceCard } from "@/components/ui/surface-card";

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
  if (statusLabel === "Идёт")
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (statusLabel === "Завершено")
    return "bg-neutral-100 text-neutral-700 border-neutral-200";
  if (statusLabel === "Отменено")
    return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-sky-100 text-sky-700 border-sky-200";
}

function getHomeworkStatusTone(statusLabel: string) {
  if (statusLabel === "Проверено")
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (statusLabel === "Сдано") return "bg-sky-100 text-sky-700 border-sky-200";
  if (statusLabel === "Нужна доработка")
    return "bg-rose-100 text-rose-700 border-rose-200";
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

function UpcomingLessons({ lessons }: { lessons: ParentLesson[] }) {
  if (lessons.length === 0) {
    return (
      <DashboardEmptyState>
        Ближайший урок пока не запланирован.
      </DashboardEmptyState>
    );
  }

  return (
    <ul className="space-y-2.5">
      {lessons.slice(0, 5).map((lesson, index) => (
        <li
          key={lesson.scheduledLessonId}
          className={`rounded-2xl border bg-white/80 p-3.5 shadow-sm ${
            index === 0
              ? "border-sky-200 bg-sky-50/60"
              : "border-neutral-200/80"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={toScheduledLessonRoute(lesson.scheduledLessonId)}
                className="font-semibold text-neutral-900 hover:text-sky-700"
              >
                {lesson.lessonTitle}
              </Link>
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
            <p className="font-semibold text-neutral-900">
              {item.homeworkTitle}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getHomeworkStatusTone(item.statusLabel)}`}
            >
              {item.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Урок: {item.lessonTitle}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Срок: {formatDateTimeLabel(item.dueAt)}
          </p>
          {item.score !== null && item.maxScore !== null ? (
            <p className="mt-1 text-xs text-neutral-700">
              Результат: {item.score} / {item.maxScore}
            </p>
          ) : null}
          {item.assignmentComment ? (
            <p className="mt-1 text-xs text-neutral-700">
              Комментарий к заданию: {item.assignmentComment}
            </p>
          ) : null}
          {item.reviewNote ? (
            <p className="mt-1 text-xs text-neutral-700">
              Комментарий после проверки: {item.reviewNote}
            </p>
          ) : null}
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
    if (
      !childrenContexts.some((child) => child.studentId === selectedStudentId)
    ) {
      setSelectedStudentId(childrenContexts[0]?.studentId ?? null);
    }
  }, [childrenContexts, selectedStudentId]);

  const selectedChild = useMemo(
    () =>
      childrenContexts.find((child) => child.studentId === selectedStudentId) ??
      null,
    [childrenContexts, selectedStudentId],
  );

  const selectedLessons = selectedChild
    ? (lessonsByStudent[selectedChild.studentId] ?? [])
    : [];
  const selectedHomework = selectedChild
    ? (homeworkByStudent[selectedChild.studentId] ?? [])
    : [];
  const selectedMessages = selectedChild
    ? [...(communicationByStudent[selectedChild.studentId] ?? [])].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt),
      )
    : [];

  const nextLesson = selectedLessons[0] ?? null;
  const latestMessage = selectedMessages[0] ?? null;

  const homeworkStatusDistribution = selectedHomework.reduce<
    Record<string, number>
  >((acc, item) => {
    acc[item.statusLabel] = (acc[item.statusLabel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container app-page-container space-y-6">
        <AppPageHeader title="Кабинет родителя" />
        {childrenContexts.length === 0 ? (
          <SurfaceCard>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
              Детей пока нет
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Когда преподаватель привяжет ученика к вашему аккаунту, здесь
              появятся уроки, домашние задания и сообщения.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
              <AlertCircle className="size-3.5" />
              Родительский кабинет работает в режиме просмотра.
            </p>
          </SurfaceCard>
        ) : selectedChild ? (
          <div className="space-y-4 md:space-y-5">
            {childrenContexts.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {childrenContexts.map((child) => (
                  <button
                    key={child.studentId}
                    type="button"
                    aria-pressed={child.studentId === selectedChild.studentId}
                    onClick={() => setSelectedStudentId(child.studentId)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      child.studentId === selectedChild.studentId
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    <span className="mr-1.5 inline-flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 via-violet-50 to-amber-100 text-xs text-neutral-700">
                      {getInitials(child.studentName)}
                    </span>
                    {child.studentName}
                  </button>
                ))}
              </div>
            ) : null}

            <SurfaceCard className="rounded-3xl p-5 md:p-6">
              <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Ученик
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                    {selectedChild.studentName}
                  </h2>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-start gap-2 text-neutral-700">
                      <UserRound className="mt-0.5 size-4 text-neutral-500" />
                      <div>
                        <dt className="text-xs text-neutral-500">
                          Логин ученика
                        </dt>
                        <dd className="font-medium text-neutral-900">
                          {selectedChild.login}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-neutral-700">
                      <BookOpenCheck className="mt-0.5 size-4 text-neutral-500" />
                      <div>
                        <dt className="text-xs text-neutral-500">Группа</dt>
                        <dd className="font-medium text-neutral-900">
                          {formatClassLabel(selectedChild.classes)}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-neutral-700">
                      <CalendarDays className="mt-0.5 size-4 text-neutral-500" />
                      <div>
                        <dt className="text-xs text-neutral-500">
                          Следующий урок
                        </dt>
                        <dd className="font-medium text-neutral-900">
                          {nextLesson
                            ? `${nextLesson.lessonTitle} · ${nextLesson.startsAt}`
                            : "Ближайший урок пока не запланирован"}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-white p-3 ring-1 ring-sky-100">
                      <p className="text-xs text-neutral-500">
                        Ближайшие уроки
                      </p>
                      <p className="mt-1 text-2xl font-bold text-neutral-900">
                        {Math.min(selectedLessons.length, 5)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-3 ring-1 ring-amber-100">
                      <p className="text-xs text-neutral-500">Активные ДЗ</p>
                      <p className="mt-1 text-2xl font-bold text-neutral-900">
                        {selectedHomework.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-white p-3 ring-1 ring-violet-100">
                      <p className="text-xs text-neutral-500">Сообщения</p>
                      <p className="mt-1 text-2xl font-bold text-neutral-900">
                        {selectedMessages.length}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-3">
                    <p className="text-xs font-semibold text-neutral-600">
                      Статусы домашних заданий
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(homeworkStatusDistribution).length ===
                      0 ? (
                        <span className="text-xs text-neutral-500">
                          Пока нет назначенных заданий
                        </span>
                      ) : (
                        Object.entries(homeworkStatusDistribution).map(
                          ([status, count]) => (
                            <span
                              key={status}
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getHomeworkStatusTone(status)}`}
                            >
                              {status}: {count}
                            </span>
                          ),
                        )
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200/80 bg-white p-3 text-xs text-neutral-600">
                    <p className="font-semibold text-neutral-700">
                      Последний комментарий
                    </p>
                    <p className="mt-1 truncate">
                      {latestMessage
                        ? `${getAuthorRoleLabel(latestMessage.authorRole)}: ${latestMessage.body}`
                        : "Сообщений пока нет"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                <DashboardSection title="Ближайшие уроки">
                  <UpcomingLessons lessons={selectedLessons} />
                </DashboardSection>
                <DashboardSection title="Домашние задания">
                  <HomeworkList items={selectedHomework} />
                </DashboardSection>
              </div>
            </SurfaceCard>
          </div>
        ) : null}
      </div>
    </main>
  );
}
