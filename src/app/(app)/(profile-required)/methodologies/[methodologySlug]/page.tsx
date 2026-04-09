import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
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

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader
          backHref={ROUTES.methodologies}
          backLabel="Методики"
          eyebrow="Обзор методики"
          title={readModel.methodology.title}
          description={readModel.methodology.shortDescription}
          meta={
            <>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">
                Возраст: {readModel.passport.targetAgeLabel}
              </span>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">
                Уровень: {readModel.passport.level}
              </span>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">
                Урок: {readModel.passport.lessonDurationLabel}
              </span>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">
                В ShiDao: {readModel.lessons.length} урок(ов)
              </span>
            </>
          }
        />

        <AppCard className="p-5 md:p-6">
          <p className="text-sm text-neutral-700">
            Эта страница — <span className="font-semibold text-neutral-900">педагогический source layer</span>. Здесь вы изучаете программу и формат уроков, а группу/дату назначаете позже в runtime через кнопку «Назначить».
          </p>
        </AppCard>

        <section className="grid gap-4 lg:grid-cols-2">
          <AppCard className="p-5">
            <h2 className="text-lg font-semibold text-neutral-950">Паспорт курса</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li><span className="font-medium text-neutral-900">Длительность курса:</span> {readModel.passport.courseDurationLabel}</li>
              <li><span className="font-medium text-neutral-900">Объём словаря:</span> ~{readModel.passport.approximateVocabularyCount ?? "—"} слов</li>
              <li><span className="font-medium text-neutral-900">Медиа-формат:</span> {readModel.passport.songCount ?? "—"} песен · {readModel.passport.videoCount ?? "—"} видео</li>
              <li><span className="font-medium text-neutral-900">Группа:</span> {readModel.passport.idealGroupSizeLabel} (макс. {readModel.passport.maxGroupSize ?? "—"})</li>
              <li><span className="font-medium text-neutral-900">Материалы:</span> {readModel.passport.materialsEcosystemSummary}</li>
            </ul>
          </AppCard>
          <AppCard className="p-5">
            <h2 className="text-lg font-semibold text-neutral-950">Подход и результаты обучения</h2>
            <p className="mt-2 text-sm text-neutral-700">{readModel.passport.teachingApproachSummary}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              {readModel.passport.learningOutcomes.map((outcome) => (
                <li key={outcome} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />{outcome}</li>
              ))}
            </ul>
          </AppCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <AppCard className="p-5">
            <h2 className="text-lg font-semibold text-neutral-950">Тематическая структура</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.passport.thematicModules.map((module) => (
                <li key={module} className="rounded-xl border border-neutral-200 bg-white/80 px-3 py-2">{module}</li>
              ))}
            </ul>
          </AppCard>
          <AppCard className="p-5">
            <h2 className="text-lg font-semibold text-neutral-950">Методические акценты</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.passport.methodologyNotes.map((note) => (
                <li key={note} className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2">{note}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-600">{readModel.passport.courseScopeLabel}</p>
            <p className="mt-1 text-xs text-neutral-600">{readModel.passport.lessonAvailabilityNote}</p>
          </AppCard>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-neutral-950">Уроки методики</h2>
          {readModel.lessons.map((lesson) => (
            <AppCard key={lesson.id} className="p-5" as="article">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-950">{lesson.title}</h2>
                  <p className="mt-1 text-sm text-neutral-600">{lesson.positionLabel} · {lesson.durationLabel} · {lesson.readinessLabel}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {lesson.vocabularyPreview.map((word) => (
                      <span key={word} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">{word}</span>
                    ))}
                    {lesson.phrasePreview.map((phrase) => (
                      <span key={phrase} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900">{phrase}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-neutral-600">
                    Медиа: {lesson.mediaSummary.videos} видео · {lesson.mediaSummary.songs} песен · {lesson.mediaSummary.worksheets} worksheet
                    {lesson.hasMaterialsPreparation ? " · есть подготовка материалов" : ""}
                    {lesson.hasHomework ? " · есть задание/worksheet" : ""}
                  </p>
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
