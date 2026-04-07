import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
} from "@/lib/server/teacher-groups";
import { getTeacherGroupsIndexOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";

export default async function TeacherGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; methodology?: string; status?: string }>;
}) {
  const resolution = await resolveAccessPolicy();

  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherGroupsAccess(resolution);
  const query = await searchParams;
  const readModel = await getTeacherGroupsIndexOperationsReadModel({
    teacherId,
    search: query.q,
    methodology: query.methodology,
    status: query.status,
  });

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <header className="landing-surface rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_72px_rgba(15,23,42,0.12)] md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
            Полный индекс групп
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-neutral-950 md:text-4xl">
            Группы преподавателя
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700 md:text-base">
            Здесь — весь список групп с операционными полями. Для быстрых ежедневных действий и расписания используйте /dashboard.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={ROUTES.groupsNew} className="landing-btn landing-btn-primary">
              Добавить группу
            </Link>
            <Link href={ROUTES.studentsNew} className="landing-btn landing-btn-muted">
              Добавить ученика
            </Link>
          </div>
        </header>

        <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
          <form className="grid gap-2 md:grid-cols-4">
            <input name="q" defaultValue={readModel.filters.search} placeholder="Поиск группы" className="field-input" />
            <select name="methodology" defaultValue={readModel.filters.methodology} className="field-input">
              <option value="">Все методологии</option>
              {readModel.filters.methodologyOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select name="status" defaultValue={readModel.filters.status} className="field-input">
              <option value="">Все статусы</option>
              <option value="attention">Требует внимания</option>
              <option value="scheduled">По плану</option>
              <option value="on_track">Стабильно</option>
            </select>
            <button type="submit" className="landing-btn landing-btn-muted">Применить</button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="pb-2 pr-4">Группа</th>
                  <th className="pb-2 pr-4">Ученики</th>
                  <th className="pb-2 pr-4">Методология</th>
                  <th className="pb-2 pr-4">Прогресс</th>
                  <th className="pb-2 pr-4">Следующее занятие</th>
                  <th className="pb-2 pr-4">Статус</th>
                  <th className="pb-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {readModel.rows.map((group) => (
                  <tr key={group.id} className="border-t border-neutral-200/80 align-top">
                    <td className="py-3 pr-4 font-semibold text-neutral-950">{group.groupLabel}</td>
                    <td className="py-3 pr-4">{group.studentCount}</td>
                    <td className="py-3 pr-4">{group.methodologyLabel ?? "—"}</td>
                    <td className="py-3 pr-4">{group.progressLabel}</td>
                    <td className="py-3 pr-4">{group.nextLessonLabel ?? "Не запланировано"}</td>
                    <td className="py-3 pr-4">{group.statusLabel}</td>
                    <td className="py-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <Link href={group.groupHref} className="text-sky-700 underline underline-offset-2">Открыть группу</Link>
                        <Link href={group.groupLessonsHref} className="text-sky-700 underline underline-offset-2">Занятия группы</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {readModel.rows.length === 0 ? <p className="pt-4 text-sm text-neutral-500">По запросу групп не найдено.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
