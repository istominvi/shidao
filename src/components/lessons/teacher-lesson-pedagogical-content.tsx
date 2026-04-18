import { Timer, Workflow } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";

type Props = {
  quickSummary: {
    prepChecklist: string[];
    keyWords: string[];
    keyPhrases: string[];
  };
  steps: MethodologyLessonStep[];
  durationLabel?: string | null;
  activeStudentStepId?: string | null;
  onShowOnStudentScreen?: (stepId: string) => void;
  onOpenStudentScreen?: () => void;
};

function SummaryList({ items }: { items: string[] }) {
  if (!items.length) return null;
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

export function TeacherLessonPedagogicalContent({
  quickSummary,
  steps,
  durationLabel,
  activeStudentStepId,
  onShowOnStudentScreen,
  onOpenStudentScreen,
}: Props) {
  return (
    <section className="space-y-8" aria-label="План урока">
      <section className="rounded-2xl border border-neutral-200 bg-gradient-to-b from-neutral-50 to-white p-4">
        <h2 className="text-base font-semibold text-neutral-950">Кратко об уроке</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Длительность</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><Timer className="h-4 w-4" />{durationLabel ?? "45 мин"}</p>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Новые слова</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{quickSummary.keyWords.length}</p>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Ключевые фразы</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{quickSummary.keyPhrases.length}</p>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Шагов</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{steps.length}</p>
          </article>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Лексика урока</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">{quickSummary.keyWords.map((word) => <Chip key={word} tone="sky">{word}</Chip>)}</div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Речевые паттерны</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">{quickSummary.keyPhrases.map((phrase) => <Chip key={phrase} tone="violet">{phrase}</Chip>)}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-950">Подготовка до урока</h2>
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <SummaryList items={quickSummary.prepChecklist} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-950">План урока</h2>
          <Chip tone="neutral"><Workflow className="mr-1 h-3.5 w-3.5" />{steps.length} шагов</Chip>
        </div>

        <div className="space-y-3">
          {steps.map((step) => (
            <article key={step.id} className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Chip size="sm" tone="inverse">Шаг {step.order}</Chip>
                  {activeStudentStepId === step.id ? <Chip size="sm" tone="sky">На экране ученика</Chip> : null}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onShowOnStudentScreen?.(step.id)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700">Показать на экране ученика</button>
                  <button type="button" onClick={() => onOpenStudentScreen?.()} className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800">Открыть экран ученика</button>
                </div>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-neutral-950">{step.title}</h3>
              {step.teacher.description ? <p className="mt-1 text-sm text-neutral-700">{step.teacher.description}</p> : null}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {step.teacher.teacherActions.length ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Что делает педагог</h4>
                    <div className="mt-2"><SummaryList items={step.teacher.teacherActions} /></div>
                  </div>
                ) : null}
                {step.teacher.studentActions.length ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Что делают ученики</h4>
                    <div className="mt-2"><SummaryList items={step.teacher.studentActions} /></div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {step.teacher.teacherScript?.length ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Целевой язык</h4>
                    <div className="mt-2"><SummaryList items={step.teacher.teacherScript} /></div>
                  </div>
                ) : null}
                {step.teacher.expectedResponses?.length ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Ожидаемые ответы</h4>
                    <div className="mt-2"><SummaryList items={step.teacher.expectedResponses} /></div>
                  </div>
                ) : null}
                {step.teacher.materials.length ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Материалы</h4>
                    <div className="mt-2"><SummaryList items={step.teacher.materials} /></div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
