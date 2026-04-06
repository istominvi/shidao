import { redirect } from "next/navigation";
import { onAuthPageWhenAuthenticated } from "@/lib/auth-redirects";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import LoginClientPage from "./login-client";

export default async function LoginPage() {
  const resolution = await resolveAccessPolicy();
  const redirectTo = onAuthPageWhenAuthenticated(resolution);

  if (redirectTo) {
    redirect(redirectTo);
  }

  return <LoginClientPage />;
}
