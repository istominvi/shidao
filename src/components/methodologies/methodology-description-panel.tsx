import {
  ProductTable,
  ProductTableBody,
  ProductTableCell,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTablePrimaryCell,
  ProductTableRow,
} from "@/components/ui/product-table";
import type {
  MethodologyProgramDescription,
  MethodologyProgramDescriptionSection,
  MethodologyProgramDescriptionSectionTone,
} from "@/lib/lesson-content/contracts";
import { classNames } from "@/lib/ui/classnames";

type MethodologyOverview = {
  passport: {
    audienceLabel?: string;
    targetAgeLabel?: string;
    level?: string;
    lessonDurationLabel?: string;
    courseDurationLabel?: string;
    courseScopeLabel?: string;
    idealGroupSizeLabel?: string;
    maxGroupSize?: number;
    activitiesPerLessonLabel?: string;
    lessonFormatSummary?: string;
  };
  teachingApproachSummary?: string;
  learningOutcomes: string[];
  thematicModules: string[];
  methodologyNotes: string[];
  materialsEcosystemSummary?: string;
};

const toneClassName: Record<MethodologyProgramDescriptionSectionTone, string> = {
  sky: "border-sky-200/80 bg-sky-50/40",
  emerald: "border-emerald-200/80 bg-emerald-50/40",
  violet: "border-violet-200/80 bg-violet-50/40",
  amber: "border-amber-200/80 bg-amber-50/40",
  rose: "border-rose-200/80 bg-rose-50/40",
  slate: "border-slate-200/80 bg-slate-50/50",
};

function renderSection(section: MethodologyProgramDescriptionSection) {
  const cardTone = section.tone ? toneClassName[section.tone] : "border-neutral-200 bg-neutral-50/40";

  if (section.kind === "grouped") {
    return (
      <article key={section.id} className={classNames("rounded-2xl border p-4 md:p-5", cardTone)}>
        <h3 className="text-base font-semibold text-neutral-900">{section.title}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {section.groups.map((group) => (
            <section key={group.id} className="space-y-2.5 rounded-xl border border-neutral-200 bg-white/70 p-3.5">
              <h4 className="text-sm font-semibold text-neutral-900">{group.title}</h4>
              <ul className="space-y-1.5 text-sm text-neutral-700">
                {group.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article key={section.id} className={classNames("rounded-2xl border p-4 md:p-5", cardTone)}>
      <h3 className="text-base font-semibold text-neutral-900">{section.title}</h3>
      {section.paragraphs?.length ? (
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-neutral-700">
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      {section.bullets?.length ? (
        <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function MethodologyDescriptionPanel({
  overview,
  programDescription,
}: {
  overview: MethodologyOverview;
  programDescription: MethodologyProgramDescription | null;
}) {
  if (!programDescription) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5 text-sm text-neutral-700">
        Описание рабочей программы пока не добавлено.
      </section>
    );
  }

  const passportCards = [
    { label: "Аудитория", value: overview.passport.audienceLabel },
    { label: "Возраст", value: overview.passport.targetAgeLabel },
    { label: "Уровень", value: overview.passport.level },
    { label: "Формат урока", value: overview.passport.lessonDurationLabel },
    { label: "Длительность курса", value: overview.passport.courseDurationLabel },
    { label: "Объём", value: overview.passport.courseScopeLabel },
    { label: "Группа", value: overview.passport.idealGroupSizeLabel },
    { label: "Максимум в группе", value: overview.passport.maxGroupSize ? `${overview.passport.maxGroupSize} детей` : undefined },
  ].filter((item) => item.value);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">О программе</h2>
        {programDescription.sourceNote ? (
          <p className="text-sm text-neutral-500">{programDescription.sourceNote}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(programDescription.programFacts ?? []).map((fact) => (
            <article key={fact.id} className="rounded-xl border border-neutral-200 bg-white/70 p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{fact.label}</p>
              <p className="mt-1.5 text-sm font-medium text-neutral-900">{fact.value}</p>
            </article>
          ))}
        </div>
        {passportCards.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {passportCards.map((card) => (
              <article key={card.label} className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{card.label}</p>
                <p className="mt-1.5 text-sm font-medium text-neutral-900">{card.value}</p>
              </article>
            ))}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {overview.teachingApproachSummary ? (
            <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Подход</h3>
              <p className="mt-2 text-sm text-neutral-700">{overview.teachingApproachSummary}</p>
            </article>
          ) : null}
          {overview.passport.lessonFormatSummary ? (
            <article className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Формат занятия</h3>
              <p className="mt-2 text-sm text-neutral-700">{overview.passport.lessonFormatSummary}</p>
            </article>
          ) : null}
        </div>
        {programDescription.summarySections.length ? (
          <div className="grid gap-3">{programDescription.summarySections.map(renderSection)}</div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Цели и задачи</h2>
        <div className="grid gap-3">{programDescription.goalAndTaskSections.map(renderSection)}</div>
        {programDescription.valueOrientations?.length ? (
          <article className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 md:p-5">
            <h3 className="text-base font-semibold text-neutral-900">Ценностные ориентиры</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              {programDescription.valueOrientations.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Учебно-тематический план</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95">
          <ProductTable className="table-auto">
            <colgroup>
              <col className="w-[18rem]" />
              <col className="w-[22rem]" />
              <col className="w-px" />
              <col className="w-px" />
              <col className="w-[18rem]" />
            </colgroup>
            <ProductTableHead>
              <ProductTableHeaderRow>
                <ProductTableHeaderCell>Раздел</ProductTableHeaderCell>
                <ProductTableHeaderCell>Уроки</ProductTableHeaderCell>
                <ProductTableHeaderCell className="whitespace-nowrap">Часы</ProductTableHeaderCell>
                <ProductTableHeaderCell className="whitespace-nowrap">Период</ProductTableHeaderCell>
                <ProductTableHeaderCell>Грамматика</ProductTableHeaderCell>
              </ProductTableHeaderRow>
            </ProductTableHead>
            <ProductTableBody>
              {programDescription.curriculumPlan.map((row) => (
                <ProductTableRow key={row.id}>
                  <ProductTablePrimaryCell className="align-top">{row.title}</ProductTablePrimaryCell>
                  <ProductTableCell className="align-top">
                    <ul className="space-y-1">
                      {row.lessons.map((lesson) => (
                        <li key={lesson}>{lesson}</li>
                      ))}
                    </ul>
                  </ProductTableCell>
                  <ProductTableCell className="align-top whitespace-nowrap">{row.lessonCount}</ProductTableCell>
                  <ProductTableCell className="align-top whitespace-nowrap">{row.dateRange}</ProductTableCell>
                  <ProductTableCell className="align-top">{row.grammar}</ProductTableCell>
                </ProductTableRow>
              ))}
            </ProductTableBody>
          </ProductTable>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Результаты обучения</h2>
        <div className="grid gap-3">{programDescription.resultSections.map(renderSection)}</div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Характеристика курса</h2>
        <div className="grid gap-3">{programDescription.courseCharacteristicSections.map(renderSection)}</div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Методическое обеспечение</h2>
        <div className="grid gap-3">{programDescription.methodologySupportSections.map(renderSection)}</div>
      </section>

      {programDescription.additionalSections?.length || programDescription.bibliography?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Дополнительно</h2>
          {programDescription.additionalSections?.length ? (
            <div className="grid gap-3">{programDescription.additionalSections.map(renderSection)}</div>
          ) : null}
          {programDescription.bibliography?.length ? (
            <details className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Список литературы</summary>
              <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
                {programDescription.bibliography.map((source) => (
                  <li key={source} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                    <span>{source}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {(overview.learningOutcomes.length || overview.thematicModules.length || overview.methodologyNotes.length || overview.materialsEcosystemSummary) ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Практические заметки методики</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {overview.learningOutcomes.length ? (
              <article className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <h3 className="text-sm font-semibold text-neutral-900">Что дети осваивают</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                  {overview.learningOutcomes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}
            {overview.thematicModules.length ? (
              <article className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <h3 className="text-sm font-semibold text-neutral-900">Тематические модули</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                  {overview.thematicModules.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}
            {overview.methodologyNotes.length ? (
              <article className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <h3 className="text-sm font-semibold text-neutral-900">Методические заметки</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                  {overview.methodologyNotes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}
            {overview.materialsEcosystemSummary ? (
              <article className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <h3 className="text-sm font-semibold text-neutral-900">Материалы и экосистема урока</h3>
                <p className="mt-2 text-sm text-neutral-700">{overview.materialsEcosystemSummary}</p>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
