import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BookOpen,
  CalendarClock,
  CalendarRange,
  Clock3,
  Eye,
  GraduationCap,
  Music2,
  Shapes,
  Users,
  Video,
  ClipboardCheck,
} from "lucide-react";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { SemanticChip } from "@/components/app/semantic-chip";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toMethodologyLessonRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherMethodologiesAccess,
  canAccessTeacherMethodologies,
  getTeacherMethodologyDetailReadModel,
} from "@/lib/server/teacher-methodologies";

export default async function MethodologyDetailPage({
  params,
}: {
  params: Promise<{ methodologySlug: string }>;
}) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherMethodologies(resolution)) redirect(ROUTES.dashboard);
  assertTeacherMethodologiesAccess(resolution);

  const { methodologySlug } = await params;
  const readModel = await getTeacherMethodologyDetailReadModel(methodologySlug);
  if (!readModel) notFound();

  const passport = readModel.overview.passport;
  const normalizedCourseDurationLabel = passport.courseDurationLabel
    ? passport.courseDurationLabel === "1 учебный год"
      ? "1 год"
      : passport.courseDurationLabel
    : null;
  const normalizedActivitiesLabel = passport.activitiesPerLessonLabel
    ? `Активностей: ${passport.activitiesPerLessonLabel
        .replace(/^Обычно:\s*/i, "")
        .replace(/^Обычно\s+/i, "")
        .replace(/\s*активност(?:ей|и)\s*$/i, "")
        .trim()}`
    : null;

  const overviewCards = [
    {
      title: "Для кого курс",
      surfaceClass: "border-sky-200/80 bg-sky-50/35",
      dotClass: "bg-sky-500/70",
      points: [
        passport.audienceLabel,
        readModel.overview.teachingApproachSummary,
        passport.idealGroupSizeLabel
          ? `Рекомендуемый размер группы: ${passport.idealGroupSizeLabel}`
          : undefined,
        passport.maxGroupSize
          ? `Жёсткий максимум: ${passport.maxGroupSize} детей`
          : undefined,
      ].filter(Boolean) as string[],
    },
    {
      title: "Что дети осваивают",
      surfaceClass: "border-emerald-200/80 bg-emerald-50/35",
      dotClass: "bg-emerald-500/70",
      points: readModel.overview.learningOutcomes,
    },
    {
      title: "Тематическая структура",
      surfaceClass: "border-violet-200/80 bg-violet-50/35",
      dotClass: "bg-violet-500/70",
      points: readModel.overview.thematicModules,
    },
    {
      title: "Формат урока и материалы",
      surfaceClass: "border-amber-200/80 bg-amber-50/35",
      dotClass: "bg-amber-500/70",
      points: [
        passport.lessonFormatSummary,
        passport.activitiesPerLessonLabel,
        readModel.overview.materialsEcosystemSummary,
      ].filter(Boolean) as string[],
    },
    {
      title: "Методические заметки",
      surfaceClass: "border-rose-200/80 bg-rose-50/35",
      dotClass: "bg-rose-500/70",
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
                Уроков: {readModel.overview.availableLessonsCount}
              </SemanticChip>
              {normalizedCourseDurationLabel ? (
                <SemanticChip icon={CalendarRange} tone="emerald" size="md">
                  Курс: {normalizedCourseDurationLabel}
                </SemanticChip>
              ) : null}
              {passport.lessonDurationLabel ? (
                <SemanticChip icon={Clock3} tone="amber" size="md">
                  Урок: {passport.lessonDurationLabel}
                </SemanticChip>
              ) : null}
              {passport.targetAgeLabel ? (
                <SemanticChip icon={GraduationCap} tone="sky" size="md">
                  Возраст: {passport.targetAgeLabel}
                </SemanticChip>
              ) : null}
              {passport.idealGroupSizeLabel ? (
                <SemanticChip icon={Users} tone="indigo" size="md">
                  Группа: {passport.idealGroupSizeLabel}
                </SemanticChip>
              ) : null}
              {normalizedActivitiesLabel ? (
                <SemanticChip icon={Shapes} tone="rose" size="md">
                  {normalizedActivitiesLabel}
                </SemanticChip>
              ) : null}
            </>
          }
        />

        <section className="grid gap-4 lg:grid-cols-2">
          {overviewCards.map((card) => (
            <AppCard
              key={card.title}
              className={`p-5 md:p-6 ${card.surfaceClass}`}
              as="article"
            >
              <h2 className="text-lg font-semibold text-neutral-900">
                {card.title}
              </h2>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-neutral-700">
                {card.points.map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span
                      className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${card.dotClass}`}
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </AppCard>
          ))}
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-950">
            Уроки
          </h2>
          {readModel.lessons.map((lesson) => (
            <AppCard key={lesson.id} className="px-6 py-5" as="article">
              <div>
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-neutral-950">
                  <span>{lesson.title}</span>
                  {lesson.mediaSummary.videos > 0 ? (
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50/90 text-sky-800"
                      title="В уроке есть видео"
                      aria-label="В уроке есть видео"
                    >
                      <Video className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                  {lesson.mediaSummary.songs > 0 ? (
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-violet-200 bg-violet-50/90 text-violet-800"
                      title="В уроке есть песни"
                      aria-label="В уроке есть песни"
                    >
                      <Music2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                  {lesson.homeworkSignal ? (
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50/90 text-emerald-800"
                      title="Есть домашнее задание: квиз"
                      aria-label="Есть домашнее задание: квиз"
                    >
                      <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                </h3>
                {lesson.vocabularyPreview.length ? (
                  <p className="mt-2 text-sm text-neutral-700">
                    Лексика: {lesson.vocabularyPreview.join(", ")}
                  </p>
                ) : null}
                {lesson.phrasePreview.length ? (
                  <p className="mt-1 text-sm text-neutral-700">
                    Фразы: {lesson.phrasePreview.join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={toMethodologyLessonRoute(
                    readModel.methodology.slug,
                    lesson.id,
                  )}
                  className="landing-chip border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:-translate-y-0.5 hover:bg-neutral-50"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Смотреть</span>
                </Link>
                <Link
                  href={`${toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)}?assign=1`}
                  className="landing-chip border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:-translate-y-0.5 hover:bg-neutral-50"
                >
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Назначить</span>
                </Link>
              </div>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
