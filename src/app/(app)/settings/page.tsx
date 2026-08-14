import { redirect } from "next/navigation";
import { profileTabHref } from "@/lib/navigation/profile-nav";

export default function LegacySettingsPage() {
  redirect(profileTabHref("settings"));
}
