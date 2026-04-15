import { SurfaceCard } from "@/components/ui/surface-card";

type CanonicalHomework = {
  title: string;
  kindLabel: string;
  instructions: string;
  estimatedMinutes: number | null;
  materialLinks: string[];
  answerFormatHint: string | null;
  sourceLayerNote: string;
  learningFocus?: string[];
  beforeStart?: string[];
  completionSteps?: string[];
  successCriteria?: string[];
  parentSupportTip?: string | null;
  linkedLessonBlocks?: string[];
};

export function LessonCanonicalHomeworkPanel({
  homework,
  embedded = false,
}: {
  homework: CanonicalHomework | null;
  embedded?: boolean;
}) {
  const content = !homework ? (
    <p className="text-sm text-neutral-700">Для этого урока методики домашнее задание пока не определено.</p>
  ) : (
    <article className="space-y-4">
      <p className="text-sm text-neutral-700">{homework.sourceLayerNote}</p>
      <div className="flex flex-wrap gap-2 text-xs text-neutral-700">
        <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-800">{homework.kindLabel}</span>
        {homework.estimatedMinutes ? (
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold">~{homework.estimatedMinutes} мин</span>
        ) : null}
      </div>
      <h3 className="text-base font-semibold text-neutral-900">{homework.title}</h3>
      <p className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2 text-sm text-neutral-700">{homework.instructions}</p>
      {homework.learningFocus?.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Фокус отработки</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {homework.learningFocus.map((item) => (
              <span key={item} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {homework.beforeStart?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">Перед началом</p>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {homework.beforeStart.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {homework.completionSteps?.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Как выполнить</p>
          <ol className="mt-2 space-y-1 text-sm text-neutral-700">
            {homework.completionSteps.map((step, index) => (
              <li key={step}>
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {homework.answerFormatHint ? (
        <p className="mt-2 text-sm text-neutral-700">Формат ответа: {homework.answerFormatHint}</p>
      ) : null}
      {homework.successCriteria?.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Критерии успеха</p>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {homework.successCriteria.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {homework.linkedLessonBlocks?.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Повторить перед домашкой</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {homework.linkedLessonBlocks.map((item) => (
              <span key={item} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                {item}
              </span>
            ))}
          </div>
        </div>
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
      {homework.parentSupportTip ? (
        <p className="rounded-xl border border-rose-100 bg-rose-50/40 px-3 py-2 text-sm text-neutral-700">
          Поддержка родителя: {homework.parentSupportTip}
        </p>
      ) : null}
    </article>
  );

  if (embedded) {
    return (
      <section aria-label="Домашнее задание" className="space-y-1">
        {content}
      </section>
    );
  }

  return <SurfaceCard title="Домашнее задание">{content}</SurfaceCard>;
}
