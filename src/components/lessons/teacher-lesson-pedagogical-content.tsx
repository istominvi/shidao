import type { ReactNode } from "react";
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

export function TeacherLessonPedagogicalContent({
  quickSummary,
  lessonFlow,
  durationLabel,
}: Pick<TeacherLessonWorkspacePresentation, "quickSummary" | "lessonFlow"> & { durationLabel?: string | null }) {
  return (
    <section className="space-y-8" aria-label="План урока">
      <nav aria-label="Навигация по плану урока" className="sticky top-2 z-10 -mx-1 overflow-x-auto rounded-2xl border border-neutral-200 bg-white/90 px-2 py-2 backdrop-blur">
        <div className="flex min-w-max items-center gap-2">
          <a href="#lesson-passport" className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">Паспорт урока</a>
          <a href="#lesson-materials" className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">Реквизит</a>
          <a href="#lesson-flow" className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">Ход урока</a>
        </div>
      </nav>

      <section id="lesson-passport" className="scroll-mt-20 border-b border-neutral-200 pb-6">
        <SectionTitle title="Паспорт урока" subtitle="Краткая методическая выжимка перед началом занятия." />

        <div className="space-y-4">
          {durationLabel ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
              <span className="font-semibold text-neutral-900">Длительность:</span>
              <Chip tone="neutral">{durationLabel}</Chip>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Новые слова</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickSummary.keyWords.length ? (
                quickSummary.keyWords.map((word) => (
                  <Chip key={word} tone="sky">
                    {word}
                  </Chip>
                ))
              ) : (
                <p className="text-sm text-neutral-600">Слова не указаны.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Ключевые фразы</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickSummary.keyPhrases.length ? (
                quickSummary.keyPhrases.map((phrase) => (
                  <Chip key={phrase} tone="violet">
                    {phrase}
                  </Chip>
                ))
              ) : (
                <p className="text-sm text-neutral-600">Фразы не указаны.</p>
              )}
            </div>
          </div>

          {quickSummary.resources.length ? (
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">Опорные материалы урока</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                {quickSummary.resources.map((resource) => (
                  <li key={`${resource.kindLabel}-${resource.title}`}>
                    <span className="font-medium">{resource.kindLabel}:</span>{" "}
                    {resource.url ? (
                      <a
                        href={resource.url}
                        className="font-medium text-sky-700 underline underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {resource.title}
                      </a>
                    ) : (
                      resource.title
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section id="lesson-materials" className="scroll-mt-20 border-b border-neutral-200 pb-6">
        <SectionTitle title="Реквизит и материалы" subtitle="Проверьте подготовку до старта урока." />
        <SummaryList items={quickSummary.prepChecklist} emptyLabel="Чек-лист подготовки пока не заполнен." />
      </section>

      <section id="lesson-flow" className="scroll-mt-20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle title="Ход урока" subtitle="Линейный сценарий проведения занятия по этапам." />
          <Chip tone="neutral">{lessonFlow.length} этапов</Chip>
        </div>

        <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {lessonFlow.map((step, index) => (
            <article key={step.id} className="space-y-4 p-4 md:p-5">
              <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip className="border-neutral-900 bg-neutral-900 text-white">{step.stepLabel || `Этап ${index + 1}`}</Chip>
                  <Chip tone="slate">{step.blockLabel}</Chip>
                </div>
                <h3 className="text-lg font-semibold text-neutral-950">{step.title}</h3>
                {step.description ? <p className="text-sm leading-6 text-neutral-700">{step.description}</p> : null}
              </header>

              <div className="grid gap-3 md:grid-cols-2">
                <PedagogicalSubsection title="Реплики и действия преподавателя">
                  <SummaryList items={step.teacherActions} emptyLabel="Реплики не указаны." />
                </PedagogicalSubsection>
                <PedagogicalSubsection title="Ожидаемые действия детей">
                  <SummaryList items={step.studentActions} emptyLabel="Ожидаемые реакции не указаны." />
                </PedagogicalSubsection>
              </div>

              {(step.pedagogicalDetails?.promptPatterns?.length ||
                step.pedagogicalDetails?.expectedStudentResponses?.length ||
                step.pedagogicalDetails?.fallbackRu) ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <PedagogicalSubsection title="Языковые модели">
                    <SummaryList items={step.pedagogicalDetails?.promptPatterns ?? []} emptyLabel="Шаблоны не указаны." />
                  </PedagogicalSubsection>
                  <PedagogicalSubsection title="Ответы и подсказки">
                    <SummaryList
                      items={step.pedagogicalDetails?.expectedStudentResponses ?? []}
                      emptyLabel="Ответы детей не указаны."
                    />
                    {step.pedagogicalDetails?.fallbackRu ? (
                      <p className="mt-2 text-xs text-neutral-600">RU fallback: {step.pedagogicalDetails.fallbackRu}</p>
                    ) : null}
                  </PedagogicalSubsection>
                </div>
              ) : null}

              {(step.pedagogicalDetails?.activitySteps?.length || step.pedagogicalDetails?.successCriteria?.length) ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <PedagogicalSubsection title="Как провести этап">
                    <SummaryList items={step.pedagogicalDetails?.activitySteps ?? []} emptyLabel="Шаги этапа не указаны." />
                  </PedagogicalSubsection>
                  <PedagogicalSubsection title="Критерии успеха">
                    <SummaryList
                      items={step.pedagogicalDetails?.successCriteria ?? []}
                      emptyLabel="Критерии не указаны."
                    />
                  </PedagogicalSubsection>
                </div>
              ) : null}

              {(step.pedagogicalDetails?.vocabularyItems?.length || step.materials.length || step.resources.length) ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {step.pedagogicalDetails?.vocabularyItems?.length ? (
                    <PedagogicalSubsection title="Лексика этапа">
                      <ul className="space-y-1.5 text-sm text-neutral-700">
                        {step.pedagogicalDetails.vocabularyItems.map((item) => (
                          <li key={`${step.id}-${item.term}-${item.pinyin}`}>
                            <span className="font-semibold text-neutral-900">{item.term}</span>{" "}
                            <span className="text-neutral-600">{item.pinyin}</span> — {item.meaning}
                          </li>
                        ))}
                      </ul>
                    </PedagogicalSubsection>
                  ) : null}

                  {step.materials.length ? (
                    <PedagogicalSubsection title="Материалы этапа">
                      <SummaryList items={step.materials} emptyLabel="Материалы не требуются." />
                    </PedagogicalSubsection>
                  ) : null}

                  {step.resources.length ? (
                    <PedagogicalSubsection title="Связанные ресурсы">
                      <ul className="space-y-1.5 text-sm text-neutral-700">
                        {step.resources.map((resource) => (
                          <li key={`${step.id}-${resource.kindLabel}-${resource.title}`}>
                            <span className="font-medium">{resource.kindLabel}:</span>{" "}
                            {resource.url ? (
                              <a
                                href={resource.url}
                                className="font-medium text-sky-700 underline underline-offset-2"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {resource.title}
                              </a>
                            ) : (
                              resource.title
                            )}
                          </li>
                        ))}
                      </ul>
                    </PedagogicalSubsection>
                  ) : null}
                </div>
              ) : null}

              {(step.pedagogicalDetails?.answerKeyHint ||
                step.pedagogicalDetails?.homeExtension ||
                step.pedagogicalDetails?.recapPoints?.length ||
                step.pedagogicalDetails?.exitCheck ||
                step.pedagogicalDetails?.previewNextLesson) ? (
                <PedagogicalSubsection title="Заметки преподавателю">
                  <ul className="space-y-1.5 text-sm text-neutral-700">
                    {step.pedagogicalDetails?.answerKeyHint ? <li>Подсказка по ответам: {step.pedagogicalDetails.answerKeyHint}</li> : null}
                    {step.pedagogicalDetails?.homeExtension ? <li>Домашнее продолжение: {step.pedagogicalDetails.homeExtension}</li> : null}
                    {step.pedagogicalDetails?.recapPoints?.map((point) => <li key={`${step.id}-${point}`}>Рекап: {point}</li>)}
                    {step.pedagogicalDetails?.exitCheck ? <li>Exit check: {step.pedagogicalDetails.exitCheck}</li> : null}
                    {step.pedagogicalDetails?.previewNextLesson ? (
                      <li>Следующий урок: {step.pedagogicalDetails.previewNextLesson}</li>
                    ) : null}
                  </ul>
                </PedagogicalSubsection>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
