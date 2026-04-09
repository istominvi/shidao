import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { ROUTES, toMethodologyRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherMethodologiesAccess,
  canAccessTeacherMethodologies,
  getTeacherMethodologiesIndexReadModel,
} from "@/lib/server/teacher-methodologies";

export default async function MethodologiesPage() {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherMethodologies(resolution)) {
    redirect(ROUTES.dashboard);
  }

  assertTeacherMethodologiesAccess(resolution);
  const readModel = await getTeacherMethodologiesIndexReadModel();

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container space-y-6 py-7 md:py-10">
        <AppPageHeader
          title="Методики"
          description="Педагогический source-слой: изучите курс, структуру уроков и формат преподавания, затем назначайте уроки в реальные группы и расписание."
          meta={<span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">Курсов: {readModel.cards.length}</span>}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          {readModel.cards.map((methodology) => (
            <AppCard key={methodology.id} className="p-5 md:p-6" as="article">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-neutral-950">{methodology.title}</h2>
                  {methodology.shortDescription ? <p className="mt-2 text-sm text-neutral-700">{methodology.shortDescription}</p> : null}
                </div>
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                  Доступно уроков: {methodology.lessonCount}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                {methodology.passport.targetAgeLabel ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Возраст: {methodology.passport.targetAgeLabel}</span> : null}
                {methodology.passport.level ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Уровень: {methodology.passport.level}</span> : null}
                {methodology.passport.lessonDurationLabel ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Урок: {methodology.passport.lessonDurationLabel}</span> : null}
                {methodology.passport.courseDurationLabel ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Курс: {methodology.passport.courseDurationLabel}</span> : null}
                {methodology.passport.approximateVocabularyCount ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-800">≈ {methodology.passport.approximateVocabularyCount} слов</span> : null}
                {methodology.passport.mediaFormatLabel ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-800">{methodology.passport.mediaFormatLabel}</span> : null}
                {methodology.passport.groupSizeLabel ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">Группа: {methodology.passport.groupSizeLabel}</span> : null}
              </div>

              {methodology.passport.thematicHighlights.length ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Тематические кластеры</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                    {methodology.passport.thematicHighlights.map((cluster) => (
                      <li key={cluster} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                        <span>{cluster}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {methodology.passport.learningHighlights.length ? (
                <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Формат и результаты обучения</p>
                  <ul className="mt-2 grid gap-1.5 text-sm text-neutral-700 md:grid-cols-2">
                    {methodology.passport.learningHighlights.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {methodology.passport.programLessonCount && methodology.passport.programLessonCount > methodology.lessonCount ? (
                <p className="mt-4 text-xs text-neutral-600">
                  Полная программа: около {methodology.passport.programLessonCount} уроков. Сейчас в ShiDao доступно {methodology.lessonCount}.
                </p>
              ) : null}

              <Link href={toMethodologyRoute(methodology.slug)} className="mt-5 inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
                Открыть методику
              </Link>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
