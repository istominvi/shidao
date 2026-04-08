"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpenText, ChevronDown, FolderPlus, Search, UserPlus } from "lucide-react";
import { ROUTES } from "@/lib/auth";
import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";
import { TeacherScheduleCard } from "./teacher-schedule-card";

type TeacherDashboardProps = {
  readModel: TeacherDashboardOperationsReadModel;
};

const ACTION_ICONS = {
  "Добавить группу": FolderPlus,
  "Добавить ученика": UserPlus,
} as const;

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
          Рабочий центр: быстрые действия, группы и недельный график.
        </p>
        <div className="mt-4">
          <Link
            href={ROUTES.methodologies}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            <BookOpenText className="h-4 w-4" aria-hidden="true" />
            <span>Методики</span>
          </Link>
        </div>
      </section>

      <TeacherScheduleCard schedule={readModel.schedule} />

      <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
        <h2 className="text-xl font-black text-neutral-950">Мои группы</h2>

        <div className="teacher-control-rail mt-4">
          {readModel.actions.map((action) => {
            const Icon = ACTION_ICONS[action.label as keyof typeof ACTION_ICONS] ?? FolderPlus;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="teacher-control teacher-control-button"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{action.label}</span>
              </Link>
            );
          })}
          <div className="teacher-select-wrap">
            <select
              name="methodology"
              value={readModel.groups.filters.methodology}
              onChange={(event) => setParam("methodology", event.target.value)}
              className="teacher-control teacher-control-select"
            >
              <option value="">Все методики</option>
              {readModel.groups.filters.methodologyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="teacher-select-icon h-4 w-4" aria-hidden="true" />
          </div>
          <div className="teacher-search-wrap">
            <Search className="teacher-search-icon h-4 w-4" aria-hidden="true" />
            <input
              name="q"
              defaultValue={readModel.groups.filters.search}
              placeholder="Поиск группы"
              className="teacher-control teacher-control-search"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setParam("q", (event.target as HTMLInputElement).value.trim());
                }
              }}
              onBlur={(event) => setParam("q", event.target.value.trim())}
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Группа</th>
                <th className="px-4 py-3">Методика</th>
                <th className="px-4 py-3">Ученики</th>
                <th className="px-4 py-3">Прогресс</th>
                <th className="px-4 py-3">Следующее занятие</th>
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
                  <td className="px-4 py-3 text-neutral-700">{group.methodologyLabel ?? "Не назначена"}</td>
                  <td className="px-4 py-3 text-neutral-700">{group.studentCount}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
          {readModel.groups.rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-500">По текущим фильтрам групп не найдено.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
