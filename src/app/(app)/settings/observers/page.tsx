import { redirect } from "next/navigation";
import {
  profileCompatibilityHref,
  type ProfileRouteSearchParams,
} from "@/lib/navigation/profile-nav";

type LegacyObserversSettingsPageProps = {
  searchParams: Promise<ProfileRouteSearchParams>;
};

export default async function LegacyObserversSettingsPage({
  searchParams,
}: LegacyObserversSettingsPageProps) {
  redirect(profileCompatibilityHref(await searchParams, { tab: "observers" }));
}
