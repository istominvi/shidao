import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { ROUTES, toMethodologyRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherMethodologiesAccess,
  canAccessTeacherMethodologies,
  getTeacherMethodologiesIndexReadModel,
} from "@/lib/server/teacher-methodologies";

export default async function MethodologiesPage() {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherMethodologies(resolution)) {
    redirect(ROUTES.dashboard);
  }

  assertTeacherMethodologiesAccess(resolution);
  const readModel = await getTeacherMethodologiesIndexReadModel();

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader title="Методики" />
        <section className="grid gap-4 md:grid-cols-2">
          {readModel.cards.map((methodology) => (
            <AppCard key={methodology.id} className="p-5" as="article">
              <h2 className="text-xl font-bold text-neutral-950">{methodology.title}</h2>
              {methodology.shortDescription ? <p className="mt-2 text-sm text-neutral-700">{methodology.shortDescription}</p> : null}
              <p className="mt-3 text-sm text-neutral-600">Уроков в методике: {methodology.lessonCount}</p>
              <Link href={toMethodologyRoute(methodology.slug)} className="mt-4 inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Открыть методику</Link>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
