import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getTeacherConversationReadModel, type CommunicationFilter } from "@/lib/server/communication-service";
import { assertTeacherGroupsAccess, canAccessTeacherGroups } from "@/lib/server/teacher-groups";

const FILTERS: CommunicationFilter[] = ["all", "lesson", "homework", "general"];

export default async function TeacherStudentCommunicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; studentId: string }>;
  searchParams: Promise<{ filter?: CommunicationFilter }>;
}) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherGroups(resolution)) redirect(ROUTES.dashboard);
  if (resolution.status !== "adult-with-profile") redirect(ROUTES.dashboard);
  assertTeacherGroupsAccess(resolution);

  const { groupId, studentId } = await params;
  const { filter } = await searchParams;
  const activeFilter = FILTERS.includes(filter ?? "all") ? (filter ?? "all") : "all";

  const readModel = await getTeacherConversationReadModel({
      teacherId: resolution.context.teacher?.id ?? "",
      classId: groupId,
      studentId,
      filter: activeFilter,
    }).catch(() => ({
      conversationId: "",
      classId: groupId,
      studentId,
      messages: [],
    }));

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-4">
        <header className="landing-surface rounded-3xl border border-white/80 p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-neutral-500">Коммуникация группы</p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Непрерывный диалог преподавателя и ученика</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {FILTERS.map((item) => (
              <Link
                key={item}
                href={`${ROUTES.groups}/${groupId}/students/${studentId}/communication?filter=${item}`}
                className={`rounded-full border px-3 py-1 ${item === activeFilter ? "bg-neutral-900 text-white" : "bg-white text-neutral-700"}`}
              >
                {item}
              </Link>
            ))}
          </div>
        </header>

        <section className="landing-surface rounded-3xl border border-white/80 p-5 space-y-3">
          {readModel.messages.length === 0 ? (
            <p className="text-sm text-neutral-500">Сообщений пока нет.</p>
          ) : (
            readModel.messages.map((message) => (
              <article key={message.id} className="rounded-2xl border border-neutral-200 p-3 text-sm">
                <p className="font-semibold text-neutral-900">{message.authorRole}</p>
                <p className="mt-1 text-neutral-700">{message.body}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {message.scheduledLessonId ? "Урок" : ""} {message.scheduledLessonHomeworkAssignmentId ? "· Homework" : ""} {message.topicKind ? `· ${message.topicKind}` : ""}
                </p>
              </article>
            ))
          )}

          <form action="/api/teacher/communication" method="POST" className="space-y-2 pt-2">
            <input type="hidden" name="classId" value={groupId} />
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="topicKind" value="general" />
            <input type="hidden" name="redirectTo" value={`${ROUTES.groups}/${groupId}/students/${studentId}/communication?filter=${activeFilter}`} />
            <textarea name="body" rows={3} className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="Сообщение ученику" />
            <button type="submit" className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white">Отправить</button>
          </form>
        </section>
      </div>
    </main>
  );
}
