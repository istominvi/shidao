import { redirect } from "next/navigation";
import { resolveUserContextRedirect } from "@/lib/server/access-guards";
import { resolveAccessPolicy } from "@/lib/server/access-policy";

export async function requireUserContext() {
  const resolution = await resolveAccessPolicy();

  const redirectPath = resolveUserContextRedirect(resolution.status);
  if (redirectPath) {
    redirect(redirectPath);
  }

  if (resolution.status === "degraded") {
    throw new Error(
      "Не удалось определить права доступа. Попробуйте обновить страницу.",
    );
  }

  if (
    resolution.status === "guest" ||
    resolution.status === "adult-without-profile"
  ) {
    throw new Error("Недопустимое состояние доступа.");
  }

  return resolution.context;
}
