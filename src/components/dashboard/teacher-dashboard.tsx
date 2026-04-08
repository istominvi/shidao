"use client";

import Link from "next/link";
import { BookOpen, ChevronDown, ChevronRight, Plus, Search, UserPlus } from "lucide-react";
import { Fragment, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/lib/auth";
import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";
import { TeacherScheduleCard } from "./teacher-schedule-card";

type TeacherDashboardProps = {
  readModel: TeacherDashboardOperationsReadModel;
};

export function TeacherDashboard({ readModel }: TeacherDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-section dashboard-section-hero">
        <div className="dashboard-section-header">
          <h1 className="dashboard-section-title text-3xl md:text-4xl">Операционный дашборд преподавателя</h1>
          <p className="dashboard-section-description">
            Рабочий центр: быстрые действия, группы и недельный график.
          </p>
        </div>
        <div className="pt-4">
          <Link
            href={ROUTES.methodologies}
            className="dashboard-btn"
          >
            <BookOpen size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Методики</span>
          </Link>
        </div>
      </section>

      <TeacherScheduleCard schedule={readModel.schedule} />

      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2 className="dashboard-section-title">Мои группы</h2>
          <p className="dashboard-section-description">Управляйте настройкой, составом и ближайшими занятиями групп.</p>
        </div>

        <div className="dashboard-toolbar mt-5">
          {readModel.actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="dashboard-control dashboard-btn"
            >
              {action.label === "Добавить группу" ? <Plus size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
              {action.label === "Добавить ученика" ? <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
              <span>{action.label}</span>
            </Link>
          ))}
          <label className="dashboard-control dashboard-select-wrap">
            <select
              name="methodology"
              value={readModel.groups.filters.methodology}
              onChange={(event) => setParam("methodology", event.target.value)}
              className="dashboard-control-input cursor-pointer appearance-none pr-9"
            >
              <option value="">Все методики</option>
              {readModel.groups.filters.methodologyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" className="dashboard-select-chevron" />
          </label>
          <label className="dashboard-control dashboard-select-wrap">
            <select
              name="status"
              value={readModel.groups.filters.status}
              onChange={(event) => setParam("status", event.target.value)}
              className="dashboard-control-input cursor-pointer appearance-none pr-9"
            >
              <option value="">Все состояния</option>
              <option value="attention">Нужна настройка</option>
              <option value="scheduled">Запланировано</option>
            </select>
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" className="dashboard-select-chevron" />
          </label>
          <label className="dashboard-control dashboard-search-wrap">
            <Search size={16} strokeWidth={2.2} aria-hidden="true" className="dashboard-search-icon" />
            <input
              name="q"
              defaultValue={readModel.groups.filters.search}
              placeholder="Поиск группы"
              className="dashboard-control-input pl-9"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setParam("q", (event.target as HTMLInputElement).value.trim());
                }
              }}
              onBlur={(event) => setParam("q", event.target.value.trim())}
            />
          </label>
        </div>

        <div className="dashboard-subcard mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Группа</th>
                <th className="px-4 py-3">Методика</th>
                <th className="px-4 py-3">Ученики</th>
                <th className="px-4 py-3">Прогресс</th>
                <th className="px-4 py-3">Следующее занятие</th>
                <th className="px-4 py-3">Состояние</th>
              </tr>
            </thead>
            <tbody>
              {readModel.groups.rows.map((group) => {
                const isExpanded = Boolean(expandedGroupIds[group.id]);
                return (
                  <Fragment key={group.id}>
                    <tr
                      className="border-t border-neutral-200 align-top transition hover:bg-sky-50/35"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={`group-students-${group.id}`}
                            onClick={() => toggleGroup(group.id)}
                            className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-neutral-600 transition hover:border-neutral-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                          >
                            {isExpanded ? (
                              <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
                            ) : (
                              <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                            )}
                          </button>
                          <div>
                            <Link href={group.groupHref} className="font-semibold text-neutral-950 hover:underline">
                              {group.groupLabel}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{group.methodologyLabel ?? "—"}</td>
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
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {group.statusChips.map((chip) => (
                            <span key={`${group.id}-${chip}`} className="dashboard-status-chip">
                              {chip}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr id={`group-students-${group.id}`} className="border-t border-neutral-100 bg-neutral-50/45">
                        <td colSpan={6} className="px-4 py-3">
                          {group.students.length > 0 ? (
                            <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                              {group.students.map((student) => (
                                <li key={student.id} className="rounded-xl border border-neutral-200/80 bg-white/90 px-3 py-2 text-sm text-neutral-700">
                                  {student.displayName}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-neutral-500">В группе пока нет учеников.</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
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
