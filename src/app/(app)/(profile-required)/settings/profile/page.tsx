import { redirect } from "next/navigation";
import {
  profileSettingsStatusHref,
  profileTabHref,
} from "@/lib/navigation/profile-nav";

type LegacyProfileSettingsPageProps = {
  searchParams: Promise<{
    emailChanged?: string | string[];
    emailChangeRequested?: string | string[];
  }>;
};

function hasFlag(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) === "1";
}

export default async function LegacyProfileSettingsPage({
  searchParams,
}: LegacyProfileSettingsPageProps) {
  const params = await searchParams;

  if (hasFlag(params.emailChanged)) {
    redirect(profileSettingsStatusHref("emailChanged"));
  }
  if (hasFlag(params.emailChangeRequested)) {
    redirect(profileSettingsStatusHref("emailChangeRequested"));
  }

  redirect(profileTabHref("settings"));
}
