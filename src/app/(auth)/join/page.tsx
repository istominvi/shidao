import { redirect } from "next/navigation";
import { onAuthPageWhenAuthenticated } from "@/lib/auth-redirects";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import JoinClientPage from "./join-client";

export default async function JoinPage() {
  const resolution = await resolveAccessPolicy();
  const redirectTo = onAuthPageWhenAuthenticated(resolution);

  if (redirectTo) {
    redirect(redirectTo);
  }

  return <JoinClientPage />;
}
