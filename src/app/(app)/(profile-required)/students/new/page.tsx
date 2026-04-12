import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AppPageHeader } from "@/components/app/page-header";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toGroupRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { listTeacherClassesAdmin } from "@/lib/server/lesson-content-repository";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
} from "@/lib/server/teacher-groups";
import {
  attachStudentToClassAsAdmin,
  createStudentAuthUser,
  insertStudentRow,
} from "@/lib/server/supabase-admin";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; groupId?: string }>;
}) {
  const resolution = await resolveAccessPolicy();

  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherGroupsAccess(resolution);
  const classOptions = await listTeacherClassesAdmin(teacherId);
  const query = await searchParams;
  const preselectedGroupId = query.groupId?.trim() || "";
  const contextualGroup =
    classOptions.find((item) => item.id === preselectedGroupId) ?? null;

  async function createStudentAction(formData: FormData) {
    "use server";

    try {
      const actionResolution = await resolveAccessPolicy();
      assertTeacherGroupsAccess(actionResolution);

      const classId = String(formData.get("classId") ?? "").trim();
      const login = String(formData.get("login") ?? "")
        .trim()
        .toLowerCase();
      const password = String(formData.get("password") ?? "");
      const fullName = String(formData.get("fullName") ?? "").trim();

      if (!classId || !login || password.length < 8) {
        throw new Error("Нужны группа, логин и пароль не короче 8 символов.");
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

      await attachStudentToClassAsAdmin({ classId, studentId });

      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
      redirect(toGroupRoute(classId));
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Не удалось создать ученика.";
      const params = new URLSearchParams();
      params.set("error", message);
      if (preselectedGroupId) {
        params.set("groupId", preselectedGroupId);
      }
      redirect(`${ROUTES.studentsNew}?${params.toString()}`);
    }
  }

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container space-y-6 py-7 md:py-10">
        <AppPageHeader
          backHref={
            contextualGroup ? toGroupRoute(contextualGroup.id) : ROUTES.groups
          }
          backLabel={
            contextualGroup
              ? contextualGroup.name?.trim() || "Группа"
              : "Группы"
          }
          title="Добавить ученика"
          eyebrow="Создание ученика"
          description={
            contextualGroup ? (
              <>
                Рабочий teacher-flow: создаёт аккаунт ученика и сразу добавляет
                в группу. Контекст группы:{" "}
                <strong>{contextualGroup.name?.trim() || "Группа"}</strong>.
              </>
            ) : (
              "Рабочий teacher-flow: создаёт аккаунт ученика и сразу добавляет в группу."
            )
          }
        />

        <section className="landing-surface rounded-3xl border border-white/80 p-6 md:p-8">
          {classOptions.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">
              Сначала создайте группу в разделе{" "}
              <Link
                className="text-sky-700 underline"
                href={`${ROUTES.groups}?create=1`}
              >
                «Добавить группу»
              </Link>
              .
            </p>
          ) : (
            <form
              action={createStudentAction}
              className="mt-4 max-w-xl space-y-3"
            >
              {query.error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {query.error}
                </p>
              ) : null}
              <label className="field-label" htmlFor="classId">
                Группа
              </label>
              <select
                id="classId"
                name="classId"
                required
                className="field-input"
                defaultValue={preselectedGroupId || classOptions[0]?.id || ""}
              >
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name?.trim() || "Группа"}
                  </option>
                ))}
              </select>

              <label className="field-label" htmlFor="fullName">
                Имя ученика
              </label>
              <input
                id="fullName"
                name="fullName"
                className="field-input"
                placeholder="Например, Анна Иванова"
              />

              <label className="field-label" htmlFor="login">
                Логин ученика
              </label>
              <input
                id="login"
                name="login"
                required
                className="field-input"
                placeholder="anna.ivanova"
              />

              <label className="field-label" htmlFor="password">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                className="field-input"
              />

              <button type="submit" className="landing-btn landing-btn-primary">
                Создать ученика
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
