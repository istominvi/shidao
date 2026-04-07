import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
  getTeacherGroupOverview,
} from "@/lib/server/teacher-groups";

export default async function TeacherGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const resolution = await resolveAccessPolicy();

  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherGroupsAccess(resolution);
  const { groupId } = await params;
  const readModel = await getTeacherGroupOverview({ teacherId, groupId });

  if (!readModel) {
    notFound();
  }

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <header className="landing-surface rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_72px_rgba(15,23,42,0.12)] md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Группа</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-neutral-950 md:text-4xl">
            {readModel.group.label}
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-700 md:text-base">
            Группа — основной рабочий контекст преподавателя: состав учеников, методология и расписание занятий.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-700">
            <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1">
              Ученики: {readModel.group.studentCount}
            </span>
            {readModel.group.assignedMethodologyTitle ? (
              <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1">
                Методология: {readModel.group.assignedMethodologyTitle}
              </span>
            ) : (
              <span className="rounded-full border border-dashed border-neutral-300 bg-white/90 px-3 py-1 text-neutral-500">
                Методология для группы пока не определена
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={ROUTES.studentsNew} className="landing-btn landing-btn-muted text-xs">
              Добавить ученика
            </Link>
            <Link
              href={`${ROUTES.lessons}?groupId=${encodeURIComponent(readModel.group.id)}`}
              className="landing-btn landing-btn-muted text-xs"
            >
              Занятия этой группы
            </Link>
          </div>
        </header>

        <section className="landing-surface rounded-3xl border border-white/80 p-5">
          <h2 className="text-xl font-bold text-neutral-950">Ученики группы</h2>
          {readModel.students.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Ученики пока не добавлены.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.students.map((student) => (
                <li key={student.id}>{student.displayName}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="landing-surface rounded-3xl border border-white/80 p-5">
            <h2 className="text-xl font-bold text-neutral-950">Ближайшие занятия</h2>
            {readModel.upcomingLessons.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">Пока нет запланированных занятий.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm text-neutral-700">
                {readModel.upcomingLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={lesson.href} className="font-semibold text-sky-700 underline underline-offset-2">
                      {lesson.title}
                    </Link>
                    <div>
                      {lesson.dateTimeLabel} · {lesson.statusLabel}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="landing-surface rounded-3xl border border-white/80 p-5">
            <h2 className="text-xl font-bold text-neutral-950">Недавние занятия</h2>
            {readModel.recentLessons.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">История занятий пока пустая.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm text-neutral-700">
                {readModel.recentLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={lesson.href} className="font-semibold text-sky-700 underline underline-offset-2">
                      {lesson.title}
                    </Link>
                    <div>
                      {lesson.dateTimeLabel} · {lesson.statusLabel}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <p className="text-sm text-neutral-700">
          <Link href={ROUTES.lessons} className="font-semibold text-sky-700 underline underline-offset-2">
            Открыть глобальный индекс занятий
          </Link>
        </p>
      </div>
    </main>
  );
}
