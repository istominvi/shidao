import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { TopNav } from "@/components/top-nav";
import { AppPageHeader } from "@/components/app/page-header";
import { TeacherGroupsCard } from "@/components/dashboard/teacher-groups-card";
import { Alert } from "@/components/ui/alert";
import { ChevronDown } from "lucide-react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { FieldControl, FieldLabel, FormField } from "@/components/ui/form-field";
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
        <DialogShell
          closeHref={ROUTES.groups}
          closeLabel="Закрыть модалку создания группы"
          title={(
            <>
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                Создание группы
              </span>
              Добавить группу
            </>
          )}
          description="Группа создаётся сразу с выбранной методикой."
          panelClassName="max-w-lg"
        >
          {query.error ? <Alert tone="error">{query.error}</Alert> : null}
          <form action={createGroupAction} className="mt-4 space-y-3">
            <FormField>
              <FieldLabel htmlFor="group-name">Название группы</FieldLabel>
              <Input id="group-name" name="name" required placeholder="Например, Лисички 6-7" />
            </FormField>
            <FormField>
              <FieldLabel htmlFor="group-methodology">Методика</FieldLabel>
              <FieldControl className="product-select-wrap">
                <Select id="group-methodology" name="methodologyId" required defaultValue="">
                  <option value="" disabled>Выберите методику</option>
                  {methodologies.map((methodology) => (
                    <option key={methodology.id} value={methodology.id}>
                      {methodology.title}
                    </option>
                  ))}
                </Select>
                <ChevronDown className="product-select-icon h-4 w-4" aria-hidden="true" />
              </FieldControl>
            </FormField>
            <div className="flex items-center gap-2 pt-1">
              <Link href={ROUTES.groups} className={productButtonClassName("secondary")}>Отмена</Link>
              <Button type="submit">Создать группу</Button>
            </div>
          </form>
        </DialogShell>
      ) : null}
    </main>
  );
}
