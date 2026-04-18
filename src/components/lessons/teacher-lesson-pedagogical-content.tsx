import { Timer, Workflow } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { ReusableAsset } from "@/lib/lesson-content";
import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";

type Props = {
  quickSummary: {
    prepChecklist: string[];
    keyWords: string[];
    keyPhrases: string[];
  };
  steps: MethodologyLessonStep[];
  durationLabel?: string | null;
  summaryNote?: string | null;
  activeStudentStepId?: string | null;
  assetsById?: Record<string, ReusableAsset>;
  onShowOnStudentScreen?: (stepId: string) => void;
  onOpenStudentScreen?: (stepId: string) => void;
};

const phaseLabelMap: Record<NonNullable<MethodologyLessonStep["phase"]>, string> = {
  opening: "Открытие урока",
  language_input: "Ввод языка",
  active_practice: "Активная практика",
  consolidation: "Закрепление",
  closure: "Завершение",
};

const movementLabelMap: Record<NonNullable<MethodologyLessonStep["movementMode"]>, string> = {
  calm: "спокойно",
  active: "подвижно",
  table: "за столом",
  song: "песня",
  mixed: "смешанный формат",
};

const screenTypeLabelMap: Record<MethodologyLessonStep["student"]["screenType"], string> = {
  intro: "Вступление",
  video: "Видео",
  presentation: "Презентация",
  flashcards: "Карточки",
  phrase_practice: "Фразы",
  counting: "Счёт",
  movement: "Движение",
  worksheet: "Тетрадь",
  farm_placement: "Ферма",
  song: "Песня",
  placeholder: "Опорный экран",
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

function shouldRenderGoal(step: MethodologyLessonStep) {
  if (!step.teacher.goal) return false;
  const goal = step.teacher.goal.trim().toLowerCase();
  const description = step.teacher.description?.trim().toLowerCase();
  return goal.length > 0 && goal !== description;
}

function InlineResourceLinks({ resourceIds, assetsById }: { resourceIds: string[]; assetsById: Record<string, ReusableAsset> }) {
  const assets = resourceIds
    .map((id) => assetsById[id])
    .filter((asset): asset is ReusableAsset => Boolean(asset));

  if (!assets.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {assets.map((asset) => (
        asset.fileRef ?? asset.sourceUrl ? (
          <a
            key={asset.id}
            href={asset.fileRef ?? asset.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800"
          >
            {asset.title}
          </a>
        ) : (
          <span
            key={asset.id}
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-600"
          >
            {asset.title}
          </span>
        )
      ))}
    </div>
  );
}

export function TeacherLessonPedagogicalContent({
  quickSummary,
  steps,
  durationLabel,
  summaryNote,
  activeStudentStepId,
  assetsById = {},
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
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Шагов</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{steps.length}</p>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Новые слова</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{quickSummary.keyWords.length}</p>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Ключевые фразы</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{quickSummary.keyPhrases.length}</p>
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

        {summaryNote ? <p className="mt-4 text-sm text-neutral-600">{summaryNote}</p> : null}
      </section>

      {quickSummary.prepChecklist.length ? (
        <section>
          <h2 className="text-base font-semibold text-neutral-950">Подготовка до урока</h2>
          <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4">
            <SummaryList items={quickSummary.prepChecklist} />
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-950">Ход урока</h2>
          <Chip tone="neutral"><Workflow className="mr-1 h-3.5 w-3.5" />{steps.length} шагов</Chip>
        </div>

        <div className="space-y-3">
          {steps.map((step) => {
            const resourceCount = new Set([...(step.student.assetIds ?? []), ...(step.resourceIds ?? [])]).size;
            return (
              <article key={step.id} className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" tone="inverse">Шаг {step.order}</Chip>
                      {step.phase ? <Chip size="sm" tone="neutral">{phaseLabelMap[step.phase]}</Chip> : null}
                      {step.durationMinutes ? <Chip size="sm" tone="sky">{step.durationMinutes} мин</Chip> : null}
                      {step.movementMode ? <Chip size="sm" tone="violet">{movementLabelMap[step.movementMode]}</Chip> : null}
                      {activeStudentStepId === step.id ? <Chip size="sm" tone="sky">На экране ученика</Chip> : null}
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-950">{step.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onShowOnStudentScreen?.(step.id)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700">Показать на экране ученика</button>
                    <button type="button" onClick={() => onOpenStudentScreen?.(step.id)} className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800">Открыть экран ученика</button>
                  </div>
                </div>

                {step.teacher.description ? <p className="mt-2 text-sm text-neutral-700">{step.teacher.description}</p> : null}

                <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">На экране ученика</h4>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Chip size="sm" tone="sky">{screenTypeLabelMap[step.student.screenType]}</Chip>
                    <Chip size="sm" tone="neutral">Ресурсов: {resourceCount}</Chip>
                  </div>
                  {step.student.instruction ? <p className="mt-2 text-sm text-neutral-700">{step.student.instruction}</p> : null}
                  {step.student.screenType === "placeholder" ? <p className="mt-1 text-xs text-neutral-600">Опорный экран без интерактива</p> : null}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {shouldRenderGoal(step) ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Цель шага</h4>
                      <p className="mt-2 text-sm text-neutral-700">{step.teacher.goal}</p>
                    </div>
                  ) : null}
                  {step.teacher.teacherActions.length ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Что делает педагог</h4>
                      <div className="mt-2"><SummaryList items={step.teacher.teacherActions} /></div>
                    </div>
                  ) : null}
                  {step.teacher.teacherScript?.length ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Что говорит педагог</h4>
                      <div className="mt-2"><SummaryList items={step.teacher.teacherScript} /></div>
                    </div>
                  ) : null}
                  {step.teacher.studentActions.length ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Что делают ученики</h4>
                      <div className="mt-2"><SummaryList items={step.teacher.studentActions} /></div>
                    </div>
                  ) : null}
                  {step.teacher.expectedResponses?.length ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Ожидаемые ответы</h4>
                      <div className="mt-2"><SummaryList items={step.teacher.expectedResponses} /></div>
                    </div>
                  ) : null}
                  {step.teacher.materials.length || (step.resourceIds?.length ?? 0) > 0 ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Материалы шага</h4>
                      <div className="mt-2"><SummaryList items={step.teacher.materials} /></div>
                      <InlineResourceLinks resourceIds={Array.from(new Set([...(step.resourceIds ?? []), ...(step.student.assetIds ?? [])]))} assetsById={assetsById} />
                    </div>
                  ) : null}
                  {step.teacher.successCriteria?.length ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Критерии успеха</h4>
                      <div className="mt-2"><SummaryList items={step.teacher.successCriteria} /></div>
                    </div>
                  ) : null}
                  {step.teacher.notes?.length ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Методические заметки</h4>
                      <div className="mt-2"><SummaryList items={step.teacher.notes} /></div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
