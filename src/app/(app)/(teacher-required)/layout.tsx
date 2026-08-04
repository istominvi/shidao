import { redirect } from "next/navigation";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolveTeacherRequiredRedirect } from "@/lib/server/access-guards";

export default async function TeacherRequiredLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveAccessPolicy();
  const redirectPath = resolveTeacherRequiredRedirect(resolution);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return children;
}
