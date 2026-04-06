import { redirect } from "next/navigation";
import { SettingsShell } from "@/components/settings-shell";
import { ROUTES } from "@/lib/auth";
import { requireUserContext } from "@/lib/server/user-context";
import { InviteTeamForm } from "./invite-team-form";

export default async function TeamSettingsPage() {
  const context = await requireUserContext();

  if (context.actorKind !== "adult") {
    redirect(ROUTES.dashboard);
  }

  return (
    <SettingsShell
      badgeClassName="bg-sky-100 text-sky-700"
      badgeLabel="Администрирование"
      title="Команда и приглашения"
      description="Отправка приглашения через серверный admin-flow Supabase."
    >
      <InviteTeamForm />
    </SettingsShell>
  );
}
