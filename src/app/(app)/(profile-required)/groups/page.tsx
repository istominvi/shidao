import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toGroupRoute } from "@/lib/auth";
import { listMethodologiesAdmin } from "@/lib/server/lesson-content-repository";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
  createTeacherGroup,
} from "@/lib/server/teacher-groups";
import { getTeacherGroupsIndexOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";

export default async function TeacherGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    methodology?: string;
    status?: string;
    create?: string;
    error?: string;
  }>;
}) {
  const resolution = await resolveAccessPolicy();

  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherGroupsAccess(resolution);
  const query = await searchParams;
  const methodologies = await listMethodologiesAdmin();
  const isCreateModalOpen = query.create === "1";

  async function createGroupAction(formData: FormData) {
    "use server";

    let createdClassId = "";

    try {
      const actionResolution = await resolveAccessPolicy();
      const { teacherId: actionTeacherId } = assertTeacherGroupsAccess(actionResolution);
      const name = String(formData.get("name") ?? "").trim();
      const methodologyId = String(formData.get("methodologyId") ?? "").trim();

      const created = await createTeacherGroup({
        teacherId: actionTeacherId,
        name,
        methodologyId,
      });
      createdClassId = created.classId;
      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось создать группу.";
      const params = new URLSearchParams();
      params.set("create", "1");
      params.set("error", message);
      redirect(`${ROUTES.groups}?${params.toString()}`);
    }

    redirect(toGroupRoute(createdClassId));
  }

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
            <Link href={`${ROUTES.groups}?create=1`} className="landing-btn landing-btn-primary">
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
              <option value="">Все методики</option>
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
                  <th className="pb-2 pr-4">Методика</th>
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

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <Link
            href={ROUTES.groups}
            className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[1px]"
            aria-label="Закрыть модалку создания группы"
          />
          <section className="relative z-10 w-full max-w-lg landing-surface rounded-3xl border border-white/80 p-6 shadow-[0_24px_72px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Создание группы</p>
                <h2 className="mt-2 text-2xl font-black text-neutral-950">Добавить группу</h2>
                <p className="mt-2 text-sm text-neutral-700">Группа создаётся сразу с выбранной методикой.</p>
              </div>
              <Link href={ROUTES.groups} className="text-sm text-neutral-500 underline underline-offset-2">Отмена</Link>
            </div>
            {query.error ? (
              <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{query.error}</p>
            ) : null}
            <form action={createGroupAction} className="mt-4 space-y-3">
              <label className="field-label" htmlFor="group-name">Название группы</label>
              <input id="group-name" name="name" required className="field-input" placeholder="Например, Лисички 6-7" />
              <label className="field-label" htmlFor="group-methodology">Методика</label>
              <select id="group-methodology" name="methodologyId" className="field-input" required defaultValue="">
                <option value="" disabled>Выберите методику</option>
                {methodologies.map((methodology) => (
                  <option key={methodology.id} value={methodology.id}>
                    {methodology.title}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 pt-1">
                <Link href={ROUTES.groups} className="landing-btn landing-btn-muted">Отмена</Link>
                <button type="submit" className="landing-btn landing-btn-primary">Создать группу</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
