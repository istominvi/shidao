import { redirect } from "next/navigation";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolveAuthEntryRedirect } from "@/lib/server/access-guards";

export default async function AuthEntryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveAccessPolicy();
  const redirectPath = resolveAuthEntryRedirect(resolution.status);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return children;
}
