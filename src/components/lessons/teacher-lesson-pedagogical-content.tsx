import type { ReactNode } from "react";
import { BookOpen, Footprints, Layers3, MessageCircleMore, Timer, Workflow } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { TeacherLessonWorkspacePresentation } from "@/lib/server/teacher-lesson-workspace";

function SummaryList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) return <p className="text-sm text-neutral-600">{emptyLabel}</p>;
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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
    </div>
  );
}

function PedagogicalSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{title}</h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function phaseLabel(order: number) {
  if (order <= 2) return "Открытие урока";
  if (order <= 4) return "Ввод языка";
  if (order <= 11) return "Активная практика";
  if (order <= 14) return "Закрепление";
  return "Завершение";
}

function stepIcon(blockLabel: string) {
  if (blockLabel.includes("Речевые")) return <MessageCircleMore className="h-4 w-4" />;
  if (blockLabel.includes("Практическая")) return <Footprints className="h-4 w-4" />;
  if (blockLabel.includes("Лексика")) return <BookOpen className="h-4 w-4" />;
  return <Layers3 className="h-4 w-4" />;
}

export function TeacherLessonPedagogicalContent({
  quickSummary,
  lessonFlow,
  durationLabel,
}: Pick<TeacherLessonWorkspacePresentation, "quickSummary" | "lessonFlow"> & { durationLabel?: string | null }) {
  return (
    <section className="space-y-8" aria-label="План урока">
      <section id="lesson-passport" className="scroll-mt-20 rounded-2xl border border-neutral-200 bg-gradient-to-b from-neutral-50 to-white p-4">
        <SectionTitle title="Паспорт урока" subtitle="Готовая опора преподавателя перед стартом занятия." />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Этапов в плане</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{lessonFlow.length}</p>
          </article>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Лексика урока</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickSummary.keyWords.length ? quickSummary.keyWords.map((word) => <Chip key={word} tone="sky">{word}</Chip>) : <p className="text-sm text-neutral-600">Слова не указаны.</p>}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Речевые паттерны</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickSummary.keyPhrases.length ? quickSummary.keyPhrases.map((phrase) => <Chip key={phrase} tone="violet">{phrase}</Chip>) : <p className="text-sm text-neutral-600">Фразы не указаны.</p>}
            </div>
          </div>
        </div>
      </section>

      <section id="lesson-materials" className="scroll-mt-20 border-b border-neutral-200 pb-6">
        <SectionTitle title="Материалы и подготовка" subtitle="Проверьте реквизит до старта урока." />
        <SummaryList items={quickSummary.prepChecklist} emptyLabel="Чек-лист подготовки пока не заполнен." />
      </section>

      <section id="lesson-flow" className="scroll-mt-20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle title="Пошаговый план урока" subtitle="Фазы: открытие → ввод → практика → закрепление → завершение." />
          <Chip tone="neutral"><Workflow className="mr-1 h-3.5 w-3.5" />{lessonFlow.length} этапов</Chip>
        </div>

        <div className="space-y-3">
          {lessonFlow.map((step, index) => (
            <article key={step.id} className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5">
              <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" tone="inverse">Шаг {index + 1}</Chip>
                  <Chip size="sm" tone="slate">{phaseLabel(step.order)}</Chip>
                  <Chip size="sm" tone="neutral" className="inline-flex items-center gap-1">{stepIcon(step.blockLabel)}{step.blockLabel}</Chip>
                </div>
                <h3 className="text-lg font-semibold text-neutral-950">{step.title}</h3>
                {step.description ? <p className="text-sm leading-6 text-neutral-700">{step.description}</p> : null}
              </header>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <PedagogicalSubsection title="Что делает педагог">
                  <SummaryList items={step.teacherActions} emptyLabel="Действия не указаны." />
                </PedagogicalSubsection>
                <PedagogicalSubsection title="Что делают дети">
                  <SummaryList items={step.studentActions} emptyLabel="Ожидаемые реакции не указаны." />
                </PedagogicalSubsection>
              </div>

              {(step.pedagogicalDetails?.promptPatterns?.length || step.pedagogicalDetails?.expectedStudentResponses?.length) ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <PedagogicalSubsection title="Целевой язык">
                    <SummaryList items={step.pedagogicalDetails?.promptPatterns ?? []} emptyLabel="Паттерны не указаны." />
                  </PedagogicalSubsection>
                  <PedagogicalSubsection title="Пример ответов">
                    <SummaryList items={step.pedagogicalDetails?.expectedStudentResponses ?? []} emptyLabel="Ответы не указаны." />
                    {step.pedagogicalDetails?.fallbackRu ? <p className="mt-2 text-xs text-neutral-600">Подсказка: {step.pedagogicalDetails.fallbackRu}</p> : null}
                  </PedagogicalSubsection>
                </div>
              ) : null}

              {(step.pedagogicalDetails?.activitySteps?.length || step.pedagogicalDetails?.successCriteria?.length || step.materials.length) ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {step.pedagogicalDetails?.activitySteps?.length ? (
                    <PedagogicalSubsection title="Ход этапа">
                      <SummaryList items={step.pedagogicalDetails.activitySteps} emptyLabel="Шаги не указаны." />
                    </PedagogicalSubsection>
                  ) : null}

                  {step.pedagogicalDetails?.successCriteria?.length ? (
                    <PedagogicalSubsection title="Критерии успеха">
                      <SummaryList items={step.pedagogicalDetails.successCriteria} emptyLabel="Критерии не указаны." />
                    </PedagogicalSubsection>
                  ) : null}

                  {step.materials.length ? (
                    <PedagogicalSubsection title="Материалы этапа">
                      <SummaryList items={step.materials} emptyLabel="Материалы не требуются." />
                    </PedagogicalSubsection>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
