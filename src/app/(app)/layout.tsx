import { redirect } from "next/navigation";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolvePrivateLayoutRedirect } from "@/lib/server/access-guards";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveAccessPolicy();
  const redirectPath = resolvePrivateLayoutRedirect(resolution.status);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return children;
}
