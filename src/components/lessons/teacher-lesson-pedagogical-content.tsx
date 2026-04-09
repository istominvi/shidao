import { AppCard } from "@/components/app/app-card";
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

function ActionList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeacherLessonPedagogicalContent({
  quickSummary,
  lessonFlow,
}: Pick<TeacherLessonWorkspacePresentation, "quickSummary" | "lessonFlow">) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AppCard as="article" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Подготовка</p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {quickSummary.prepChecklist.slice(0, 7).map((item) => (
              <li key={item} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />{item}</li>
            ))}
          </ul>
        </AppCard>
        <AppCard as="article" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ключевая лексика</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickSummary.keyWords.length ? quickSummary.keyWords.slice(0, 10).map((word) => (
              <span key={word} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">{word}</span>
            )) : <p className="text-sm text-neutral-600">Слова не указаны.</p>}
          </div>
        </AppCard>
        <AppCard as="article" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ключевые фразы</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickSummary.keyPhrases.length ? quickSummary.keyPhrases.slice(0, 8).map((phrase) => (
              <span key={phrase} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900">{phrase}</span>
            )) : <p className="text-sm text-neutral-600">Фразы не указаны.</p>}
          </div>
        </AppCard>
        <AppCard as="article" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ресурсы урока</p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {quickSummary.resources.length ? quickSummary.resources.slice(0, 5).map((resource) => (
              <li key={`${resource.kindLabel}-${resource.title}`}>
                <span className="font-medium text-neutral-900">{resource.kindLabel}:</span>{" "}
                {resource.url ? <a href={resource.url} className="text-sky-700 underline underline-offset-2" target="_blank" rel="noreferrer">{resource.title}</a> : resource.title}
              </li>
            )) : <li className="text-neutral-600">Ресурсы не указаны.</li>}
          </ul>
        </AppCard>
      </section>

      <AppCard as="article" className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-neutral-900">Ход урока</h2>
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">{lessonFlow.length} этапов</span>
        </div>
        <div className="mt-5 space-y-4">
          {lessonFlow.map((step) => (
            <article key={step.id} className="relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white/90 p-4 md:p-5">
              <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${flowAccentClass(step.accentTone)}`} />
              <div className="relative space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white">{step.stepLabel}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{step.blockLabel}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-neutral-950">{step.title}</h3>
                  {step.description ? <p className="mt-2 text-sm leading-6 text-neutral-700">{step.description}</p> : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ActionList title="Действия преподавателя" items={step.teacherActions} />
                  <ActionList title="Действия учеников" items={step.studentActions} />
                </div>

                {(step.materials.length || step.resources.length) ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {step.materials.length ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Материалы шага</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {step.materials.map((item) => (
                            <span key={item} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">{item}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {step.resources.length ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Связанные ресурсы</p>
                        <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                          {step.resources.map((resource) => (
                            <li key={`${step.id}-${resource.kindLabel}-${resource.title}`}>
                              <span className="font-medium text-neutral-900">{resource.kindLabel}:</span>{" "}
                              {resource.url ? (
                                <a href={resource.url} className="text-sky-700 underline underline-offset-2" target="_blank" rel="noreferrer">
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
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </AppCard>
    </div>
  );
}
