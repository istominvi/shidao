"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { TeacherScheduleSurface } from "@/components/schedule/teacher-schedule-surface";
import { TeacherLessonsCarousel } from "@/components/schedule/teacher-lessons-carousel";
import type { ScheduleViewMode } from "@/components/dashboard/teacher-schedule-utils";
import { ROUTES } from "@/lib/auth";
import type { TeacherLessonsHubReadModel } from "@/lib/server/teacher-lessons-hub";

type TeacherLessonsHubProps = {
  hub: TeacherLessonsHubReadModel;
  createLessonAction: (formData: FormData) => Promise<void>;
  feedback?: {
    success?: string;
    error?: string;
  };
  initialState: {
    view: ScheduleViewMode;
    date: string;
  };
};

export function TeacherLessonsHub({
  hub,
  createLessonAction,
  feedback,
  initialState,
}: TeacherLessonsHubProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<ScheduleViewMode>(initialState.view);
  const [date, setDate] = useState(initialState.date);
  const [scheduleFormat, setScheduleFormat] = useState<"online" | "offline">("online");

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("date", date);
    if (feedback?.error) params.set("error", feedback.error);
    if (feedback?.success) params.set("saved", feedback.success);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [date, feedback?.error, feedback?.success, pathname, router, view]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <AppPageHeader
        title="Расписание"
        description="Все занятия по вашим группам в одном месте."
        actions={(
          <div className="flex items-center gap-3 text-sm">
            <Link href={ROUTES.groups} className="font-semibold text-sky-700 underline underline-offset-2">
              К группам
            </Link>
          </div>
        )}
      />

      <TeacherLessonsCarousel events={hub.schedule.events} nowIso={hub.schedule.nowIso} />

      <TeacherScheduleSurface
        events={hub.schedule.events}
        nowIso={hub.schedule.nowIso}
        defaultDateIso={hub.schedule.defaultDateIso}
        initialView={initialState.view}
        onStateChange={(state) => {
          setView(state.view);
          setDate(state.date);
        }}
      />

      <AppCard className="p-5 md:p-6" muted>
        <details>
          <summary className="cursor-pointer list-none text-base font-bold text-neutral-900">
            Запланировать занятие
          </summary>
          <div className="mt-3">
            {feedback?.success ? (
              <p className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {feedback.success}
              </p>
            ) : null}

            {feedback?.error ? (
              <p className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {feedback.error}
              </p>
            ) : null}

            <form action={createLessonAction} className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Группа</span>
                <select name="classId" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" defaultValue="">
                  <option value="" disabled>Выберите группу</option>
                  {hub.classOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Методологический урок</span>
                <select name="methodologyLessonId" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" defaultValue="">
                  <option value="" disabled>Выберите урок</option>
                  {hub.methodologyOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Дата</span>
                <input type="date" name="date" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Время</span>
                <input type="time" name="time" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Формат</span>
                <select name="format" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={scheduleFormat} onChange={(event) => setScheduleFormat(event.target.value as "online" | "offline")}>
                  <option value="online">Онлайн</option>
                  <option value="offline">Офлайн</option>
                </select>
              </label>

              {scheduleFormat === "online" ? (
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Ссылка на встречу</span>
                  <input type="url" name="meetingLink" placeholder="https://" className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" required />
                </label>
              ) : (
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Место проведения</span>
                  <input type="text" name="place" placeholder="Кабинет / адрес" className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" required />
                </label>
              )}

              <div className="md:col-span-2">
                <button type="submit" className="inline-flex items-center rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                  Запланировать занятие
                </button>
              </div>
            </form>
          </div>
        </details>
      </AppCard>
    </div>
  );
}
