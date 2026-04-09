"use client";

import Link from "next/link";
import type { TeacherScheduleEvent } from "./teacher-schedule-types";

type Props = {
  event: TeacherScheduleEvent | null;
};

function formatDateLabel(isoDate: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function TeacherScheduleDetailsPanel({ event }: Props) {
  if (!event) {
    return (
      <aside className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
        Выберите занятие в расписании, чтобы увидеть детали и перейти в рабочее пространство урока.
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Выбранное занятие</p>
      <h3 className="mt-2 text-lg font-bold text-neutral-950">{event.lessonTitle}</h3>
      <p className="mt-1 text-sm text-neutral-600">{event.groupLabel}</p>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Дата</dt>
          <dd className="font-medium text-neutral-900">{formatDateLabel(event.isoDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Время</dt>
          <dd className="font-medium text-neutral-900">{event.timeRangeLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Формат</dt>
          <dd className="font-medium text-neutral-900">{event.formatLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Статус</dt>
          <dd className="font-medium text-neutral-900">{event.statusLabel}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <Link href={event.href} className="inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
          Открыть урок
        </Link>
      </div>
    </aside>
  );
}
