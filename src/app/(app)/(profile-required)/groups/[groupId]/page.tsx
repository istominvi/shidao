import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { TopNav } from "@/components/top-nav";
import { TeacherTableCard, TeacherTableEmptyState } from "@/components/dashboard/teacher-table-card";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
  createTeacherGroupScopedLesson,
  getTeacherGroupOverview,
  parseGroupScopedLessonFormData,
} from "@/lib/server/teacher-groups";

function withMessage(
  groupId: string,
  type: "saved" | "error",
  message: string,
) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `${ROUTES.groups}/${encodeURIComponent(groupId)}?${params.toString()}`;
}

export default async function TeacherGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
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

  async function scheduleLessonAction(formData: FormData) {
    "use server";

    try {
      const actionResolution = await resolveAccessPolicy();
      const { teacherId: actionTeacherId } = assertTeacherGroupsAccess(actionResolution);
      const payload = parseGroupScopedLessonFormData(formData);
      const lesson = await createTeacherGroupScopedLesson({
        teacherId: actionTeacherId,
        groupId,
        payload,
      });

      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
      revalidatePath(`${ROUTES.groups}/${groupId}`);
      redirect(`/lessons/${lesson.id}`);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось запланировать занятие для группы.";
      redirect(withMessage(groupId, "error", message));
    }
  }

  const query = await searchParams;

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader
          backHref={ROUTES.groups}
          backLabel="Группы"
          title={readModel.group.label}
          description={readModel.methodology.assignedMethodologyShortDescription ?? undefined}
          meta={(
            <>
              {query.saved ? (
                <p className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{query.saved}</p>
              ) : null}
              {query.error ? (
                <p className="w-full rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{query.error}</p>
              ) : null}
              <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-sm text-neutral-700">
                Ученики: {readModel.group.studentCount}
              </span>
              <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-sm text-neutral-700">
                Прогресс: {readModel.group.progressLabel}
              </span>
              {readModel.group.nextLessonLabel ? (
                <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-sm text-neutral-700">
                  Следующее занятие: {readModel.group.nextLessonLabel}
                </span>
              ) : null}
              {readModel.group.assignedMethodologyTitle ? (
                <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-sm text-neutral-700">
                  Методика: {readModel.group.assignedMethodologyTitle}
                </span>
              ) : (
                <span className="rounded-full border border-dashed border-neutral-300 bg-white/90 px-3 py-1 text-sm text-neutral-500">
                  Методика: не указана (legacy-группа)
                </span>
              )}
            </>
          )}
          actions={(
            <>
              <Link href={`${ROUTES.studentsNew}?groupId=${encodeURIComponent(readModel.group.id)}`} className="landing-btn landing-btn-muted text-xs">
                Добавить ученика
              </Link>
              <Link
                href={`${ROUTES.lessons}?groupId=${encodeURIComponent(readModel.group.id)}`}
                className="landing-btn landing-btn-muted text-xs"
              >
                Открыть global lessons index
              </Link>
            </>
          )}
        />

        <TeacherTableCard
          title="Ученики группы"
          headerAction={(
            <Link href={`${ROUTES.studentsNew}?groupId=${encodeURIComponent(readModel.group.id)}`} className="text-sm text-sky-700 underline underline-offset-2">
              Создать и добавить ученика
            </Link>
          )}
        >
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Ученик</th>
                <th className="px-4 py-3">Логин</th>
                <th className="px-4 py-3">Коммуникация</th>
              </tr>
            </thead>
            <tbody>
              {readModel.students.map((student) => (
                <tr key={student.id} className="border-t border-neutral-200 align-top transition hover:bg-sky-50/45">
                  <td className="px-4 py-3 font-semibold text-neutral-950">{student.displayName}</td>
                  <td className="px-4 py-3 text-neutral-700">{student.login ? `@${student.login}` : "—"}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    <Link
                      href={`${ROUTES.groups}/${encodeURIComponent(groupId)}/students/${encodeURIComponent(student.id)}/communication`}
                      className="text-xs text-sky-700 underline underline-offset-2"
                    >
                      Открыть коммуникацию
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {readModel.students.length === 0 ? (
            <TeacherTableEmptyState text="В группе пока нет учеников." />
          ) : null}
        </TeacherTableCard>

        <AppCard className="p-5">
          <h2 className="text-xl font-bold text-neutral-950">Запланировать занятие в контексте группы</h2>
          {!readModel.schedule.canSchedule ? (
            <p className="mt-2 text-sm text-amber-700">Для этой legacy-группы методика не задана. Планирование занятий недоступно.</p>
          ) : (
            <form action={scheduleLessonAction} className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Урок методики</span>
                <select name="methodologyLessonId" required className="field-input" defaultValue="">
                  <option value="" disabled>Выберите урок</option>
                  {readModel.schedule.lessonOptions.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>{lesson.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Формат</span>
                <select name="format" required className="field-input" defaultValue="online">
                  <option value="online">online</option>
                  <option value="offline">offline</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Дата</span>
                <input type="date" name="date" required className="field-input" />
              </label>
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Время</span>
                <input type="time" name="time" required className="field-input" />
              </label>
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Ссылка на встречу (для online)</span>
                <input type="url" name="meetingLink" placeholder="https://" className="field-input" />
              </label>
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Место (для offline)</span>
                <input type="text" name="place" placeholder="Кабинет / адрес" className="field-input" />
              </label>
              <div className="md:col-span-2">
                <button type="submit" className="landing-btn landing-btn-primary text-xs">Запланировать занятие</button>
              </div>
            </form>
          )}
        </AppCard>

        <section className="grid gap-4 md:grid-cols-2">
          <AppCard as="article" className="p-5">
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
          </AppCard>

          <AppCard as="article" className="p-5">
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
          </AppCard>
        </section>
      </div>
    </main>
  );
}
