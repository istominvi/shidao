import { redirect } from "next/navigation";
import {
  profileCompatibilityHref,
  type ProfileRouteSearchParams,
} from "@/lib/navigation/profile-nav";

type LegacyProfileSettingsPageProps = {
  searchParams: Promise<ProfileRouteSearchParams>;
};

export default async function LegacyProfileSettingsPage({
  searchParams,
}: LegacyProfileSettingsPageProps) {
  redirect(profileCompatibilityHref(await searchParams, { tab: "settings" }));
}
