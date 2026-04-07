import Link from "next/link";
import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";

type TeacherDashboardProps = {
  readModel: TeacherDashboardOperationsReadModel;
};

function statusTone(status: string) {
  if (status === "attention") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "scheduled") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-neutral-100 text-neutral-700 border-neutral-200";
}

export function TeacherDashboard({ readModel }: TeacherDashboardProps) {
  return (
    <div className="space-y-6">
      <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
        <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950 md:text-4xl">
          Операционный дашборд преподавателя
        </h1>
        <p className="mt-2 text-sm text-neutral-700">
          Рабочий центр: быстрые действия, группы, недельный график и точки внимания.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {readModel.actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                action.tone === "primary"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900"
              }`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-neutral-950">Мои группы</h2>
          <span className="text-xs text-neutral-500">Таблица — основной режим</span>
        </div>

        <form className="mt-4 grid gap-2 md:grid-cols-4">
          <input
            name="q"
            defaultValue={readModel.groups.filters.search}
            placeholder="Поиск группы"
            className="field-input"
          />
          <select
            name="methodology"
            defaultValue={readModel.groups.filters.methodology}
            className="field-input"
          >
            <option value="">Все методологии</option>
            {readModel.groups.filters.methodologyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={readModel.groups.filters.status} className="field-input">
            <option value="">Все статусы</option>
            <option value="attention">Требует внимания</option>
            <option value="scheduled">По плану</option>
            <option value="on_track">Стабильно</option>
          </select>
          <button type="submit" className="landing-btn landing-btn-muted">
            Применить фильтры
          </button>
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
              {readModel.groups.rows.map((group) => (
                <tr key={group.id} className="border-t border-neutral-200/80 align-top">
                  <td className="py-3 pr-4 font-semibold text-neutral-950">{group.groupLabel}</td>
                  <td className="py-3 pr-4 text-neutral-700">{group.studentCount}</td>
                  <td className="py-3 pr-4 text-neutral-700">{group.methodologyLabel ?? "—"}</td>
                  <td className="py-3 pr-4 text-neutral-700">{group.progressLabel}</td>
                  <td className="py-3 pr-4 text-neutral-700">
                    {group.nextLessonLabel ? (
                      <>
                        <div>{group.nextLessonLabel}</div>
                        <div className="text-xs text-neutral-500">{group.nextLessonTitle}</div>
                      </>
                    ) : (
                      "Не запланировано"
                    )}
                  </td>
                  <td className="py-3 pr-4 text-neutral-700">
                    <span className={`rounded-full border px-2 py-1 text-xs ${statusTone(group.status)}`}>
                      {group.statusLabel}
                    </span>
                    {group.attentionReasons.length > 0 ? (
                      <div className="mt-1 text-xs text-neutral-500">{group.attentionReasons.join(" · ")}</div>
                    ) : null}
                  </td>
                  <td className="py-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <Link href={group.groupHref} className="text-sky-700 underline underline-offset-2">
                        Открыть группу
                      </Link>
                      {group.nextLessonHref ? (
                        <Link href={group.nextLessonHref} className="text-sky-700 underline underline-offset-2">
                          Открыть следующее занятие
                        </Link>
                      ) : null}
                      <Link href={group.groupLessonsHref} className="text-sky-700 underline underline-offset-2">
                        Занятия группы
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {readModel.groups.rows.length === 0 ? (
            <p className="pt-4 text-sm text-neutral-500">По текущим фильтрам групп не найдено.</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black text-neutral-950">Расписание на 7 дней</h2>
            <p className="text-xs text-neutral-500">
              Всего: {readModel.schedule.totalLessons}
              {readModel.schedule.nextLessonLabel ? ` · Следующее: ${readModel.schedule.nextLessonLabel}` : ""}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {readModel.schedule.days.length === 0 ? (
              <p className="text-sm text-neutral-500">На этой неделе занятий пока нет.</p>
            ) : (
              readModel.schedule.days.map((day) => (
                <div key={day.isoDate} className="rounded-2xl border border-neutral-200 bg-white/80 p-3">
                  <p className="text-sm font-semibold text-neutral-900">
                    {day.label}
                    {day.isToday ? <span className="ml-2 text-xs text-sky-700">Сегодня</span> : null}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {day.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex flex-wrap items-center gap-x-2 text-neutral-700">
                        <span className="font-semibold">{lesson.timeLabel}</span>
                        <span>{lesson.groupLabel}</span>
                        <span>· {lesson.lessonTitle}</span>
                        <span className="text-xs text-neutral-500">· {lesson.statusLabel}</span>
                        <Link href={lesson.href} className="text-xs text-sky-700 underline underline-offset-2">
                          Открыть
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
          <h2 className="text-xl font-black text-neutral-950">Требует внимания</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            <li>Группы без учеников: {readModel.alerts.groupsWithoutStudents}</li>
            <li>Группы без методологии: {readModel.alerts.groupsWithoutMethodology}</li>
            <li>Группы без ближайших занятий: {readModel.alerts.groupsWithoutUpcomingLessons}</li>
            <li>Занятий сегодня: {readModel.alerts.lessonsToday}</li>
          </ul>
          <div className="mt-4 space-y-2 text-xs text-neutral-600">
            {readModel.alerts.attentionGroups.slice(0, 5).map((group) => (
              <p key={group.id}>
                <Link href={group.href} className="font-semibold text-sky-700 underline underline-offset-2">
                  {group.label}
                </Link>{" "}
                — {group.reasons.join(", ")}
              </p>
            ))}
            {readModel.alerts.attentionGroups.length === 0 ? <p>Критичных сигналов нет.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
