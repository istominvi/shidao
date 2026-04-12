import Link from "next/link";
import { toStudentLessonRoomRoute } from "@/lib/auth";
import type { MethodologyLessonStudentContent } from "@/lib/lesson-content";

export function TeacherStudentContentPreview({
  content,
  scheduledLessonId,
}: {
  content: MethodologyLessonStudentContent | null;
  scheduledLessonId: string;
}) {
  if (!content) {
    return <p className="text-sm text-neutral-600">Ученический контент для этого урока пока не заполнен.</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold text-neutral-900">{content.title}</p>
      {content.subtitle ? <p className="text-neutral-700">{content.subtitle}</p> : null}
      <ul className="space-y-1 text-neutral-700">
        {content.sections.map((section, index) => (
          <li key={`${section.type}-${index}`}>• {section.title}</li>
        ))}
      </ul>
      <Link href={toStudentLessonRoomRoute(scheduledLessonId)} className="inline-flex rounded-xl bg-sky-700 px-3 py-2 font-semibold text-white">
        Открыть ученическую версию
      </Link>
    </div>
  );
}
