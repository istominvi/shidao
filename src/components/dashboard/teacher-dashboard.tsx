"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/lib/auth";
import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";
import { TeacherScheduleCard } from "./teacher-schedule-card";

type TeacherDashboardProps = {
  readModel: TeacherDashboardOperationsReadModel;
};

const ACTION_ICONS: Record<string, string> = {
  "Добавить группу": "➕",
  "Добавить ученика": "👤",
};

function statusTone(status: string) {
  if (status === "attention") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "scheduled") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-neutral-100 text-neutral-700 border-neutral-200";
}

export function TeacherDashboard({ readModel }: TeacherDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-6">
        <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950 md:text-4xl">
          Операционный дашборд преподавателя
        </h1>
        <p className="mt-2 text-sm text-neutral-700">
          Рабочий центр: быстрые действия, группы, недельный график и точки внимания.
        </p>
        <div className="mt-4">
          <Link
            href={ROUTES.methodologies}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            <span aria-hidden="true">📚</span>
            <span>Методики</span>
          </Link>
        </div>
      </section>

      <TeacherScheduleCard schedule={readModel.schedule} />

      <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-neutral-950">Мои группы</h2>
          <span className="text-xs text-neutral-500">Таблица — основной режим</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {readModel.actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
            >
              <span aria-hidden="true">{ACTION_ICONS[action.label] ?? "•"}</span>
              <span>{action.label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <select
            name="methodology"
            value={readModel.groups.filters.methodology}
            onChange={(event) => setParam("methodology", event.target.value)}
            className="field-input cursor-pointer"
          >
            <option value="">Все методики</option>
            {readModel.groups.filters.methodologyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            name="status"
            value={readModel.groups.filters.status}
            onChange={(event) => setParam("status", event.target.value)}
            className="field-input cursor-pointer"
          >
            <option value="">Все статусы</option>
            <option value="attention">Требует внимания</option>
            <option value="scheduled">По плану</option>
            <option value="on_track">Стабильно</option>
          </select>
          <input
            name="q"
            defaultValue={readModel.groups.filters.search}
            placeholder="Поиск группы"
            className="field-input"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setParam("q", (event.target as HTMLInputElement).value.trim());
              }
            }}
            onBlur={(event) => setParam("q", event.target.value.trim())}
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Группа</th>
                <th className="px-4 py-3">Ученики</th>
                <th className="px-4 py-3">Методика</th>
                <th className="px-4 py-3">Прогресс</th>
                <th className="px-4 py-3">Следующее занятие</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {readModel.groups.rows.map((group) => (
                <tr
                  key={group.id}
                  className="cursor-pointer border-t border-neutral-200 align-top transition hover:bg-sky-50/45"
                  onClick={() => router.push(group.groupHref)}
                >
                  <td className="px-4 py-3 font-semibold text-neutral-950">{group.groupLabel}</td>
                  <td className="px-4 py-3 text-neutral-700">{group.studentCount}</td>
                  <td className="px-4 py-3 text-neutral-700">{group.methodologyLabel ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-700">{group.progressLabel}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {group.nextLessonLabel ? (
                      <>
                        <div>{group.nextLessonLabel}</div>
                        <div className="text-xs text-neutral-500">{group.nextLessonTitle}</div>
                      </>
                    ) : (
                      "Не запланировано"
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    <span className={`rounded-full border px-2 py-1 text-xs ${statusTone(group.status)}`}>
                      {group.statusLabel}
                    </span>
                    {group.attentionReasons.length > 0 ? (
                      <div className="mt-1 text-xs text-neutral-500">{group.attentionReasons.join(" · ")}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {readModel.groups.rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-500">По текущим фильтрам групп не найдено.</p>
          ) : null}
        </div>
      </section>


      <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
        <h2 className="text-xl font-black text-neutral-950">Требует внимания</h2>
        <ul className="mt-3 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
          <li>Группы без учеников: {readModel.alerts.groupsWithoutStudents}</li>
          <li>Группы без ближайших занятий: {readModel.alerts.groupsWithoutUpcomingLessons}</li>
          <li>Занятий сегодня: {readModel.alerts.lessonsToday}</li>
        </ul>
      </section>
    </div>
  );
}
