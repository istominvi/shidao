import { redirect } from "next/navigation";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolveProfileRequiredRedirect } from "@/lib/server/access-guards";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveAccessPolicy();
  const redirectPath = resolveProfileRequiredRedirect(resolution.status);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return children;
}
