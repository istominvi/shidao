import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toGroupRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { listMethodologiesAdmin } from "@/lib/server/lesson-content-repository";
import { assertTeacherGroupsAccess, canAccessTeacherGroups } from "@/lib/server/teacher-groups";
import { createClassForTeacherAdmin } from "@/lib/server/supabase-admin";

function withMessage(type: "error", message: string) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `${ROUTES.groups}/new?${params.toString()}`;
}

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }
  assertTeacherGroupsAccess(resolution);
  const methodologies = await listMethodologiesAdmin();

  async function createGroupAction(formData: FormData) {
    "use server";

    let createdClassId = "";

    try {
      const actionResolution = await resolveAccessPolicy();
      const { teacherId } = assertTeacherGroupsAccess(actionResolution);
      const name = String(formData.get("name") ?? "").trim();
      const methodologyId = String(formData.get("methodologyId") ?? "").trim();
      if (!name) {
        throw new Error("Укажите название группы.");
      }

      const created = await createClassForTeacherAdmin({
        teacherId,
        name,
        methodologyId: methodologyId || null,
      });
      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
      createdClassId = created.classId;
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось создать группу.";
      redirect(withMessage("error", message));
    }

    redirect(toGroupRoute(createdClassId));
  }

  const query = await searchParams;

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10">
        <section className="landing-surface rounded-3xl border border-white/80 p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Создание группы</p>
          <h1 className="mt-3 text-3xl font-black text-neutral-950">Добавить группу</h1>
          <p className="mt-2 text-sm text-neutral-700">Создаёт группу, привязывает её к преподавателю и позволяет сразу назначить методику.</p>

          {query.error ? <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{query.error}</p> : null}

          <form action={createGroupAction} className="mt-4 max-w-xl space-y-3">
            <label className="field-label" htmlFor="group-name">Название группы</label>
            <input id="group-name" name="name" required className="field-input" placeholder="Например, Лисички 6-7" />
            <label className="field-label" htmlFor="group-methodology">Методика (опционально)</label>
            <select id="group-methodology" name="methodologyId" className="field-input" defaultValue="">
              <option value="">Без методики (потребуется настройка на странице группы)</option>
              {methodologies.map((methodology) => (
                <option key={methodology.id} value={methodology.id}>
                  {methodology.title}
                </option>
              ))}
            </select>
            <button type="submit" className="landing-btn landing-btn-primary">Создать группу</button>
          </form>
        </section>
      </div>
    </main>
  );
}
