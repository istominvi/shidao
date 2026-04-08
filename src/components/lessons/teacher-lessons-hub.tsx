import Link from "next/link";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { ROUTES } from "@/lib/auth";
import type { TeacherLessonsHubReadModel } from "@/lib/server/teacher-lessons-hub";

type TeacherLessonsHubProps = {
  hub: TeacherLessonsHubReadModel;
  createLessonAction: (formData: FormData) => Promise<void>;
  feedback?: {
    success?: string;
    error?: string;
  };
};

function statusChipTone(statusLabel: string) {
  if (statusLabel.includes("Идёт")) {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }

  if (statusLabel.includes("Проведено")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }

  if (statusLabel.includes("Отмен")) {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }

  return "bg-amber-100 text-amber-800 border-amber-200";
}

function LessonsSection({
  title,
  emptyText,
  cards,
}: {
  title: string;
  emptyText: string;
  cards: TeacherLessonsHubReadModel["upcoming"];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-neutral-950">
          {title}
        </h2>
        <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-xs font-medium text-neutral-600">
          {cards.length}
        </span>
      </div>

      {cards.length === 0 ? (
        <AppCard className="border-dashed border-neutral-300 p-5 text-sm text-neutral-600" as="article">
          {emptyText}
        </AppCard>
      ) : (
        <div className="grid gap-3">
          {cards.map((lesson) => (
            <AppCard
              key={lesson.scheduledLessonId}
              className="p-5"
              as="article"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-950">{lesson.title}</h3>
                  {lesson.methodologyTitle ? (
                    <p className="mt-1 text-sm text-neutral-600">
                      По методике «{lesson.methodologyTitle}»
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusChipTone(lesson.statusLabel)}`}
                >
                  {lesson.statusLabel}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-700">
                <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1">
                  {lesson.classLabel}
                </span>
                <span className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1">
                  {lesson.dateTimeLabel}
                </span>
                <span className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1">
                  {lesson.formatLabel}
                </span>
              </div>

              {lesson.runtimeNotesSummary ? (
                <p className="mt-3 text-sm text-neutral-700">{lesson.runtimeNotesSummary}</p>
              ) : null}

              <div className="mt-4">
                <Link
                  href={lesson.workspaceHref}
                  className="inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
                >
                  Открыть занятие
                </Link>
              </div>
            </AppCard>
          ))}
        </div>
      )}
    </section>
  );
}

export function TeacherLessonsHub({
  hub,
  createLessonAction,
  feedback,
}: TeacherLessonsHubProps) {
  return (
    <div className="space-y-8 lg:space-y-10">
      <AppPageHeader
        eyebrow="Рабочее пространство преподавателя"
        title="Глобальный индекс занятий"
        description={(
          <>
            Это кросс-групповое расписание: здесь видно занятия по всем группам.
            Основной рабочий контекст преподавателя — страницы групп.
          </>
        )}
        actions={(
          <Link href={ROUTES.groups} className="font-semibold text-sky-700 underline underline-offset-2">
            Перейти к группам
          </Link>
        )}
      />

      <AppCard className="p-5 md:p-6">
        <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-950">
          Запланировать занятие (пока глобально)
        </h2>

        {feedback?.success ? (
          <p className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {feedback.success}
          </p>
        ) : null}

        {feedback?.error ? (
          <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {feedback.error}
          </p>
        ) : null}

        <form action={createLessonAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-neutral-700">
            <span>Группа</span>
            <select
              name="classId"
              required
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Выберите группу
              </option>
              {hub.classOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Методологический урок</span>
            <select
              name="methodologyLessonId"
              required
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Выберите урок
              </option>
              {hub.methodologyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Дата</span>
            <input
              type="date"
              name="date"
              required
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Время</span>
            <input
              type="time"
              name="time"
              required
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Формат</span>
            <select
              name="format"
              required
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              defaultValue="online"
            >
              <option value="online">online</option>
              <option value="offline">offline</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Ссылка на встречу (для online)</span>
            <input
              type="url"
              name="meetingLink"
              placeholder="https://"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm text-neutral-700 md:col-span-2">
            <span>Место (для offline)</span>
            <input
              type="text"
              name="place"
              placeholder="Кабинет / адрес"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Запланировать занятие (пока глобально)
            </button>
          </div>
        </form>
      </AppCard>

      <LessonsSection
        title="Ближайшие занятия"
        emptyText="Пока нет запланированных занятий."
        cards={hub.upcoming}
      />

      <LessonsSection
        title="Прошедшие занятия"
        emptyText="Проведённых занятий пока нет."
        cards={hub.past}
      />
    </div>
  );
}
