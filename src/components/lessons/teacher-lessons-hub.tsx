"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { TeacherScheduleBoard } from "@/components/schedule/teacher-schedule-board";
import { TeacherScheduleDetailsPanel } from "@/components/schedule/teacher-schedule-details-panel";
import { TeacherScheduleToolbar } from "@/components/schedule/teacher-schedule-toolbar";
import type { TeacherScheduleToolbarState } from "@/components/schedule/teacher-schedule-types";
import { ROUTES } from "@/lib/auth";
import type { TeacherLessonsHubReadModel } from "@/lib/server/teacher-lessons-hub";

type TeacherLessonsHubProps = {
  hub: TeacherLessonsHubReadModel;
  createLessonAction: (formData: FormData) => Promise<void>;
  feedback?: {
    success?: string;
    error?: string;
  };
  hasExplicitViewParam: boolean;
  initialState: TeacherScheduleToolbarState;
};


export function TeacherLessonsHub({
  hub,
  createLessonAction,
  feedback,
  initialState,
  hasExplicitViewParam,
}: TeacherLessonsHubProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [toolbarState, setToolbarState] = useState<TeacherScheduleToolbarState>(initialState);
  const [monthFocusDateIso, setMonthFocusDateIso] = useState(initialState.date);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scheduleFormat, setScheduleFormat] = useState<"online" | "offline">("online");

  useEffect(() => {
    if (hasExplicitViewParam) return;
    const media = window.matchMedia("(max-width: 767px)");
    if (media.matches) {
      setToolbarState((prev) => ({ ...prev, view: "list" }));
    }
  }, [hasExplicitViewParam]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", toolbarState.view);
    params.set("date", toolbarState.date);
    if (toolbarState.search.trim()) params.set("search", toolbarState.search.trim());
    if (toolbarState.classId) params.set("classId", toolbarState.classId);
    if (toolbarState.methodologyLessonId) params.set("methodologyLessonId", toolbarState.methodologyLessonId);
    if (toolbarState.format) params.set("format", toolbarState.format);
    if (toolbarState.status) params.set("status", toolbarState.status);
    if (feedback?.error) params.set("error", feedback.error);
    if (feedback?.success) params.set("saved", feedback.success);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [feedback?.error, feedback?.success, pathname, router, toolbarState]);

  const filteredEvents = useMemo(() => {
    const query = toolbarState.search.trim().toLowerCase();
    return hub.schedule.events.filter((event) => {
      if (toolbarState.classId && event.classId !== toolbarState.classId) return false;
      if (toolbarState.methodologyLessonId && event.methodologyLessonId !== toolbarState.methodologyLessonId) return false;
      if (toolbarState.format && event.format !== toolbarState.format) return false;
      if (toolbarState.status && event.status !== toolbarState.status) return false;
      if (query && !event.groupLabel.toLowerCase().includes(query) && !event.lessonTitle.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [hub.schedule.events, toolbarState]);

  const selectedEvent = useMemo(() => {
    const nowTs = Date.parse(hub.schedule.nowIso);
    const sorted = [...filteredEvents].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    if (selectedEventId) {
      const direct = sorted.find((event) => event.id === selectedEventId);
      if (direct) return direct;
    }
    const inProgress = sorted.find((event) => {
      const start = Date.parse(event.startsAt);
      const end = Date.parse(event.endsAt);
      return start <= nowTs && end >= nowTs;
    });
    if (inProgress) return inProgress;
    const next = sorted.find((event) => Date.parse(event.startsAt) >= nowTs);
    if (next) return next;
    if (toolbarState.view === "month") {
      const dayEvent = sorted.find((event) => event.isoDate === monthFocusDateIso);
      if (dayEvent) return dayEvent;
    }
    return sorted[0] ?? null;
  }, [filteredEvents, hub.schedule.nowIso, monthFocusDateIso, selectedEventId, toolbarState.view]);

  useEffect(() => {
    setSelectedEventId(selectedEvent?.id ?? null);
  }, [selectedEvent?.id]);

  function updateToolbar(patch: Partial<TeacherScheduleToolbarState>) {
    setToolbarState((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <AppPageHeader
        title="Расписание"
        description="Единое рабочее пространство по занятиям ваших групп."
        actions={(
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={() => updateToolbar({ date: hub.schedule.defaultDateIso })} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50">
              Сегодня
            </button>
            <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-full bg-neutral-900 px-4 py-1.5 font-semibold text-white hover:bg-neutral-800">
              Запланировать занятие
            </button>
            <Link href={ROUTES.groups} className="font-semibold text-sky-700 underline underline-offset-2">К группам</Link>
          </div>
        )}
      />

      <AppCard className="p-4 md:p-5">
        <TeacherScheduleToolbar
          state={toolbarState}
          onChange={updateToolbar}
          classOptions={hub.schedule.filters.classOptions}
          methodologyOptions={hub.schedule.filters.methodologyOptions}
          formatOptions={hub.schedule.filters.formatOptions}
          statusOptions={hub.schedule.filters.statusOptions}
        />

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <TeacherScheduleBoard
            events={filteredEvents}
            viewMode={toolbarState.view}
            activeDateIso={toolbarState.date}
            monthFocusDateIso={monthFocusDateIso}
            nowIso={hub.schedule.nowIso}
            interactionMode="select"
            selectedEventId={selectedEvent?.id ?? null}
            onSelectEvent={setSelectedEventId}
            onActiveDateChange={(iso) => updateToolbar({ date: iso })}
            onMonthFocusDateChange={setMonthFocusDateIso}
            emptyLabel="Нет занятий по текущим фильтрам."
          />
          <TeacherScheduleDetailsPanel event={selectedEvent} />
        </div>
      </AppCard>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[120]">
          <button aria-label="Закрыть форму планирования" type="button" className="absolute inset-0 bg-neutral-950/40" onClick={() => setDrawerOpen(false)} />
          <section role="dialog" aria-modal="true" className="absolute right-0 top-0 z-10 h-full w-full max-w-xl overflow-y-auto border-l border-neutral-200 bg-white p-5 shadow-2xl max-md:max-w-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-neutral-950">Запланировать занятие</h2>
                <p className="mt-1 text-sm text-neutral-600">Сформируйте занятие без выхода из расписания.</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full border border-neutral-300 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50">Закрыть</button>
            </div>

            <div className="mt-4">
              {feedback?.success ? <p className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{feedback.success}</p> : null}
              {feedback?.error ? <p className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{feedback.error}</p> : null}

              <form action={createLessonAction} className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm text-neutral-700"><span>Группа</span><select name="classId" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" defaultValue=""><option value="" disabled>Выберите группу</option>{hub.classOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                <label className="space-y-1 text-sm text-neutral-700"><span>Методологический урок</span><select name="methodologyLessonId" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" defaultValue=""><option value="" disabled>Выберите урок</option>{hub.methodologyOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                <label className="space-y-1 text-sm text-neutral-700"><span>Дата</span><input type="date" name="date" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" /></label>
                <label className="space-y-1 text-sm text-neutral-700"><span>Время</span><input type="time" name="time" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" /></label>
                <label className="space-y-1 text-sm text-neutral-700"><span>Формат</span><select name="format" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={scheduleFormat} onChange={(event) => setScheduleFormat(event.target.value as "online" | "offline")}><option value="online">Онлайн</option><option value="offline">Офлайн</option></select></label>
                {scheduleFormat === "online" ? (
                  <label className="space-y-1 text-sm text-neutral-700"><span>Ссылка на встречу</span><input type="url" name="meetingLink" placeholder="https://" className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" required /></label>
                ) : (
                  <label className="space-y-1 text-sm text-neutral-700"><span>Место проведения</span><input type="text" name="place" placeholder="Кабинет / адрес" className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" required /></label>
                )}
                <div className="md:col-span-2">
                  <button type="submit" className="inline-flex items-center rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">Запланировать занятие</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
