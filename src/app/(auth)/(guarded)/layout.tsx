import { redirect } from "next/navigation";
import { onAuthPageWhenAuthenticated } from "@/lib/auth-redirects";
import { resolveAccessPolicy } from "@/lib/server/access-policy";

export default async function GuardedAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveAccessPolicy();
  const redirectTo = onAuthPageWhenAuthenticated(resolution);

  if (redirectTo) {
    redirect(redirectTo);
  }

  return children;
}
