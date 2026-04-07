import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ROUTES } from "@/lib/auth";
import type { TeacherDashboardReadModel } from "@/lib/server/teacher-groups";
import { getDevTeacherScheduledLessonId } from "@/lib/server/teacher-lesson-workspace";

type TeacherDashboardProps = {
  readModel: TeacherDashboardReadModel;
};

export function TeacherDashboard({ readModel }: TeacherDashboardProps) {
  const scheduledLessonId = getDevTeacherScheduledLessonId();

  return (
    <DashboardShell
      roleLabel="Преподаватель"
      roleTone="teacher"
      title="Обзор преподавателя"
      subtitle="Основной операционный контекст — группа. Отсюда можно перейти в группы и посмотреть ближайшие занятия по всем группам, а глобальный раздел «Занятия» остаётся вторичным индексом расписания."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(112,183,255,0.26),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Мои группы</h3>
          <p className="mt-2 text-sm text-neutral-700">
            Управление обучением строится через конкретные группы: состав учеников,
            связанная методология и занятия.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {readModel.groups.length === 0 ? (
              <li className="text-neutral-500">
                Пока нет групп. После онбординга первая группа создаётся автоматически.
              </li>
            ) : (
              readModel.groups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={group.href}
                    className="font-semibold text-sky-700 underline underline-offset-2"
                  >
                    {group.label}
                  </Link>{" "}
                  · {group.studentCount} учен.
                </li>
              ))
            )}
          </ul>
          <p className="mt-3 text-sm text-neutral-700">
            <Link
              href={ROUTES.groups}
              className="font-semibold text-sky-700 underline underline-offset-2"
            >
              Открыть все группы
            </Link>
          </p>
        </article>

        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(201,180,255,0.28),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Ближайшие занятия</h3>
          <ul className="mt-2 space-y-2 text-sm text-neutral-700">
            {readModel.upcomingLessons.length === 0 ? (
              <li className="text-neutral-500">Пока нет запланированных занятий.</li>
            ) : (
              readModel.upcomingLessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    href={lesson.href}
                    className="font-semibold text-sky-700 underline underline-offset-2"
                  >
                    {lesson.title}
                  </Link>{" "}
                  · {lesson.groupLabel} · {lesson.dateTimeLabel}
                </li>
              ))
            )}
          </ul>
          <p className="mt-3 text-sm text-neutral-700">
            <Link
              href={ROUTES.lessons}
              className="font-semibold text-sky-700 underline underline-offset-2"
            >
              Открыть глобальный индекс занятий
            </Link>
          </p>
          {scheduledLessonId ? (
            <p className="mt-3 text-xs text-neutral-500">
              DEV shortcut workspace доступен через <code>DEV_TEACHER_WORKSPACE_SCHEDULED_LESSON_ID</code>.
            </p>
          ) : null}
        </article>
      </div>
    </DashboardShell>
  );
}
