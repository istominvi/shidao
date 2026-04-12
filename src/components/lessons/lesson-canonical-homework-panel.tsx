import { AppCard } from "@/components/app/app-card";

type CanonicalHomework = {
  title: string;
  kindLabel: string;
  instructions: string;
  estimatedMinutes: number | null;
  materialLinks: string[];
  answerFormatHint: string | null;
  sourceLayerNote: string;
};

export function LessonCanonicalHomeworkPanel({ homework }: { homework: CanonicalHomework | null }) {
  if (!homework) {
    return (
      <AppCard className="p-5 md:p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Домашнее задание</h2>
        <p className="mt-2 text-sm text-neutral-700">Для этого урока методики домашнее задание пока не определено.</p>
      </AppCard>
    );
  }

  return (
    <AppCard className="p-5 md:p-6" as="article">
      <h2 className="text-lg font-semibold text-neutral-900">Домашнее задание</h2>
      <p className="mt-2 text-sm text-neutral-700">{homework.sourceLayerNote}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-700">
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-800">{homework.kindLabel}</span>
        {homework.estimatedMinutes ? (
          <span className="rounded-full bg-neutral-100 px-2.5 py-1">~{homework.estimatedMinutes} мин</span>
        ) : null}
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-900">{homework.title}</h3>
      <p className="mt-2 text-sm text-neutral-700">{homework.instructions}</p>
      {homework.answerFormatHint ? (
        <p className="mt-2 text-sm text-neutral-700">Формат ответа: {homework.answerFormatHint}</p>
      ) : null}
      {homework.materialLinks.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Материалы домашнего задания</p>
          <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
            {homework.materialLinks.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppCard>
  );
}
