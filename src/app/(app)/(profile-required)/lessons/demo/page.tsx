import Link from "next/link";
import { redirect } from "next/navigation";
import { ROUTES, toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { bootstrapLessonContentFixtureAdmin } from "@/lib/server/lesson-content-bootstrap";
import { getFirstAssignedClassIdForTeacherAdmin } from "@/lib/server/lesson-content-repository";
import { canAccessTeacherLessonWorkspace } from "@/lib/server/teacher-lesson-workspace";

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
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка bootstrap.";

    return (
      <main className="container py-10">
        <h1 className="text-2xl font-black text-neutral-900">
          Не удалось открыть demo-урок
        </h1>
        <p className="mt-3 text-sm text-neutral-700">
          Bootstrap lesson-content не выполнился автоматически.
        </p>
        <p className="mt-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {message}
        </p>
        <p className="mt-4 text-sm text-neutral-700">
          Проверьте server env: <code>NEXT_PUBLIC_SUPABASE_URL</code> и
          {" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>, затем повторите.
        </p>
        <p className="mt-4 text-sm">
          <Link href={ROUTES.dashboard} className="text-sky-700 underline underline-offset-2">
            Вернуться в dashboard
          </Link>
        </p>
      </main>
    );
  }
}
