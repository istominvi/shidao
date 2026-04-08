"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpenText, ChevronDown, ChevronRight, FolderPlus, Search, UserPlus } from "lucide-react";
import { Fragment, useState } from "react";
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
    setExpandedGroupIds((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
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
              {readModel.groups.rows.map((group) => {
                const isExpanded = Boolean(expandedGroupIds[group.id]);
                const expandedId = `group-students-${group.id}`;
                return (
                  <Fragment key={group.id}>
                    <tr
                      className="cursor-pointer border-t border-neutral-200 align-top transition hover:bg-sky-50/45"
                      onClick={() => router.push(group.groupHref)}
                    >
                      <td className="px-4 py-3 font-semibold text-neutral-950">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleGroup(group.id);
                            }}
                            aria-expanded={isExpanded}
                            aria-controls={expandedId}
                            className="teacher-disclosure-btn"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            )}
                            <span className="sr-only">
                              {isExpanded ? "Свернуть группу" : "Раскрыть группу"}
                            </span>
                          </button>
                          <span>{group.groupLabel}</span>
                        </div>
                      </td>
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
                    {isExpanded ? (
                      <tr id={expandedId} className="border-t border-neutral-200 bg-neutral-50/70">
                        <td colSpan={5} className="px-4 py-3">
                          {group.students.length > 0 ? (
                            <ul className="space-y-2">
                              {group.students.map((student) => (
                                <li key={student.id} className="flex items-center justify-between gap-3 text-sm">
                                  <span className="font-medium text-neutral-900">{student.displayName}</span>
                                  {student.login ? (
                                    <span className="text-xs text-neutral-500">{student.login}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                              <span>В группе пока нет учеников.</span>
                              <Link
                                href={`${ROUTES.studentsNew}?groupId=${encodeURIComponent(group.id)}`}
                                className="text-sky-700 underline underline-offset-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Добавить ученика
                              </Link>
                            </div>
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
