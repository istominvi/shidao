import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarRange,
  Clock3,
  Eye,
  GraduationCap,
  Shapes,
  Users,
} from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { AppPageHeader } from "@/components/app/page-header";
import { Chip } from "@/components/ui/chip";
import { MethodologyEntityCard } from "@/components/methodologies/methodology-entity-card";
import { ActionLink } from "@/components/ui/action";
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
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          title="Методики"
          description="Выбирайте методику, изучайте структуру курса и удобно распределяйте уроки по группам в расписании."
        />

        <section className="space-y-3">
          {readModel.cards.map((methodology) => (
            <MethodologyEntityCard
              key={methodology.id}
              title={methodology.title}
              description={methodology.shortDescription}
              coverImage={methodology.coverImage}
              badges={
                <>
                  <Chip icon={BookOpen} tone="violet" size="md">
                    Уроков: {methodology.lessonCount}
                  </Chip>
                  {methodology.passport.courseDurationLabel ? (
                    <Chip icon={CalendarRange} tone="emerald" size="md">
                      Курс:{" "}
                      {methodology.passport.courseDurationLabel ===
                      "1 учебный год"
                        ? "1 год"
                        : methodology.passport.courseDurationLabel}
                    </Chip>
                  ) : null}
                  {methodology.passport.lessonDurationLabel ? (
                    <Chip icon={Clock3} tone="amber" size="md">
                      Урок: {methodology.passport.lessonDurationLabel}
                    </Chip>
                  ) : null}
                  {methodology.passport.targetAgeLabel ? (
                    <Chip icon={GraduationCap} tone="sky" size="md">
                      Возраст: {methodology.passport.targetAgeLabel}
                    </Chip>
                  ) : null}
                  {methodology.passport.groupSizeLabel ? (
                    <Chip icon={Users} tone="indigo" size="md">
                      Группа: {methodology.passport.groupSizeLabel}
                    </Chip>
                  ) : null}
                  {methodology.passport.activitiesPerLessonLabel ? (
                    <Chip icon={Shapes} tone="rose" size="md">
                      Активностей:{" "}
                      {methodology.passport.activitiesPerLessonLabel
                        .replace(/^Обычно:\s*/i, "")
                        .replace(/^Обычно\s+/i, "")
                        .replace(/\s*активност(?:ей|и)\s*$/i, "")
                        .trim()}
                    </Chip>
                  ) : null}
                </>
              }
              actions={
                <ActionLink href={toMethodologyRoute(methodology.slug)} className="text-sm">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Смотреть</span>
                </ActionLink>
              }
            />
          ))}
        </section>
      </div>
    </main>
  );
}
