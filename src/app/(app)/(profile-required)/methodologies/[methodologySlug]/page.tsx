import { revalidatePath } from "next/cache";
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
import { AssignLessonDialog } from "@/components/lessons/assign-lesson-dialog";
import { Chip } from "@/components/ui/chip";
import { MethodologyEntityCard } from "@/components/methodologies/methodology-entity-card";
import { ActionLink, productActionClassName } from "@/components/ui/action";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toLessonWorkspaceRoute, toMethodologyLessonRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { listTeacherClassesAdmin } from "@/lib/server/lesson-content-repository";
import {
  assertTeacherMethodologiesAccess,
  canAccessTeacherMethodologies,
  createScheduledLessonFromMethodology,
  getTeacherMethodologyDetailReadModel,
  parseAssignLessonFromMethodologyFormData,
} from "@/lib/server/teacher-methodologies";

export default async function MethodologyDetailPage({
  params,
}: {
  params: Promise<{ methodologySlug: string }>;
}) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherMethodologies(resolution)) redirect(ROUTES.dashboard);
  const { teacherId } = assertTeacherMethodologiesAccess(resolution);

  const { methodologySlug } = await params;
  const readModel = await getTeacherMethodologyDetailReadModel(methodologySlug);
  if (!readModel) notFound();
  const groups = (await listTeacherClassesAdmin(teacherId))
    .filter((group) => group.methodologyId === readModel.methodology.id)
    .map((group) => ({ id: group.id, label: group.name?.trim() || "Группа" }));

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
        ) : null}

        <section className="mt-6 space-y-3">
          {readModel.lessons.map((lesson) => (
            <MethodologyEntityCard
              key={lesson.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span>{lesson.title}</span>
                  {lesson.mediaSummary.videos > 0 ? (
                    <span
                      title="В уроке есть видео"
                      aria-label="В уроке есть видео"
                      className="text-sky-700"
                    >
                      <Video
                        className="h-3.5 w-3.5"
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                    </span>
                  ) : null}
                  {lesson.mediaSummary.songs > 0 ? (
                    <span
                      title="В уроке есть песни"
                      aria-label="В уроке есть песни"
                      className="text-violet-700"
                    >
                      <Music2
                        className="h-3.5 w-3.5"
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                    </span>
                  ) : null}
                  {lesson.homeworkSignal ? (
                    <span
                      title="Есть домашнее задание: квиз"
                      aria-label="Есть домашнее задание: квиз"
                      className="text-emerald-700"
                    >
                      <ClipboardCheck
                        className="h-3.5 w-3.5"
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                    </span>
                  ) : null}
                </span>
              }
              description={
                <>
                  {lesson.vocabularyPreview.length ? (
                    <span>Лексика: {lesson.vocabularyPreview.join(", ")}</span>
                  ) : null}
                  {lesson.phrasePreview.length ? (
                    <span className="block mt-1">
                      Фразы: {lesson.phrasePreview.join(" · ")}
                    </span>
                  ) : null}
                </>
              }
              actions={
                <>
                  <ActionLink
                    href={toMethodologyLessonRoute(
                      readModel.methodology.slug,
                      lesson.id,
                    )}
                    className="text-sm"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Смотреть</span>
                  </ActionLink>
                  <AssignLessonDialog
                    action={async (formData) => {
                      "use server";
                      const actionResolution = await resolveAccessPolicy();
                      const { teacherId } =
                        assertTeacherMethodologiesAccess(actionResolution);
                      const payload =
                        parseAssignLessonFromMethodologyFormData(formData);
                      const created = await createScheduledLessonFromMethodology({
                        teacherId,
                        methodologyLessonId: lesson.id,
                        payload,
                      });
                      revalidatePath(ROUTES.lessons);
                      revalidatePath(ROUTES.groups);
                      redirect(toLessonWorkspaceRoute(created.id));
                    }}
                    groups={groups}
                    lessonTitle={lesson.title}
                    triggerClassName={productActionClassName("text-sm")}
                    triggerContent={
                      <>
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Назначить</span>
                      </>
                    }
                  />
                </>
              }
            />
          ))}
        </section>
      </div>
    </main>
  );
}
