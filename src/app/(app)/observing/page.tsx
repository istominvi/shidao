import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/auth";

export default function ObservingPage() {
  redirect(`${ROUTES.students}?tab=observing`);
}
