import { Chip } from "@/components/ui/chip";
import type { MethodologyDescriptionContent } from "@/lib/methodologies/description-content";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-neutral-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      {subtitle ? <p className="text-sm text-neutral-600">{subtitle}</p> : null}
    </div>
  );
}

export function MethodologyDescriptionPanel({
  title,
  shortDescription,
  coverImage,
  content,
}: {
  title: string;
  shortDescription: string | null | undefined;
  coverImage: { src: string; alt: string } | null;
  content: MethodologyDescriptionContent;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white via-sky-50/40 to-violet-50/50 p-4 md:p-6">
        <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
          {coverImage ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-black/10 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImage.src} alt={coverImage.alt} className="h-full w-full object-contain" />
            </div>
          ) : null}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-neutral-950">Паспорт курса</h2>
              <p className="mt-1 text-sm text-neutral-600">{title}</p>
              {shortDescription ? <p className="mt-2 text-sm text-neutral-700">{shortDescription}</p> : null}
            </div>
            <p className="text-sm leading-6 text-neutral-700">{content.heroSummary}</p>
            <div className="flex flex-wrap gap-2">
              {content.summaryMarkers.map((marker) => (
                <Chip key={marker} tone="sky" size="sm">
                  {marker}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-label="О программе">
        <SectionTitle title="О программе" />
        <div className="grid gap-3 md:grid-cols-2">
          {content.aboutProgram.map((block) => (
            <article key={block.title} className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">{block.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{block.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-label="Цели и задачи курса">
        <SectionTitle title="Цели и задачи курса" />
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Цели</h3>
          <div className="mt-3">
            <BulletList items={content.goals} />
          </div>
        </article>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {content.objectives.map((objective) => (
            <article key={objective.group} className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">{objective.group} задачи</h3>
              <div className="mt-3">
                <BulletList items={objective.items} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-label="Ценностные ориентиры">
        <SectionTitle title="Ценностные ориентиры" />
        <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
          <BulletList items={content.valueGuidelines} />
        </article>
      </section>

      <section className="space-y-4" aria-label="Учебно-тематический план">
        <SectionTitle title="Учебно-тематический план" />
        <article className="rounded-xl border border-neutral-200 bg-white p-4 md:p-5">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] divide-y divide-neutral-200 text-sm text-neutral-700">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-4 font-semibold">Раздел</th>
                  <th className="py-2 pr-4 font-semibold">Темы уроков</th>
                  <th className="py-2 pr-4 font-semibold">Часы</th>
                  <th className="py-2 pr-4 font-semibold">Период</th>
                  <th className="py-2 font-semibold">Грамматика</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {content.curriculumPlan.map((row) => (
                  <tr key={row.section} className="align-top">
                    <td className="py-3 pr-4 font-medium text-neutral-900">{row.section}</td>
                    <td className="py-3 pr-4">
                      <ul className="space-y-1">
                        {row.lessonTopics.map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-3 pr-4">{row.hours}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{row.period}</td>
                    <td className="py-3">
                      <ul className="space-y-1">
                        {row.grammar.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Teacher note</p>
            <div className="mt-2">
              <BulletList items={content.curriculumNote} />
            </div>
          </div>
        </article>
      </section>

      <section className="space-y-4" aria-label="Результаты обучения">
        <SectionTitle title="Результаты обучения" />
        <div className="grid gap-3 lg:grid-cols-3">
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Личностные результаты</h3>
            <div className="mt-3">
              <BulletList items={content.learningResults.personal} />
            </div>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Метапредметные результаты</h3>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Познавательные УУД</p>
                <div className="mt-1.5">
                  <BulletList items={content.learningResults.meta.cognitive} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Регулятивные</p>
                <div className="mt-1.5">
                  <BulletList items={content.learningResults.meta.regulatory} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Коммуникативные</p>
                <div className="mt-1.5">
                  <BulletList items={content.learningResults.meta.communicative} />
                </div>
              </div>
            </div>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Предметные результаты</h3>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Ученик знает</p>
                <div className="mt-1.5">
                  <BulletList items={content.learningResults.subject.knowledge} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Ученик умеет говорить</p>
                <div className="mt-1.5">
                  <BulletList items={content.learningResults.subject.speaking} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Ученик умеет аудировать</p>
                <div className="mt-1.5">
                  <BulletList items={content.learningResults.subject.listening} />
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="space-y-4" aria-label="Коммуникативные умения">
        <SectionTitle title="Коммуникативные умения" />
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Аудирование</h3>
            <div className="mt-3">
              <BulletList items={content.communicativeSkills.listening} />
            </div>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Говорение</h3>
            <div className="mt-3">
              <BulletList items={content.communicativeSkills.speaking} />
            </div>
          </article>
        </div>
      </section>

      <section className="space-y-4" aria-label="Языковые средства и содержание курса">
        <SectionTitle title="Языковые средства и содержание курса" />
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Лексика</h3>
            <div className="mt-3">
              <BulletList items={content.languageContent.lexical} />
            </div>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Грамматика</h3>
            <div className="mt-3">
              <BulletList items={content.languageContent.grammar} />
            </div>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Социокультурный блок</h3>
            <div className="mt-3">
              <BulletList items={content.languageContent.sociocultural} />
            </div>
          </article>
        </div>
      </section>

      <section className="space-y-4" aria-label="Методическое обеспечение">
        <SectionTitle title="Методическое обеспечение" />
        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Формы работы</h3>
            <div className="mt-3">
              <BulletList items={content.methodologicalSupport.workFormats} />
            </div>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Виды работы</h3>
            <div className="mt-3">
              <BulletList items={content.methodologicalSupport.workTypes} />
            </div>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Методические принципы</h3>
            <div className="mt-3">
              <BulletList items={content.methodologicalSupport.principles} />
            </div>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Что формируется у детей</h3>
            <div className="mt-3">
              <BulletList items={content.methodologicalSupport.childOutcomes} />
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
