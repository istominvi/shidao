import { redirect } from "next/navigation";
import {
  profileCompatibilityHref,
  type ProfileRouteSearchParams,
} from "@/lib/navigation/profile-nav";

type LegacySettingsPageProps = {
  searchParams: Promise<ProfileRouteSearchParams>;
};

export default async function LegacySettingsPage({
  searchParams,
}: LegacySettingsPageProps) {
  redirect(profileCompatibilityHref(await searchParams, { tab: "settings" }));
}
