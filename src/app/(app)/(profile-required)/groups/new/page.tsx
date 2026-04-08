import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { assertTeacherGroupsAccess, canAccessTeacherGroups } from "@/lib/server/teacher-groups";

export default async function NewGroupPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }
  assertTeacherGroupsAccess(resolution);
  redirect(`${ROUTES.groups}?create=1`);
}
