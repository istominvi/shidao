"use client";

import { useRouter } from "next/navigation";
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
  positionLabel: string;
  durationLabel: string;
  readinessLabel: string;
  homeworkLabel: string | null;
  mediaSummary: {
    videos: number;
    songs: number;
    worksheets: number;
    other: number;
  };
  materialsSignal: boolean;
};

type MethodologyLessonsTableCardProps = {
  title?: string;
  methodologySlug: string;
  rows: MethodologyLessonRow[];
};

function pluralizeMaterial(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} ${few}`;
  }

  return `${count} ${many}`;
}

function toMaterialsLabel(lesson: MethodologyLessonRow) {
  const mediaParts: string[] = [];

  if (lesson.mediaSummary.videos > 0) {
    mediaParts.push(pluralizeMaterial(lesson.mediaSummary.videos, "видео", "видео", "видео"));
  }
  if (lesson.mediaSummary.songs > 0) {
    mediaParts.push(pluralizeMaterial(lesson.mediaSummary.songs, "песня", "песни", "песен"));
  }
  if (lesson.mediaSummary.worksheets > 0) {
    mediaParts.push(
      pluralizeMaterial(lesson.mediaSummary.worksheets, "worksheet", "worksheets", "worksheets"),
    );
  }
  if (lesson.mediaSummary.other > 0) {
    mediaParts.push(pluralizeMaterial(lesson.mediaSummary.other, "материал", "материала", "материалов"));
  }

  if (mediaParts.length === 0 && lesson.materialsSignal) {
    mediaParts.push("есть материалы");
  }

  const homeworkPart = lesson.homeworkLabel ? `ДЗ: ${lesson.homeworkLabel.replace(/^Есть домашнее задание\s*[·:]\s*/i, "")}` : "без ДЗ";

  const parts = mediaParts.length > 0 ? mediaParts : ["без медиа"];
  parts.push(homeworkPart);

  return parts.join(" · ");
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
            <ProductTableHeaderCell>Позиция</ProductTableHeaderCell>
            <ProductTableHeaderCell>Длительность</ProductTableHeaderCell>
            <ProductTableHeaderCell>Материалы / ДЗ</ProductTableHeaderCell>
            <ProductTableHeaderCell>Статус</ProductTableHeaderCell>
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
                <ProductTableCell className="max-w-0">
                  <ProductTableTruncate title={lesson.positionLabel}>
                    {lesson.positionLabel}
                  </ProductTableTruncate>
                </ProductTableCell>
                <ProductTableCell>
                  <ProductTableTruncate title={lesson.durationLabel}>
                    {lesson.durationLabel}
                  </ProductTableTruncate>
                </ProductTableCell>
                <ProductTableCell className="max-w-0">
                  <ProductTableTruncate title={toMaterialsLabel(lesson)}>
                    {toMaterialsLabel(lesson)}
                  </ProductTableTruncate>
                </ProductTableCell>
                <ProductTableCell>
                  <ProductTableTruncate title={lesson.readinessLabel}>
                    {lesson.readinessLabel}
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
