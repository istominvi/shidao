import { notFound, redirect } from "next/navigation";
import {
  BookOpen,
  CalendarRange,
  Clock3,
  GraduationCap,
  Shapes,
  Users,
} from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { MethodologyLessonsTableCard } from "@/components/methodologies/methodology-lessons-table-card";
import { Chip } from "@/components/ui/chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
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
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          backHref={ROUTES.methodologies}
          backLabel="Методики"
          title={readModel.methodology.title}
          description={readModel.methodology.shortDescription}
          meta={
            <>
              <Chip icon={BookOpen} tone="violet" size="md">
                Уроков: {readModel.overview.availableLessonsCount}
              </Chip>
              {normalizedCourseDurationLabel ? (
                <Chip icon={CalendarRange} tone="emerald" size="md">
                  Курс: {normalizedCourseDurationLabel}
                </Chip>
              ) : null}
              {passport.lessonDurationLabel ? (
                <Chip icon={Clock3} tone="amber" size="md">
                  Урок: {passport.lessonDurationLabel}
                </Chip>
              ) : null}
              {passport.targetAgeLabel ? (
                <Chip icon={GraduationCap} tone="sky" size="md">
                  Возраст: {passport.targetAgeLabel}
                </Chip>
              ) : null}
              {passport.idealGroupSizeLabel ? (
                <Chip icon={Users} tone="indigo" size="md">
                  Группа: {passport.idealGroupSizeLabel}
                </Chip>
              ) : null}
              {normalizedActivitiesLabel ? (
                <Chip icon={Shapes} tone="rose" size="md">
                  {normalizedActivitiesLabel}
                </Chip>
              ) : null}
            </>
          }
        />

        {overviewCards.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {overviewCards.map((card) => (
              <SurfaceCard
                key={card.title}
                className={`border p-5 md:p-6 ${card.surfaceClass}`}
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
              </SurfaceCard>
            ))}
          </section>
        ) : null}

        <section>
          <MethodologyLessonsTableCard
            methodologySlug={readModel.methodology.slug}
            rows={readModel.lessons}
          />
        </section>
      </div>
    </main>
  );
}
