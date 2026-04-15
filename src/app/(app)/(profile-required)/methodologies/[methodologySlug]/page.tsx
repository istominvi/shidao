import { notFound, redirect } from "next/navigation";
import { BookOpen, CalendarRange, Clock3, GraduationCap, Shapes, Users } from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { MethodologyDetailWorkspace } from "@/components/methodologies/methodology-detail-workspace";
import { Chip } from "@/components/ui/chip";
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
  const { teacherId } = assertTeacherMethodologiesAccess(resolution);

  const { methodologySlug } = await params;
  const readModel = await getTeacherMethodologyDetailReadModel(
    methodologySlug,
    teacherId,
  );
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

        <MethodologyDetailWorkspace
          methodology={{
            slug: readModel.methodology.slug,
            title: readModel.methodology.title,
            shortDescription: readModel.methodology.shortDescription,
            coverImage: readModel.methodology.coverImage,
          }}
          descriptionContent={readModel.descriptionContent}
          lessons={readModel.lessons}
        />
      </div>
    </main>
  );
}
