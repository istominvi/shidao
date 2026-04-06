import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";

export async function requireUserContext() {
  const resolution = await resolveAccessPolicy();

  if (resolution.status === "guest") {
    redirect(ROUTES.login);
  }

  if (resolution.status === "degraded") {
    throw new Error(
      "Не удалось определить права доступа. Попробуйте обновить страницу.",
    );
  }

  return resolution.context;
}

export async function requireDashboardContext() {
  const resolution = await resolveAccessPolicy();

  if (resolution.status === "guest" || resolution.status === "degraded") {
    redirect(ROUTES.login);
  }

  if (resolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  return resolution.context;
}
