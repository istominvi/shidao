"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, FolderPlus, Search, UserPlus } from "lucide-react";
import { productButtonClassName } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { TeacherGroupOperationsRow } from "@/lib/server/teacher-dashboard-operations";
import { TeacherTableCard, TeacherTableEmptyState } from "./teacher-table-card";

type TeacherGroupsCardProps = {
  title: string;
  actions: Array<{ label: string; href: string }>;
  rows: TeacherGroupOperationsRow[];
  filters: {
    search: string;
    methodology: string;
    methodologyOptions: string[];
  };
  emptyStateText?: string;
};

const ACTION_ICONS = {
  "Добавить группу": FolderPlus,
  "Добавить ученика": UserPlus,
} as const;

export function TeacherGroupsCard({
  title,
  actions,
  rows,
  filters,
  emptyStateText = "По текущим фильтрам групп не найдено.",
}: TeacherGroupsCardProps) {
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
    <TeacherTableCard
      title={title}
      controls={(
        <div className="product-control-rail">
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action.label as keyof typeof ACTION_ICONS] ?? FolderPlus;
            return (
              <Link key={action.label} href={action.href} className={productButtonClassName("primary")}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{action.label}</span>
              </Link>
            );
          })}
          <div className="product-select-wrap">
            <Select
              name="methodology"
              value={filters.methodology}
              onChange={(event) => setParam("methodology", event.target.value)}
            >
              <option value="">Все методики</option>
              {filters.methodologyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <ChevronDown className="product-select-icon h-4 w-4" aria-hidden="true" />
          </div>
          <div className="product-search-wrap">
            <Search className="product-search-icon h-4 w-4" aria-hidden="true" />
            <Input
              name="q"
              defaultValue={filters.search}
              placeholder="Поиск группы"
              className="product-control-search"
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
      )}
    >
        <table className="min-w-full table-fixed text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr className="h-10">
              <th className="px-4 py-0 align-middle">Группа</th>
              <th className="px-4 py-0 align-middle">Методика</th>
              <th className="px-4 py-0 align-middle">Ученики</th>
              <th className="px-4 py-0 align-middle">Прогресс</th>
              <th className="px-4 py-0 align-middle">Следующее занятие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((group) => (
              <tr
                key={group.id}
                className="h-10 cursor-pointer border-t border-neutral-200 transition hover:bg-sky-50/45"
                onClick={() => router.push(group.groupHref)}
              >
                <td className="max-w-0 px-4 py-0 align-middle font-semibold text-neutral-950">
                  <span className="block truncate" title={group.groupLabel}>{group.groupLabel}</span>
                </td>
                <td className="max-w-0 px-4 py-0 align-middle text-neutral-700">
                  <span className="block truncate" title={group.methodologyLabel ?? "Не назначена"}>
                    {group.methodologyLabel ?? "Не назначена"}
                  </span>
                </td>
                <td className="px-4 py-0 align-middle text-neutral-700">{group.studentCount}</td>
                <td className="max-w-0 px-4 py-0 align-middle text-neutral-700">
                  <span className="block truncate" title={group.progressLabel}>{group.progressLabel}</span>
                </td>
                <td className="max-w-0 px-4 py-0 align-middle text-neutral-700">
                  <span
                    className="block truncate"
                    title={
                      group.nextLessonLabel
                        ? [group.nextLessonLabel, group.nextLessonTitle].filter(Boolean).join(" • ")
                        : "Не запланировано"
                    }
                  >
                    {group.nextLessonLabel
                      ? [group.nextLessonLabel, group.nextLessonTitle].filter(Boolean).join(" • ")
                      : "Не запланировано"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <TeacherTableEmptyState text={emptyStateText} /> : null}
    </TeacherTableCard>
  );
}
