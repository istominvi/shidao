import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function withMessage(type: "error", message: string) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `/students/new?${params.toString()}`;
}

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolution = await resolveAccessPolicy();

  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherGroupsAccess(resolution);
  const classOptions = await listTeacherClassesAdmin(teacherId);

  async function createStudentAction(formData: FormData) {
    "use server";

    try {
      const actionResolution = await resolveAccessPolicy();
      assertTeacherGroupsAccess(actionResolution);

      const classId = String(formData.get("classId") ?? "").trim();
      const login = String(formData.get("login") ?? "").trim().toLowerCase();
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
      const message = error instanceof Error ? error.message : "Не удалось создать ученика.";
      redirect(withMessage("error", message));
    }
  }

  const query = await searchParams;

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10">
        <section className="landing-surface rounded-3xl border border-white/80 p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Создание ученика</p>
          <h1 className="mt-3 text-3xl font-black text-neutral-950">Добавить ученика</h1>
          <p className="mt-2 text-sm text-neutral-700">Рабочий teacher-flow: создаёт аккаунт ученика и сразу добавляет в выбранную группу.</p>

          {classOptions.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">
              Сначала создайте группу в разделе <Link className="text-sky-700 underline" href={ROUTES.groupsNew}>«Добавить группу»</Link>.
            </p>
          ) : (
            <form action={createStudentAction} className="mt-4 max-w-xl space-y-3">
              {query.error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{query.error}</p> : null}
              <label className="field-label" htmlFor="classId">Группа</label>
              <select id="classId" name="classId" required className="field-input">
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name?.trim() || "Группа"}</option>
                ))}
              </select>

              <label className="field-label" htmlFor="fullName">Имя ученика</label>
              <input id="fullName" name="fullName" className="field-input" placeholder="Например, Анна Иванова" />

              <label className="field-label" htmlFor="login">Логин ученика</label>
              <input id="login" name="login" required className="field-input" placeholder="anna.ivanova" />

              <label className="field-label" htmlFor="password">Пароль</label>
              <input id="password" name="password" type="password" minLength={8} required className="field-input" />

              <button type="submit" className="landing-btn landing-btn-primary">Создать ученика</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
