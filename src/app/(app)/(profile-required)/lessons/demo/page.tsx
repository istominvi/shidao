import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/app/page-header";
import { TopNav } from "@/components/top-nav";
import { Alert } from "@/components/ui/alert";
import { SurfaceCard } from "@/components/ui/surface-card";
import { ROUTES, toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { bootstrapLessonContentFixtureAdmin } from "@/lib/server/lesson-content-bootstrap";
import { getFirstAssignedClassIdForTeacherAdmin } from "@/lib/server/lesson-content-repository";
import { canAccessTeacherLessonWorkspace } from "@/lib/server/teacher-lesson-workspace";

function isNextRedirectError(error: unknown): error is { digest: string } {
  if (!error || typeof error !== "object") {
    return false;
  }

  const digest = "digest" in error ? error.digest : null;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export default async function DemoTeacherLessonBootstrapPage() {
  const accessResolution = await resolveAccessPolicy();

  if (!canAccessTeacherLessonWorkspace(accessResolution)) {
    redirect(ROUTES.dashboard);
  }

  try {
    const teacherId =
      accessResolution.status === "adult-with-profile"
        ? accessResolution.context.teacher?.id ?? ""
        : "";
    if (!teacherId) {
      throw new Error("Не найден teacher.id в текущем профиле.");
    }

    const classId = await getFirstAssignedClassIdForTeacherAdmin(teacherId);
    if (!classId) {
      throw new Error(
        "Для преподавателя не найден назначенный класс. Сначала завершите teacher onboarding и назначение в class.",
      );
    }

    const result = await bootstrapLessonContentFixtureAdmin({
      includeDevScheduledLesson: true,
      scheduledLessonClassId: classId,
    });
    redirect(toLessonWorkspaceRoute(result.scheduledLessonId));
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка bootstrap.";

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container app-page-container space-y-6">
          <AppPageHeader
            backHref={ROUTES.dashboard}
            backLabel="Dashboard"
            eyebrow="Технический маршрут"
            title="Не удалось открыть demo-урок"
            description="Bootstrap lesson-content не выполнился автоматически."
          />
          <SurfaceCard as="section" className="rounded-3xl border border-white/80 p-6">
            <Alert tone="error">{message}</Alert>
            <p className="mt-4 text-sm text-neutral-700">
              Проверьте server env: <code>NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code>, затем повторите.
            </p>
            <p className="mt-4 text-sm">
              <Link
                href={ROUTES.dashboard}
                className="text-sky-700 underline underline-offset-2"
              >
                Вернуться в dashboard
              </Link>
            </p>
          </SurfaceCard>
        </div>
      </main>
    );
  }
}
