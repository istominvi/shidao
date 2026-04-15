"use client";

import { ClipboardCheck, Music2, PanelsTopLeft, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ProductTableCard } from "@/components/dashboard/product-table-card";
import {
  ProductTable,
  ProductTableBody,
  ProductTableCell,
  ProductTableEmptyState,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTablePrimaryCell,
  ProductTableRow,
  ProductTableTruncate,
} from "@/components/ui/product-table";
import { toMethodologyLessonRoute } from "@/lib/auth";

type MethodologyLessonRow = {
  id: string;
  title: string;
  durationLabel: string;
  nearestAssignedAtLabel: string | null;
  mediaSummary: {
    videos: number;
    songs: number;
    worksheets: number;
    other: number;
  };
  materialsSignal: boolean;
  homeworkSignal: boolean;
};

type MethodologyLessonsTableCardProps = {
  title?: string;
  methodologySlug: string;
  rows: MethodologyLessonRow[];
};

function MaterialMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${value}`}>
      <span aria-hidden="true" className="text-neutral-500">
        {icon}
      </span>
      <span>{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function MethodologyLessonsTableCard({
  title = "Уроки",
  methodologySlug,
  rows,
}: MethodologyLessonsTableCardProps) {
  const router = useRouter();

  return (
    <ProductTableCard title={title}>
      <ProductTable>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell>Урок</ProductTableHeaderCell>
            <ProductTableHeaderCell>Длительность</ProductTableHeaderCell>
            <ProductTableHeaderCell>Материалы</ProductTableHeaderCell>
            <ProductTableHeaderCell>Назначен</ProductTableHeaderCell>
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {rows.map((lesson) => {
            const href = toMethodologyLessonRoute(methodologySlug, lesson.id);

            return (
              <ProductTableRow
                key={lesson.id}
                className="cursor-pointer"
                onClick={() => router.push(href)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <ProductTablePrimaryCell className="max-w-0">
                  <ProductTableTruncate title={lesson.title}>
                    {lesson.title}
                  </ProductTableTruncate>
                </ProductTablePrimaryCell>
                <ProductTableCell>
                  <ProductTableTruncate title={lesson.durationLabel}>
                    {lesson.durationLabel}
                  </ProductTableTruncate>
                </ProductTableCell>
                <ProductTableCell>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
                    <MaterialMetric
                      label="Видео"
                      value={lesson.mediaSummary.videos}
                      icon={<Video className="h-3.5 w-3.5" strokeWidth={2.2} />}
                    />
                    <MaterialMetric
                      label="Песни"
                      value={lesson.mediaSummary.songs}
                      icon={<Music2 className="h-3.5 w-3.5" strokeWidth={2.2} />}
                    />
                    <MaterialMetric
                      label="Карточки"
                      value={lesson.mediaSummary.worksheets + lesson.mediaSummary.other + (lesson.materialsSignal ? 1 : 0)}
                      icon={<PanelsTopLeft className="h-3.5 w-3.5" strokeWidth={2.2} />}
                    />
                    <MaterialMetric
                      label="Квиз"
                      value={lesson.homeworkSignal ? 1 : 0}
                      icon={<ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2.2} />}
                    />
                  </div>
                </ProductTableCell>
                <ProductTableCell>
                  <ProductTableTruncate title={lesson.nearestAssignedAtLabel ?? "Не назначен"}>
                    {lesson.nearestAssignedAtLabel ?? "—"}
                  </ProductTableTruncate>
                </ProductTableCell>
              </ProductTableRow>
            );
          })}
        </ProductTableBody>
      </ProductTable>
      {rows.length === 0 ? (
        <ProductTableEmptyState text="В этой методике пока нет доступных уроков." />
      ) : null}
    </ProductTableCard>
  );
}
