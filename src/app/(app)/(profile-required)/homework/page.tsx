import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/auth";

export default function LegacyHomeworkPage() {
  redirect(ROUTES.lessons);
}
