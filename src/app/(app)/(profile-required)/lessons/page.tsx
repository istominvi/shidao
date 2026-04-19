import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { StudentLessonsHub } from "@/components/lessons/student-lessons-hub";
import { TeacherLessonsHub } from "@/components/lessons/teacher-lessons-hub";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getStudentLessonsHubReadModel } from "@/lib/server/student-schedule";
import {
  assertTeacherLessonsHubMutationAccess,
  canAccessTeacherLessonsHub,
  createTeacherScheduledLesson,
  getTeacherLessonsHub,
  parseCreateScheduledLessonFormData,
} from "@/lib/server/teacher-lessons-hub";

function normalizeView(view: string | undefined) {
  if (view === "day" || view === "week" || view === "month") {
    return view;
  }

  return "week";
}

function normalizeDate(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  return value;
}

function withMessage(type: "saved" | "error", message: string) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `${ROUTES.lessons}?${params.toString()}`;
}

export default async function LessonsPage({
  searchParams,
}: {
    searchParams: Promise<{
      saved?: string;
      error?: string;
      view?: string;
      date?: string;
    }>;
}) {
  const accessResolution = await resolveAccessPolicy();

  if (accessResolution.status === "guest" || accessResolution.status === "degraded") {
    redirect(ROUTES.login);
  }
  if (accessResolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  if (accessResolution.context.actorKind === "student") {
    const studentId = accessResolution.context.student?.id;
    if (!studentId) redirect(ROUTES.login);
    const hub = await getStudentLessonsHubReadModel({ studentId });

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container app-page-container">
          <StudentLessonsHub hub={hub} />
        </div>
      </main>
    );
  }

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
      if (isRedirectError(error)) {
        throw error;
      }
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось запланировать занятие.";
      redirect(withMessage("error", message));
    }
  }

  const hub = await getTeacherLessonsHub({ teacherId });
  const query = await searchParams;
  const defaultDate = hub.schedule.defaultDateIso;

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container app-page-container">
        <TeacherLessonsHub
          hub={hub}
          createLessonAction={createLessonAction}
          initialState={{
            view: normalizeView(query.view),
            date: normalizeDate(query.date, defaultDate),
          }}
          feedback={{
            success: query.saved?.trim() || undefined,
            error: query.error?.trim() || undefined,
          }}
        />
      </div>
    </main>
  );
}
