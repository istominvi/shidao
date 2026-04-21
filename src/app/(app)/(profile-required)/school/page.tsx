import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { AppPageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  addTeacherToSchoolByEmailAdmin,
  createOrganizationSchoolAdmin,
  listSchoolMembersAdmin,
  listTeacherSchoolChoicesAdmin,
  removeTeacherFromSchoolAdmin,
  resolveTeacherSchoolSelectionAdmin,
} from "@/lib/server/supabase-admin";

export default async function SchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string; error?: string; success?: string }>;
}) {
  const resolution = await resolveAccessPolicy();
  if (resolution.status !== "adult-with-profile" || resolution.activeProfile !== "teacher") {
    redirect(ROUTES.dashboard);
  }

  const teacherId = resolution.context.teacher?.id;
  if (!teacherId) redirect(ROUTES.dashboard);

  const query = await searchParams;
  const selection = await resolveTeacherSchoolSelectionAdmin({
    userId: resolution.context.userId,
    teacherId,
    teacherFullName: resolution.context.teacher?.full_name ?? null,
    preferredSchoolId: resolution.context.preferences?.last_selected_school_id ?? null,
  });

  async function createSchoolAction(formData: FormData) {
    "use server";
    const actionResolution = await resolveAccessPolicy();
    if (actionResolution.status !== "adult-with-profile" || actionResolution.activeProfile !== "teacher") {
      redirect(ROUTES.dashboard);
    }

    const actionTeacherId = actionResolution.context.teacher?.id;
    if (!actionTeacherId) redirect(ROUTES.dashboard);

    const name = String(formData.get("name") ?? "").trim();
    try {
      await createOrganizationSchoolAdmin({
        userId: actionResolution.context.userId,
        teacherId: actionTeacherId,
        teacherFullName: actionResolution.context.teacher?.full_name ?? null,
        schoolName: name,
      });
      revalidatePath(ROUTES.school);
      revalidatePath(ROUTES.groups);
      revalidatePath(ROUTES.lessons);
      redirect(ROUTES.school);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось создать школу.";
      redirect(`${ROUTES.school}?create=1&error=${encodeURIComponent(message)}`);
    }
  }

  async function addTeacherAction(formData: FormData) {
    "use server";
    const actionResolution = await resolveAccessPolicy();
    if (actionResolution.status !== "adult-with-profile" || actionResolution.activeProfile !== "teacher") {
      redirect(ROUTES.dashboard);
    }
    const actionTeacherId = actionResolution.context.teacher?.id;
    if (!actionTeacherId) redirect(ROUTES.dashboard);

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const schoolId = String(formData.get("schoolId") ?? "").trim();

    try {
      const result = await addTeacherToSchoolByEmailAdmin({ schoolId, ownerTeacherId: actionTeacherId, email });
      revalidatePath(ROUTES.school);
      redirect(`${ROUTES.school}?success=${encodeURIComponent(result.message)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось добавить преподавателя.";
      redirect(`${ROUTES.school}?error=${encodeURIComponent(message)}`);
    }
  }

  async function removeTeacherAction(formData: FormData) {
    "use server";
    const actionResolution = await resolveAccessPolicy();
    if (actionResolution.status !== "adult-with-profile" || actionResolution.activeProfile !== "teacher") {
      redirect(ROUTES.dashboard);
    }
    const actionTeacherId = actionResolution.context.teacher?.id;
    if (!actionTeacherId) redirect(ROUTES.dashboard);

    const schoolId = String(formData.get("schoolId") ?? "").trim();
    const targetTeacherId = String(formData.get("teacherId") ?? "").trim();

    try {
      await removeTeacherFromSchoolAdmin({ schoolId, ownerTeacherId: actionTeacherId, teacherId: targetTeacherId });
      revalidatePath(ROUTES.school);
      redirect(`${ROUTES.school}?success=${encodeURIComponent("Преподаватель удалён из школы.")}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось удалить преподавателя.";
      redirect(`${ROUTES.school}?error=${encodeURIComponent(message)}`);
    }
  }

  const schoolChoices = await listTeacherSchoolChoicesAdmin({
    teacherId,
    teacherFullName: resolution.context.teacher?.full_name ?? null,
  });
  const selectedOrg =
    selection.mode === "organization"
      ? schoolChoices.find((item) => item.id === selection.selectedSchoolId)
      : null;

  const members = selectedOrg ? await listSchoolMembersAdmin({ schoolId: selectedOrg.id }) : [];
  const isOwner = selectedOrg ? selectedOrg.role === "owner" : false;

  return (
    <main className="pb-12">
      <TopNav />
      <div className="container app-page-container space-y-6">
        <AppPageHeader title="Школа" />

        {query.error ? <Alert tone="error">{query.error}</Alert> : null}
        {query.success ? <Alert tone="success">{query.success}</Alert> : null}

        {selection.mode === "personal" ? (
          <section className="glass rounded-3xl p-6">
            <p className="text-sm text-neutral-700">
              Вы пока работаете лично. Создайте школу, чтобы приглашать преподавателей.
            </p>
            <Link href={`${ROUTES.school}?create=1`} className={`${productButtonClassName("primary")} mt-4 inline-flex`}>
              Создать школу
            </Link>
          </section>
        ) : (
          <section className="glass rounded-3xl p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-neutral-900">{selectedOrg?.name ?? "Школа"}</h2>
              <p className="text-sm text-neutral-600">Роль: {isOwner ? "Владелец" : "Преподаватель"}</p>
              <p className="text-sm text-neutral-600">
                Преподаватели: {selectedOrg?.teacherCount ?? members.length} / {selectedOrg?.teacherLimit ?? 5}
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500">
                    <th className="px-3 py-2">Имя</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Роль</th>
                    {isOwner ? <th className="px-3 py-2">Действия</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.teacherId} className="border-b border-neutral-100">
                      <td className="px-3 py-2">{member.fullName ?? "Преподаватель"}</td>
                      <td className="px-3 py-2">{member.email ?? "—"}</td>
                      <td className="px-3 py-2">{member.role === "owner" ? "Владелец" : "Преподаватель"}</td>
                      {isOwner ? (
                        <td className="px-3 py-2">
                          {member.role === "owner" && member.teacherId === teacherId ? null : (
                            <form action={removeTeacherAction}>
                              <input type="hidden" name="schoolId" value={selectedOrg?.id} />
                              <input type="hidden" name="teacherId" value={member.teacherId} />
                              <Button type="submit" variant="secondary">Удалить</Button>
                            </form>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isOwner ? (
              <form action={addTeacherAction} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
                <input type="hidden" name="schoolId" value={selectedOrg?.id} />
                <label className="block text-sm font-medium text-neutral-700">Email преподавателя</label>
                <Input name="email" type="email" required placeholder="teacher@example.com" />
                <Button type="submit">Добавить преподавателя</Button>
              </form>
            ) : null}
          </section>
        )}

        {query.create === "1" ? (
          <section className="glass rounded-3xl p-6">
            <h3 className="text-lg font-semibold">Создать школу</h3>
            <form action={createSchoolAction} className="mt-4 space-y-3">
              <Input name="name" required placeholder="Название школы" />
              <div className="flex gap-2">
                <Link href={ROUTES.school} className={productButtonClassName("secondary")}>Отмена</Link>
                <Button type="submit">Создать школу</Button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}
