import { redirect } from "next/navigation";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolvePrivateLayoutRedirect } from "@/lib/server/access-guards";
import { readRequestPathname } from "@/lib/server/request-pathname";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveAccessPolicy();

  const pathname = await readRequestPathname();
  const redirectPath = resolvePrivateLayoutRedirect(
    resolution.status,
    pathname,
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  return children;
}
