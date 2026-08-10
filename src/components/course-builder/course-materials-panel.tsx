import Link from "next/link";
import { FileText, FolderOpen } from "lucide-react";
import {
  projectCourseMaterials,
  type CourseMaterialItem,
} from "@/components/course-builder/course-materials";
import { productButtonClassName } from "@/components/ui/button";
import { toCourseRoute } from "@/lib/auth";
import type { CourseWorkspace } from "@/modules/course-builder/domain";

type CourseMaterialsPanelProps = {
  course: CourseWorkspace;
  context?: "course" | "lesson";
  onOpenLesson?: (lessonId: string) => void;
};

function MaterialCard({
  courseId,
  item,
  onOpenLesson,
  showUsage,
}: {
  courseId: string;
  item: CourseMaterialItem;
  onOpenLesson?: (lessonId: string) => void;
  showUsage: boolean;
}) {
  const { asset, usages } = item;
  const learnerVisible = usages.some((usage) => usage.learnerVisible);

  return (
    <li className="workspace-material-card">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <span className="block truncate font-bold text-neutral-950">
            {asset.originalFilename}
          </span>
          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            {asset.mimeType} · {Math.ceil(asset.sizeBytes / 1024)} КБ
          </span>
        </div>
      </div>

      {showUsage && usages.length > 0 ? (
        <div className="workspace-material-usage">
          <span>Используется в уроках:</span>
          <ul>
            {usages.map((usage) => (
              <li key={usage.lessonId}>
                <Link
                  href={`${toCourseRoute(courseId)}?lesson=${encodeURIComponent(usage.lessonId)}`}
                  onClick={(event) => {
                    if (!onOpenLesson) return;
                    event.preventDefault();
                    onOpenLesson(usage.lessonId);
                  }}
                >
                  {usage.lessonPosition}. {usage.lessonTitle}
                </Link>
                {usage.componentCount > 1 || usage.occurrenceCount > 1 ? (
                  <small> · {usage.occurrenceCount} упомин.</small>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="workspace-material-card-footer">
        <div className="workspace-material-badges">
          <span
            className={`workspace-material-status ${
              asset.status === "ready"
                ? "workspace-material-status-ready"
                : "workspace-material-status-pending"
            }`}
          >
            {asset.status === "ready" ? "Готово" : "Ожидает загрузки"}
          </span>
          {showUsage && learnerVisible ? (
            <span className="workspace-material-status workspace-material-status-visible">
              На экране ученика
            </span>
          ) : null}
        </div>
        {asset.status === "ready" && asset.signedUrl ? (
          <a
            href={asset.signedUrl}
            target="_blank"
            rel="noreferrer"
            className={productButtonClassName(
              "ghost",
              "workspace-material-link",
            )}
          >
            Открыть
          </a>
        ) : null}
      </div>
    </li>
  );
}

function MaterialList({
  courseId,
  items,
  onOpenLesson,
  showUsage,
}: {
  courseId: string;
  items: CourseMaterialItem[];
  onOpenLesson?: (lessonId: string) => void;
  showUsage: boolean;
}) {
  return (
    <ul className="workspace-material-grid">
      {items.map((item) => (
        <MaterialCard
          key={item.asset.id}
          courseId={courseId}
          item={item}
          onOpenLesson={onOpenLesson}
          showUsage={showUsage}
        />
      ))}
    </ul>
  );
}

export function CourseMaterialsPanel({
  course,
  context = "course",
  onOpenLesson,
}: CourseMaterialsPanelProps) {
  const projection = projectCourseMaterials(course);
  const allItems = [...projection.used, ...projection.unused];

  return (
    <section className="workspace-surface course-materials-panel">
      <div className="workspace-panel-heading">
        <div>
          <p className="workspace-eyebrow">Единая библиотека курса</p>
          <h2>Материалы</h2>
        </div>
      </div>

      <p className="workspace-surface-note">
        {context === "lesson"
          ? "Здесь показана общая библиотека курса. Отдельной копии файла у урока нет."
          : "Здесь собраны файлы курса и видно, в каких уроках они используются. Источники ведутся отдельно в разделе «О курсе» и здесь не дублируются. Содержимое файлов пока не анализировалось."}
      </p>

      {projection.unresolvedReferenceCount > 0 ||
      projection.invalidComponentCount > 0 ? (
        <p className="app-alert app-alert-warning course-materials-warning">
          Некоторые ссылки на материалы не удалось сопоставить. Откройте
          соответствующие уроки и проверьте компоненты.
        </p>
      ) : null}

      {allItems.length > 0 ? (
        context === "course" ? (
          <div className="course-material-groups">
            {projection.used.length > 0 ? (
              <section aria-labelledby="used-course-materials-title">
                <h3
                  id="used-course-materials-title"
                  className="workspace-material-section-title"
                >
                  Используются в уроках
                </h3>
                <MaterialList
                  courseId={course.id}
                  items={projection.used}
                  onOpenLesson={onOpenLesson}
                  showUsage
                />
              </section>
            ) : null}
            {projection.unused.length > 0 ? (
              <section aria-labelledby="unused-course-materials-title">
                <h3
                  id="unused-course-materials-title"
                  className="workspace-material-section-title"
                >
                  Другие материалы курса
                </h3>
                <p className="workspace-material-section-note">
                  Эти файлы прикреплены к курсу, но пока не выбраны ни в одном
                  компоненте урока.
                </p>
                <MaterialList
                  courseId={course.id}
                  items={projection.unused}
                  onOpenLesson={onOpenLesson}
                  showUsage
                />
              </section>
            ) : null}
          </div>
        ) : (
          <MaterialList
            courseId={course.id}
            items={allItems}
            onOpenLesson={onOpenLesson}
            showUsage={false}
          />
        )
      ) : (
        <div className="workspace-empty-state">
          <FolderOpen
            className="mx-auto h-7 w-7 text-neutral-400"
            aria-hidden="true"
          />
          <h3>Материалов пока нет</h3>
          <p>
            {context === "course"
              ? "Материалы, выбранные при создании курса и используемые в компонентах уроков, появятся здесь."
              : "Прикреплённые к курсу файлы и изображения появятся здесь."}
          </p>
        </div>
      )}
    </section>
  );
}
