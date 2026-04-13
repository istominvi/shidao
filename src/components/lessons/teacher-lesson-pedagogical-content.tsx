import { AppCard } from "@/components/app/app-card";
import { Chip } from "@/components/ui/chip";
import type { TeacherLessonWorkspacePresentation } from "@/lib/server/teacher-lesson-workspace";

function flowAccentClass(tone: "sky" | "violet" | "emerald" | "amber") {
  switch (tone) {
    case "sky":
      return "from-sky-500/20 via-sky-500/10 to-transparent";
    case "violet":
      return "from-violet-500/20 via-violet-500/10 to-transparent";
    case "emerald":
      return "from-emerald-500/20 via-emerald-500/10 to-transparent";
    default:
      return "from-amber-500/20 via-amber-500/10 to-transparent";
  }
}

function SummaryList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) return <p className="text-sm text-neutral-600">{emptyLabel}</p>;

  return (
    <ul className="mt-3 space-y-2 text-sm text-neutral-700">
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
  lessonFlow,
}: Pick<TeacherLessonWorkspacePresentation, "quickSummary" | "lessonFlow">) {
  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AppCard as="article" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Подготовка</p>
          <SummaryList items={quickSummary.prepChecklist.slice(0, 7)} emptyLabel="Чек-лист пока не заполнен." />
        </AppCard>

        <AppCard as="article" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ключевые слова</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickSummary.keyWords.length ? (
              quickSummary.keyWords.slice(0, 10).map((word) => (
                <Chip key={word} tone="sky">
                  {word}
                </Chip>
              ))
            ) : (
              <p className="text-sm text-neutral-600">Слова не указаны.</p>
            )}
          </div>
        </AppCard>

        <AppCard as="article" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ключевые фразы</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickSummary.keyPhrases.length ? (
              quickSummary.keyPhrases.slice(0, 8).map((phrase) => (
                <Chip key={phrase} tone="violet">
                  {phrase}
                </Chip>
              ))
            ) : (
              <p className="text-sm text-neutral-600">Фразы не указаны.</p>
            )}
          </div>
        </AppCard>

        <AppCard as="article" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ресурсы урока</p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {quickSummary.resources.length ? (
              quickSummary.resources.slice(0, 6).map((resource) => (
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
              ))
            ) : (
              <li className="text-neutral-600">Ресурсы не добавлены.</li>
            )}
          </ul>
        </AppCard>
      </section>

      <AppCard as="article" className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-neutral-900">Ход урока</h2>
          <Chip tone="neutral">{lessonFlow.length} этапов</Chip>
        </div>

        <div className="mt-5 space-y-4">
          {lessonFlow.map((step) => (
            <article key={step.id} className="relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white/90 p-4 md:p-5">
              <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${flowAccentClass(step.accentTone)}`} />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip className="border-neutral-900 bg-neutral-900 text-white">{step.stepLabel}</Chip>
                  <Chip tone="slate">{step.blockLabel}</Chip>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-neutral-950">{step.title}</h3>
                {step.description ? <p className="mt-2 text-sm leading-6 text-neutral-700">{step.description}</p> : null}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Действия преподавателя</p>
                    <SummaryList items={step.teacherActions} emptyLabel="Действия не указаны." />
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Действия детей</p>
                    <SummaryList items={step.studentActions} emptyLabel="Ожидаемые реакции не указаны." />
                  </div>
                </div>

                {(step.materials.length || step.resources.length) ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Материалы этапа</p>
                      <SummaryList items={step.materials} emptyLabel="Материалы не требуются." />
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Связанные ресурсы</p>
                      <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                        {step.resources.length ? step.resources.map((resource) => (
                          <li key={`${step.id}-${resource.kindLabel}-${resource.title}`}>
                            <span className="font-medium">{resource.kindLabel}:</span>{" "}
                            {resource.url ? (
                              <a href={resource.url} className="font-medium text-sky-700 underline underline-offset-2" target="_blank" rel="noreferrer">{resource.title}</a>
                            ) : resource.title}
                          </li>
                        )) : <li className="text-neutral-600">Связанные ресурсы не указаны.</li>}
                      </ul>
                    </div>
                  </div>
                ) : null}

                {step.pedagogicalDetails?.vocabularyItems?.length ? (
                  <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Лексика для преподавателя</p>
                    <ul className="mt-2 space-y-2 text-sm text-neutral-800">
                      {step.pedagogicalDetails.vocabularyItems.map((item) => (
                        <li key={`${step.id}-${item.term}-${item.pinyin}`} className="grid gap-1 rounded-xl bg-white/80 px-3 py-2 sm:grid-cols-[90px_1fr]">
                          <p className="text-base font-semibold text-neutral-950">{item.term}</p>
                          <p className="text-sm text-neutral-700">{item.pinyin} · {item.meaning}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(step.pedagogicalDetails?.promptPatterns?.length || step.pedagogicalDetails?.expectedStudentResponses?.length || step.pedagogicalDetails?.fallbackRu) ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">Шаблоны реплик преподавателя</p>
                      <SummaryList items={step.pedagogicalDetails?.promptPatterns ?? []} emptyLabel="Шаблоны не указаны." />
                    </div>
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">Ожидаемые ответы детей</p>
                      <SummaryList items={step.pedagogicalDetails?.expectedStudentResponses ?? []} emptyLabel="Ответы не указаны." />
                      {step.pedagogicalDetails?.fallbackRu ? <p className="mt-2 text-xs text-neutral-700">RU fallback: {step.pedagogicalDetails.fallbackRu}</p> : null}
                    </div>
                  </div>
                ) : null}

                {(step.pedagogicalDetails?.activitySteps?.length || step.pedagogicalDetails?.successCriteria?.length) ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Шаги активности</p>
                      <SummaryList items={step.pedagogicalDetails?.activitySteps ?? []} emptyLabel="Шаги не указаны." />
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Критерии успеха</p>
                      <SummaryList items={step.pedagogicalDetails?.successCriteria ?? []} emptyLabel="Критерии не указаны." />
                    </div>
                  </div>
                ) : null}

                {(step.pedagogicalDetails?.answerKeyHint || step.pedagogicalDetails?.homeExtension) ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Worksheet-подсказки</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                      {step.pedagogicalDetails.answerKeyHint ? <li>• Подсказка по ответам: {step.pedagogicalDetails.answerKeyHint}</li> : null}
                      {step.pedagogicalDetails.homeExtension ? <li>• Домашнее продолжение: {step.pedagogicalDetails.homeExtension}</li> : null}
                    </ul>
                  </div>
                ) : null}

                {(step.pedagogicalDetails?.recapPoints?.length || step.pedagogicalDetails?.exitCheck || step.pedagogicalDetails?.previewNextLesson) ? (
                  <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Финал и переход к следующему уроку</p>
                    {step.pedagogicalDetails?.recapPoints?.length ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-neutral-600">Рекап</p>
                        <SummaryList items={step.pedagogicalDetails.recapPoints} emptyLabel="Рекап не указан." />
                      </div>
                    ) : null}
                    {step.pedagogicalDetails?.exitCheck ? <p className="mt-2 text-sm text-neutral-700">Exit check: {step.pedagogicalDetails.exitCheck}</p> : null}
                    {step.pedagogicalDetails?.previewNextLesson ? <p className="mt-1 text-sm text-neutral-700">Следующий урок: {step.pedagogicalDetails.previewNextLesson}</p> : null}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </AppCard>
    </>
  );
}
