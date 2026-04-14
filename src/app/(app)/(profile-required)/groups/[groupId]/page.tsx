import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { CalendarPlus2, UserPlus } from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { TopNav } from "@/components/top-nav";
import { productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { GroupAssignLessonDialog } from "@/components/lessons/group-assign-lesson-dialog";
import { CreateStudentDialog } from "@/components/students/create-student-dialog";
import { GroupStudentsCard } from "@/components/students/group-students-card";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
  createTeacherGroupScopedLesson,
  getTeacherGroupOverview,
  parseGroupScopedLessonFormData,
} from "@/lib/server/teacher-groups";
import {
  attachStudentToClassAsAdmin,
  createStudentAuthUser,
  detachStudentFromClassAsAdmin,
  insertStudentRow,
  updateStudentProfileAsAdmin,
} from "@/lib/server/supabase-admin";

function withMessage(
  groupId: string,
  type: "saved" | "error",
  message: string,
) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `${ROUTES.groups}/${encodeURIComponent(groupId)}?${params.toString()}`;
}

export default async function TeacherGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const resolution = await resolveAccessPolicy();

  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherGroupsAccess(resolution);
  const { groupId } = await params;
  const readModel = await getTeacherGroupOverview({ teacherId, groupId });

  if (!readModel) {
    notFound();
  }

  async function scheduleLessonAction(formData: FormData) {
    "use server";

    try {
      const actionResolution = await resolveAccessPolicy();
      const { teacherId: actionTeacherId } = assertTeacherGroupsAccess(actionResolution);
      const payload = parseGroupScopedLessonFormData(formData);
      const lesson = await createTeacherGroupScopedLesson({
        teacherId: actionTeacherId,
        groupId,
        payload,
      });

      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
      revalidatePath(`${ROUTES.groups}/${groupId}`);
      redirect(`/lessons/${lesson.id}`);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось запланировать занятие для группы.";
      redirect(withMessage(groupId, "error", message));
    }
  }

  async function createStudentAction(formData: FormData) {
    "use server";

    try {
      const actionResolution = await resolveAccessPolicy();
      assertTeacherGroupsAccess(actionResolution);

      const login = String(formData.get("login") ?? "")
        .trim()
        .toLowerCase();
      const password = String(formData.get("password") ?? "");
      const fullName = String(formData.get("fullName") ?? "").trim();

      if (!login || password.length < 8) {
        throw new Error("Нужны логин и пароль не короче 8 символов.");
      }

      const createdAuth = await createStudentAuthUser({
        login,
        password,
        fullName: fullName || null,
      });

      const studentId = await insertStudentRow({
        userId: createdAuth.userId,
        login,
        internalAuthEmail: createdAuth.email,
        fullName: fullName || null,
      });

      if (!studentId) {
        throw new Error("Не удалось создать профиль ученика.");
      }

      await attachStudentToClassAsAdmin({ classId: groupId, studentId });

      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
      revalidatePath(`${ROUTES.groups}/${groupId}`);
      redirect(withMessage(groupId, "saved", "Ученик создан и добавлен в группу."));
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Не удалось создать ученика.";
      redirect(withMessage(groupId, "error", message));
    }
  }

  async function updateStudentAction(formData: FormData) {
    "use server";

    try {
      const actionResolution = await resolveAccessPolicy();
      assertTeacherGroupsAccess(actionResolution);
      const studentId = String(formData.get("studentId") ?? "").trim();
      const login = String(formData.get("login") ?? "").trim().toLowerCase();
      const fullName = String(formData.get("fullName") ?? "").trim();
      const password = String(formData.get("password") ?? "");

      if (!studentId || !login) {
        throw new Error("Нужны studentId и логин.");
      }
      if (password && password.length < 8) {
        throw new Error("Пароль должен быть не короче 8 символов.");
      }

      await updateStudentProfileAsAdmin({
        classId: groupId,
        studentId,
        login,
        fullName: fullName || null,
        password: password || null,
      });

      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
      revalidatePath(`${ROUTES.groups}/${groupId}`);
      redirect(withMessage(groupId, "saved", "Данные ученика обновлены."));
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Не удалось обновить ученика.";
      redirect(withMessage(groupId, "error", message));
    }
  }

  async function removeStudentAction(formData: FormData) {
    "use server";

    try {
      const actionResolution = await resolveAccessPolicy();
      assertTeacherGroupsAccess(actionResolution);
      const studentId = String(formData.get("studentId") ?? "").trim();
      if (!studentId) {
        throw new Error("Не указан ученик для удаления.");
      }
      await detachStudentFromClassAsAdmin({ classId: groupId, studentId });

      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
      revalidatePath(`${ROUTES.groups}/${groupId}`);
      redirect(withMessage(groupId, "saved", "Ученик удалён из группы."));
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Не удалось удалить ученика.";
      redirect(withMessage(groupId, "error", message));
    }
  }

  const query = await searchParams;

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader
          backHref={ROUTES.groups}
          backLabel="Группы"
          title={readModel.group.label}
          description={readModel.methodology.assignedMethodologyShortDescription ?? undefined}
          meta={(
            <>
              {query.saved ? (
                <p className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{query.saved}</p>
              ) : null}
              {query.error ? (
                <p className="w-full rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{query.error}</p>
              ) : null}
              <Chip tone="sky" size="md">
                Ученики: {readModel.group.studentCount}
              </Chip>
              <Chip tone="emerald" size="md">
                Прогресс: {readModel.group.progressLabel}
              </Chip>
              {readModel.group.nextLessonLabel ? (
                <Chip tone="amber" size="md">
                  Следующее занятие: {readModel.group.nextLessonLabel}
                </Chip>
              ) : null}
              {readModel.group.assignedMethodologyTitle ? (
                <Chip tone="violet" size="md">
                  Методика: {readModel.group.assignedMethodologyTitle}
                </Chip>
              ) : (
                <Chip tone="indigo" size="md" className="border-dashed">
                  Методика: не указана (legacy-группа)
                </Chip>
              )}
            </>
          )}
          actions={null}
        />

        <section className="space-y-3">
          <h2 className="px-6 text-xl font-bold tracking-[-0.02em] text-neutral-950">
            Ученики
          </h2>
          <GroupStudentsCard
            students={readModel.students.map((student) => ({
              id: student.id,
              displayName: student.displayName,
              login: student.login,
              progressLabel: "—",
              communicationHref: `${ROUTES.groups}/${encodeURIComponent(groupId)}/students/${encodeURIComponent(student.id)}/communication`,
            }))}
            headerActions={(
              <>
                <CreateStudentDialog
                  action={createStudentAction}
                  triggerClassName={productButtonClassName("secondary")}
                  triggerContent={(
                    <>
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                      Добавить ученика
                    </>
                  )}
                />
                {readModel.schedule.canSchedule ? (
                  <GroupAssignLessonDialog
                    lessons={readModel.schedule.lessonOptions}
                    action={scheduleLessonAction}
                    triggerClassName={productButtonClassName("secondary")}
                    triggerContent={(
                      <>
                        <CalendarPlus2 className="h-4 w-4" aria-hidden="true" />
                        Назначить урок
                      </>
                    )}
                  />
                ) : null}
              </>
            )}
            updateAction={updateStudentAction}
            removeAction={removeStudentAction}
          />
        </section>

      </div>
    </main>
  );
}
