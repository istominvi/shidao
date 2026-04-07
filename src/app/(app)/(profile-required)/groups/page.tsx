import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
  getTeacherGroupsIndex,
} from "@/lib/server/teacher-groups";

export default async function TeacherGroupsPage() {
  const resolution = await resolveAccessPolicy();

  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherGroupsAccess(resolution);
  const readModel = await getTeacherGroupsIndex({ teacherId });

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10">
        <header className="landing-surface rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_72px_rgba(15,23,42,0.12)] md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
            Основной контекст преподавателя
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-neutral-950 md:text-4xl">
            Группы
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700 md:text-base">
            Здесь собраны группы, в контексте которых преподаватель планирует и проводит занятия.
            Глобальный раздел «Занятия» остаётся кросс-групповым индексом расписания.
          </p>
        </header>

        <section className="mt-6 grid gap-3">
          {readModel.groups.length === 0 ? (
            <article className="landing-surface rounded-3xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-600">
              Пока нет доступных групп. После teacher onboarding первая группа создаётся автоматически.
            </article>
          ) : (
            readModel.groups.map((group) => (
              <article key={group.id} className="landing-surface rounded-3xl border border-white/80 p-5">
                <h2 className="text-xl font-bold text-neutral-950">{group.label}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-neutral-700">
                  <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1">
                    Ученики: {group.studentCount}
                  </span>
                  <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1">
                    Ближайших занятий: {group.upcomingLessonCount}
                  </span>
                  {group.assignedMethodologyTitle ? (
                    <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1">
                      Методология: {group.assignedMethodologyTitle}
                    </span>
                  ) : null}
                </div>
                {group.nextLessonLabel ? (
                  <p className="mt-3 text-sm text-neutral-700">Следующее занятие: {group.nextLessonLabel}</p>
                ) : (
                  <p className="mt-3 text-sm text-neutral-500">Занятия для группы пока не запланированы.</p>
                )}
                <div className="mt-4">
                  <Link
                    href={group.href}
                    className="inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
                  >
                    Открыть группу
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
