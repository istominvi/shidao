import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BookOpen,
  CalendarRange,
  ChartColumnBig,
  CircleGauge,
  Clock3,
  GraduationCap,
  Shapes,
  Users,
} from "lucide-react";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { SemanticChip } from "@/components/app/semantic-chip";
import { LessonContextChip } from "@/components/lessons/lesson-context-chip";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toMethodologyLessonRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherMethodologiesAccess,
  canAccessTeacherMethodologies,
  getTeacherMethodologyDetailReadModel,
} from "@/lib/server/teacher-methodologies";

export default async function MethodologyDetailPage({ params }: { params: Promise<{ methodologySlug: string }> }) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherMethodologies(resolution)) redirect(ROUTES.dashboard);
  assertTeacherMethodologiesAccess(resolution);

  const { methodologySlug } = await params;
  const readModel = await getTeacherMethodologyDetailReadModel(methodologySlug);
  if (!readModel) notFound();

  const passport = readModel.overview.passport;
  const fullScopeLabel = passport.courseScopeLabel ?? (readModel.overview.programLessonCount ? `~${readModel.overview.programLessonCount} уроков` : "Годовая программа");

  const overviewCards = [
    {
      title: "Для кого курс",
      points: [
        passport.audienceLabel,
        readModel.overview.teachingApproachSummary,
        passport.idealGroupSizeLabel ? `Рекомендуемый размер группы: ${passport.idealGroupSizeLabel}` : undefined,
        passport.maxGroupSize ? `Жёсткий максимум: ${passport.maxGroupSize} детей` : undefined,
      ].filter(Boolean) as string[],
    },
    {
      title: "Что дети осваивают",
      points: readModel.overview.learningOutcomes,
    },
    {
      title: "Тематическая структура",
      points: readModel.overview.thematicModules,
    },
    {
      title: "Формат урока и материалы",
      points: [
        passport.lessonFormatSummary,
        passport.activitiesPerLessonLabel,
        readModel.overview.materialsEcosystemSummary,
      ].filter(Boolean) as string[],
    },
    {
      title: "Методические заметки",
      points: readModel.overview.methodologyNotes,
    },
  ].filter((card) => card.points.length >= 2);

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container space-y-6 py-7 md:py-10">
        <AppPageHeader
          backHref={ROUTES.methodologies}
          backLabel="Методики"
          title={readModel.methodology.title}
          description={readModel.methodology.shortDescription}
          meta={
            <>
              <SemanticChip icon={BookOpen} tone="violet" size="md">
                Source-уроки: {readModel.overview.availableLessonsCount}
              </SemanticChip>
              {readModel.overview.programLessonCount ? (
                <SemanticChip icon={ChartColumnBig} tone="sky" size="md">
                  Полная программа: ~{readModel.overview.programLessonCount} уроков
                </SemanticChip>
              ) : null}
            </>
          }
        />

        <AppCard className="p-5 md:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">Полный объём курса</p>
              <p className="mt-1 text-sm text-sky-900">{fullScopeLabel}</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-800">Импортировано в ShiDao</p>
              <p className="mt-1 text-sm text-violet-900">{readModel.overview.availableLessonsCount} source-урок(ов), доступных для назначения</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {passport.targetAgeLabel ? (
              <SemanticChip icon={GraduationCap} tone="sky">Возраст: {passport.targetAgeLabel}</SemanticChip>
            ) : null}
            {passport.lessonDurationLabel ? (
              <SemanticChip icon={Clock3} tone="amber">Урок: {passport.lessonDurationLabel}</SemanticChip>
            ) : null}
            {passport.courseDurationLabel ? (
              <SemanticChip icon={CalendarRange} tone="neutral">Курс: {passport.courseDurationLabel}</SemanticChip>
            ) : null}
            {passport.idealGroupSizeLabel ? (
              <SemanticChip icon={Users} tone="emerald">
                Группа: {passport.idealGroupSizeLabel}{passport.maxGroupSize ? ` (макс. ${passport.maxGroupSize})` : ""}
              </SemanticChip>
            ) : null}
            {passport.activitiesPerLessonLabel ? (
              <SemanticChip icon={Shapes} tone="violet">{passport.activitiesPerLessonLabel}</SemanticChip>
            ) : null}
            {passport.approximateVocabularyCount ? (
              <SemanticChip icon={CircleGauge} tone="sky">≈ {passport.approximateVocabularyCount} слов</SemanticChip>
            ) : null}
          </div>
        </AppCard>

        <section className="grid gap-4 lg:grid-cols-2">
          {overviewCards.map((card) => (
            <AppCard key={card.title} className="p-5" as="article">
              <h2 className="text-lg font-semibold text-neutral-900">{card.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                {card.points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
            </AppCard>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-950">Уроки в ShiDao</h2>
          {readModel.lessons.map((lesson) => (
            <AppCard key={lesson.id} className="p-5" as="article">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-950">{lesson.title}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{lesson.positionLabel} · {lesson.durationLabel} · {lesson.readinessLabel}</p>
                  {lesson.vocabularyPreview.length ? <p className="mt-2 text-sm text-neutral-700">Лексика: {lesson.vocabularyPreview.join(", ")}</p> : null}
                  {lesson.phrasePreview.length ? <p className="mt-1 text-sm text-neutral-700">Фразы: {lesson.phrasePreview.join(" · ")}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-700">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">Видео: {lesson.mediaSummary.videos}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">Песни: {lesson.mediaSummary.songs}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">Worksheet: {lesson.mediaSummary.worksheets}</span>
                    {lesson.materialsSignal ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">Нужна подготовка материалов</span> : null}
                    {lesson.homeworkSignal ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-800">{lesson.homeworkLabel ?? "Есть домашнее задание"}</span> : null}
                  </div>
                </div>
                <LessonContextChip context="methodology" />
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)} className="landing-btn landing-btn-primary text-xs">Открыть урок</Link>
                <Link href={`${toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)}?assign=1`} className="landing-btn landing-btn-muted text-xs">Назначить</Link>
              </div>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
