import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TeacherLessonsHub } from "@/components/lessons/teacher-lessons-hub";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherLessonsHubMutationAccess,
  canAccessTeacherLessonsHub,
  createTeacherScheduledLesson,
  getTeacherLessonsHub,
  parseCreateScheduledLessonFormData,
} from "@/lib/server/teacher-lessons-hub";

function withMessage(type: "saved" | "error", message: string) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `${ROUTES.lessons}?${params.toString()}`;
}

export default async function TeacherLessonsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const accessResolution = await resolveAccessPolicy();

  if (!canAccessTeacherLessonsHub(accessResolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherLessonsHubMutationAccess(accessResolution);

  async function createLessonAction(formData: FormData) {
    "use server";

    try {
      const actionResolution = await resolveAccessPolicy();
      const { teacherId: actionTeacherId } =
        assertTeacherLessonsHubMutationAccess(actionResolution);
      const payload = parseCreateScheduledLessonFormData(formData);

      const createdLesson = await createTeacherScheduledLesson({
        teacherId: actionTeacherId,
        payload,
      });

      revalidatePath(ROUTES.lessons);
      redirect(toLessonWorkspaceRoute(createdLesson.id));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось запланировать занятие.";
      redirect(withMessage("error", message));
    }
  }

  const hub = await getTeacherLessonsHub({ teacherId });
  const query = await searchParams;

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10">
        <TeacherLessonsHub
          hub={hub}
          createLessonAction={createLessonAction}
          feedback={{
            success: query.saved?.trim() || undefined,
            error: query.error?.trim() || undefined,
          }}
        />
      </div>
    </main>
  );
}
