import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { TopNav } from "@/components/top-nav";
import { AppPageHeader } from "@/components/app/page-header";
import { TeacherGroupsCard } from "@/components/dashboard/teacher-groups-card";
import { ChevronDown } from "lucide-react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ROUTES, toGroupRoute } from "@/lib/auth";
import { listMethodologiesAdmin } from "@/lib/server/lesson-content-repository";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
  createTeacherGroup,
} from "@/lib/server/teacher-groups";
import { getTeacherGroupsIndexOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";

export default async function TeacherGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    methodology?: string;
    create?: string;
    error?: string;
  }>;
}) {
  const resolution = await resolveAccessPolicy();

  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  const { teacherId } = assertTeacherGroupsAccess(resolution);
  const query = await searchParams;
  const methodologies = await listMethodologiesAdmin();
  const isCreateModalOpen = query.create === "1";

  async function createGroupAction(formData: FormData) {
    "use server";

    let createdClassId = "";

    try {
      const actionResolution = await resolveAccessPolicy();
      const { teacherId: actionTeacherId } = assertTeacherGroupsAccess(actionResolution);
      const name = String(formData.get("name") ?? "").trim();
      const methodologyId = String(formData.get("methodologyId") ?? "").trim();

      const created = await createTeacherGroup({
        teacherId: actionTeacherId,
        name,
        methodologyId,
      });
      createdClassId = created.classId;
      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.groups);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось создать группу.";
      const params = new URLSearchParams();
      params.set("create", "1");
      params.set("error", message);
      redirect(`${ROUTES.groups}?${params.toString()}`);
    }

    redirect(toGroupRoute(createdClassId));
  }

  const readModel = await getTeacherGroupsIndexOperationsReadModel({
    teacherId,
    search: query.q,
    methodology: query.methodology,
  });

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container app-page-container space-y-6">
        <AppPageHeader title="Группы" />

        <TeacherGroupsCard
          actions={readModel.actions}
          rows={readModel.rows}
          filters={readModel.filters}
        />
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <Link
            href={ROUTES.groups}
            className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[1px]"
            aria-label="Закрыть модалку создания группы"
          />
          <section className="relative z-10 w-full max-w-lg landing-surface rounded-3xl border border-white/80 bg-[linear-gradient(150deg,rgba(255,255,255,0.97),rgba(255,255,255,0.92))] p-6 shadow-[0_24px_72px_rgba(15,23,42,0.28)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Создание группы</p>
                <h2 className="mt-2 text-2xl font-black text-neutral-950">Добавить группу</h2>
                <p className="mt-2 text-sm text-neutral-700">Группа создаётся сразу с выбранной методикой.</p>
              </div>
              <Link href={ROUTES.groups} className="text-sm text-neutral-500 underline underline-offset-2">Отмена</Link>
            </div>
            {query.error ? (
              <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{query.error}</p>
            ) : null}
            <form action={createGroupAction} className="mt-4 space-y-3">
              <label className="field-label" htmlFor="group-name">Название группы</label>
              <Input id="group-name" name="name" required placeholder="Например, Лисички 6-7" />
              <label className="field-label" htmlFor="group-methodology">Методика</label>
              <div className="product-select-wrap">
                <Select id="group-methodology" name="methodologyId" required defaultValue="">
                  <option value="" disabled>Выберите методику</option>
                  {methodologies.map((methodology) => (
                    <option key={methodology.id} value={methodology.id}>
                      {methodology.title}
                    </option>
                  ))}
                </Select>
                <ChevronDown className="product-select-icon h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link href={ROUTES.groups} className={productButtonClassName("secondary")}>Отмена</Link>
                <Button type="submit">Создать группу</Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
