import { Chip } from "@/components/ui/chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TeacherHomeworkQuizPreviewPanel } from "@/components/lessons/teacher-homework-quiz-preview-panel";

type CanonicalHomework = {
  title: string;
  kindLabel: string;
  instructions: string;
  estimatedMinutes: number | null;
  materialLinks: string[];
  answerFormatHint: string | null;
  sourceLayerNote: string;
  kind: "practice_text" | "quiz_single_choice";
  quizDefinition: Record<string, unknown> | null;
};

function DotList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-neutral-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

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
      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="violet">{homework.kindLabel}</Chip>
          {homework.estimatedMinutes ? <Chip tone="neutral">~{homework.estimatedMinutes} мин</Chip> : null}
        </div>
        <h3 className="mt-2 text-lg font-semibold text-neutral-900">{homework.title}</h3>
        <p className="mt-1 text-sm text-neutral-700">{homework.instructions}</p>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl border border-neutral-200 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Что повторяем</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="sky">狗 猫 兔子 马</Chip>
            <Chip tone="violet">我是… / 这是…</Chip>
            <Chip tone="emerald">跑 / 跳 / 我们…吧！</Chip>
            <Chip tone="amber">农场 / 在…里</Chip>
          </div>
        </article>

        <article className="rounded-xl border border-neutral-200 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Как ребёнок проходит ДЗ</h4>
          <DotList
            items={[
              "Открывает мини-миссию и читает короткий вводный блок.",
              "Отвечает на короткие вопросы по словам, фразам и движениям.",
              "Получает результат и может сразу повторить трудные слова.",
            ]}
          />
        </article>
      </section>

      {homework.materialLinks.length ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Материалы</h4>
          <div className="mt-2">
            <DotList items={homework.materialLinks} />
          </div>
        </section>
      ) : null}

      {homework.answerFormatHint ? (
        <p className="text-sm text-neutral-700">
          <span className="font-semibold text-neutral-900">Формат ответа:</span> {homework.answerFormatHint}
        </p>
      ) : null}

      <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
        {homework.sourceLayerNote}
      </p>

      {homework.kind === "quiz_single_choice" && homework.quizDefinition ? (
        <TeacherHomeworkQuizPreviewPanel quizDefinition={homework.quizDefinition} />
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
