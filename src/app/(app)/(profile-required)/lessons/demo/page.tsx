import Link from "next/link";
import { redirect } from "next/navigation";
import { ROUTES, toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { bootstrapLessonContentFixtureAdmin } from "@/lib/server/lesson-content-bootstrap";
import { canAccessTeacherLessonWorkspace } from "@/lib/server/teacher-lesson-workspace";

export default async function DemoTeacherLessonBootstrapPage() {
  const accessResolution = await resolveAccessPolicy();

  if (!canAccessTeacherLessonWorkspace(accessResolution)) {
    redirect(ROUTES.dashboard);
  }

  try {
    const result = await bootstrapLessonContentFixtureAdmin({
      includeDevScheduledLesson: true,
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
