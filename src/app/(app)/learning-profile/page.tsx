import { redirect } from "next/navigation";
import {
  profileCompatibilityHref,
  type ProfileRouteSearchParams,
} from "@/lib/navigation/profile-nav";

type LegacyLearningProfilePageProps = {
  searchParams: Promise<ProfileRouteSearchParams>;
};

export default async function LegacyLearningProfilePage({
  searchParams,
}: LegacyLearningProfilePageProps) {
  redirect(profileCompatibilityHref(await searchParams));
}
