import { redirect } from "next/navigation";
import {
  profileCompatibilityHref,
  type ProfileRouteSearchParams,
} from "@/lib/navigation/profile-nav";

type LegacySecuritySettingsPageProps = {
  searchParams: Promise<ProfileRouteSearchParams>;
};

export default async function LegacySecuritySettingsPage({
  searchParams,
}: LegacySecuritySettingsPageProps) {
  redirect(
    profileCompatibilityHref(await searchParams, {
      tab: "settings",
      fragment: "security",
    }),
  );
}
