import { FileText, FolderOpen } from "lucide-react";
import { productButtonClassName } from "@/components/ui/button";
import type { CourseWorkspace } from "@/modules/course-builder/domain";

type CourseMaterialsPanelProps = {
  course: CourseWorkspace;
  context?: "course" | "lesson";
};

export function CourseMaterialsPanel({
  course,
  context = "course",
}: CourseMaterialsPanelProps) {
  return (
    <section className="workspace-surface">
      <div className="workspace-panel-heading">
        <div>
          <p className="workspace-eyebrow">Единый каталог курса</p>
          <h2>Материалы</h2>
        </div>
      </div>

      <p className="workspace-surface-note">
        {context === "lesson"
          ? "Здесь показаны материалы всего курса. Урок не получает собственную копию файла и пока не хранит отдельную привязку к материалу."
          : "Материалы сохранены в закрытом хранилище и прикреплены ко всему курсу. Их содержимое пока не анализировалось."}
      </p>

      {course.attachments.length > 0 ? (
        <ul className="workspace-material-grid">
          {course.attachments.map((asset) => (
            <li key={asset.id} className="workspace-material-card">
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
              <div className="mt-4 flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    asset.status === "ready"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {asset.status === "ready" ? "Готово" : "Ожидает загрузки"}
                </span>
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
          ))}
        </ul>
      ) : (
        <div className="workspace-empty-state">
          <FolderOpen
            className="mx-auto h-7 w-7 text-neutral-400"
            aria-hidden="true"
          />
          <h3>Материалов пока нет</h3>
          <p>Прикреплённые к курсу файлы и изображения появятся здесь.</p>
        </div>
      )}
    </section>
  );
}
