import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { CalendarPlus2, UserPlus } from "lucide-react";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { TopNav } from "@/components/top-nav";
import { TeacherTableCard, TeacherTableEmptyState } from "@/components/dashboard/teacher-table-card";
import { productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { GroupAssignLessonDialog } from "@/components/lessons/group-assign-lesson-dialog";
import { CreateStudentDialog } from "@/components/students/create-student-dialog";
import {
  ProductTable,
  ProductTableBody,
  ProductTableCell,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTableRow,
  ProductTableTruncate,
} from "@/components/ui/product-table";
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
  insertStudentRow,
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
          actions={(
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
        />

        <TeacherTableCard
          title="Ученики группы"
          headerAction={null}
        >
          <ProductTable className="min-w-full">
            <ProductTableHead>
              <ProductTableHeaderRow>
                <ProductTableHeaderCell>Ученик</ProductTableHeaderCell>
                <ProductTableHeaderCell>Логин</ProductTableHeaderCell>
                <ProductTableHeaderCell>Коммуникация</ProductTableHeaderCell>
              </ProductTableHeaderRow>
            </ProductTableHead>
            <ProductTableBody>
              {readModel.students.map((student) => (
                <ProductTableRow key={student.id}>
                  <ProductTableCell className="max-w-0 font-semibold text-neutral-950">
                    <ProductTableTruncate title={student.displayName}>{student.displayName}</ProductTableTruncate>
                  </ProductTableCell>
                  <ProductTableCell className="max-w-0">
                    <ProductTableTruncate title={student.login ? `@${student.login}` : "—"}>
                      {student.login ? `@${student.login}` : "—"}
                    </ProductTableTruncate>
                  </ProductTableCell>
                  <ProductTableCell>
                    <Link
                      href={`${ROUTES.groups}/${encodeURIComponent(groupId)}/students/${encodeURIComponent(student.id)}/communication`}
                      className="text-xs text-sky-700 underline underline-offset-2"
                    >
                      Открыть коммуникацию
                    </Link>
                  </ProductTableCell>
                </ProductTableRow>
              ))}
            </ProductTableBody>
          </ProductTable>
          {readModel.students.length === 0 ? (
            <TeacherTableEmptyState text="В группе пока нет учеников." />
          ) : null}
        </TeacherTableCard>

        <section className="grid gap-4 md:grid-cols-2">
          <AppCard as="article" className="p-5">
            <h2 className="text-xl font-bold text-neutral-950">Ближайшие занятия</h2>
            {readModel.upcomingLessons.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">Пока нет запланированных занятий.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm text-neutral-700">
                {readModel.upcomingLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={lesson.href} className="font-semibold text-sky-700 underline underline-offset-2">
                      {lesson.title}
                    </Link>
                    <div>
                      {lesson.dateTimeLabel} · {lesson.statusLabel}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AppCard>

          <AppCard as="article" className="p-5">
            <h2 className="text-xl font-bold text-neutral-950">Недавние занятия</h2>
            {readModel.recentLessons.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">История занятий пока пустая.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm text-neutral-700">
                {readModel.recentLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={lesson.href} className="font-semibold text-sky-700 underline underline-offset-2">
                      {lesson.title}
                    </Link>
                    <div>
                      {lesson.dateTimeLabel} · {lesson.statusLabel}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        </section>
      </div>
    </main>
  );
}
