import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarRange, CircleGauge, Clock3, GraduationCap, Shapes, Users } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { SemanticChip } from "@/components/app/semantic-chip";
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
          description="Педагогический source layer: изучите курс и уроки методики, затем назначайте их группам в runtime-расписание."
        />

        <section className="grid gap-4 lg:grid-cols-2">
          {readModel.cards.map((methodology) => (
            <AppCard key={methodology.id} className="p-5 md:p-6" as="article">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-neutral-950">{methodology.title}</h2>
                  {methodology.shortDescription ? <p className="mt-2 text-sm text-neutral-700">{methodology.shortDescription}</p> : null}
                </div>
                <SemanticChip icon={BookOpen} tone="violet" size="md">Уроки: {methodology.lessonCount}</SemanticChip>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                {methodology.passport.targetAgeLabel ? <SemanticChip icon={GraduationCap} tone="sky" size="md">Возраст: {methodology.passport.targetAgeLabel}</SemanticChip> : null}
                {methodology.passport.lessonDurationLabel ? <SemanticChip icon={Clock3} tone="amber" size="md">Время урока: {methodology.passport.lessonDurationLabel}</SemanticChip> : null}
                {methodology.passport.courseDurationLabel ? <SemanticChip icon={CalendarRange} tone="emerald" size="md">Курс: {methodology.passport.courseDurationLabel}</SemanticChip> : null}
                {methodology.passport.groupSizeLabel ? <SemanticChip icon={Users} tone="neutral" size="md">Группа: {methodology.passport.groupSizeLabel}</SemanticChip> : null}
                {methodology.passport.approximateVocabularyCount ? <SemanticChip icon={CircleGauge} tone="rose" size="md">≈ {methodology.passport.approximateVocabularyCount} слов</SemanticChip> : null}
                {methodology.passport.mediaFormatLabel ? <SemanticChip icon={Shapes} tone="indigo" size="md">{methodology.passport.mediaFormatLabel}</SemanticChip> : null}
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

              <Link href={toMethodologyRoute(methodology.slug)} className="landing-btn landing-btn-primary mt-5 text-sm">
                Открыть методику
              </Link>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
