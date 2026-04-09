import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { AssignLessonDialog } from "@/components/lessons/assign-lesson-dialog";
import { LessonContextChip } from "@/components/lessons/lesson-context-chip";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toLessonWorkspaceRoute, toMethodologyRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherMethodologiesAccess,
  canAccessTeacherMethodologies,
  createScheduledLessonFromMethodology,
  getTeacherMethodologyLessonReadModel,
  parseAssignLessonFromMethodologyFormData,
} from "@/lib/server/teacher-methodologies";

function withError(methodologySlug: string, lessonId: string, message: string) {
  const query = new URLSearchParams({ error: message, assign: "1" });
  return `${toMethodologyRoute(methodologySlug)}/lessons/${encodeURIComponent(lessonId)}?${query.toString()}`;
}

export default async function MethodologyLessonPage({ params, searchParams }: { params: Promise<{ methodologySlug: string; lessonId: string }>; searchParams: Promise<{ assign?: string; error?: string }> }) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherMethodologies(resolution)) redirect(ROUTES.dashboard);

  const { teacherId } = assertTeacherMethodologiesAccess(resolution);
  const { methodologySlug, lessonId } = await params;
  const query = await searchParams;

  const readModel = await getTeacherMethodologyLessonReadModel({ teacherId, methodologySlug, lessonId });
  if (!readModel) notFound();
  const methodologyLessonId = readModel.lesson.id;

  async function assignLessonAction(formData: FormData) {
    "use server";
    try {
      const actionResolution = await resolveAccessPolicy();
      const { teacherId: actionTeacherId } = assertTeacherMethodologiesAccess(actionResolution);
      const payload = parseAssignLessonFromMethodologyFormData(formData);
      const created = await createScheduledLessonFromMethodology({ teacherId: actionTeacherId, methodologyLessonId, payload });
      revalidatePath(ROUTES.lessons);
      revalidatePath(ROUTES.groups);
      redirect(toLessonWorkspaceRoute(created.id));
    } catch (error) {
      if (isRedirectError(error)) throw error;
      const message = error instanceof Error ? error.message : "Не удалось назначить урок.";
      redirect(withError(methodologySlug, lessonId, message));
    }
  }

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader
          backHref={toMethodologyRoute(methodologySlug)}
          backLabel={readModel.methodology.title}
          eyebrow="Урок"
          title={readModel.lesson.shell.title}
          description={readModel.presentation.hero.lessonEssence}
          meta={<><LessonContextChip context="methodology" /><span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">{readModel.metadata.positionLabel}</span><span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">{readModel.metadata.durationLabel}</span><span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">{readModel.metadata.readinessLabel}</span></>}
          actions={<AssignLessonDialog action={assignLessonAction} groups={readModel.groups} lessonTitle={readModel.lesson.shell.title} defaultOpen={query.assign === "1"} />}
        />

        {query.error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{query.error}</p> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AppCard className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">О чём урок</p>
            <p className="mt-2 text-sm text-neutral-700">{readModel.presentation.hero.lessonEssence}</p>
            <p className="mt-2 text-xs text-neutral-600">Методика: <span className="font-medium text-neutral-900">{readModel.methodology.title}</span></p>
          </AppCard>
          <AppCard className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Подготовка</p>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
              {readModel.presentation.quickSummary.prepChecklist.slice(0, 4).map((item) => (
                <li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />{item}</li>
              ))}
            </ul>
          </AppCard>
          <AppCard className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ключевые слова и фразы</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {readModel.presentation.quickSummary.keyWords.slice(0, 5).map((word) => (
                <span key={word} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">{word}</span>
              ))}
              {readModel.presentation.quickSummary.keyPhrases.slice(0, 3).map((phrase) => (
                <span key={phrase} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900">{phrase}</span>
              ))}
            </div>
          </AppCard>
          <AppCard className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ресурсы</p>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
              {readModel.presentation.quickSummary.resources.slice(0, 4).map((resource) => (
                <li key={`${resource.kindLabel}-${resource.title}`}>{resource.kindLabel}: {resource.title}</li>
              ))}
            </ul>
          </AppCard>
        </section>

        <AppCard className="p-5" muted>
          <p className="text-sm text-neutral-700">
            Этот экран — педагогический шаблон урока. Группа и дата отсутствуют намеренно: назначение выполняется кнопкой <span className="font-semibold text-neutral-900">«Назначить урок»</span> и создаёт runtime-занятие.
          </p>
        </AppCard>

        <div className="space-y-5">
          <TeacherLessonPedagogicalContent quickSummary={readModel.presentation.quickSummary} lessonFlow={readModel.presentation.lessonFlow} />
        </div>
      </div>
    </main>
  );
}
