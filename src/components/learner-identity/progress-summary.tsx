import { CalendarClock, CheckCircle2, Clock3, RotateCcw } from "lucide-react";
import type { LearnerProgress } from "@/modules/learner-identity/domain";
import { formatIdentityDate, IdentityEmpty } from "./identity-ui";

function durationLabel(minutes: number | null) {
  if (minutes === null) return "Нет достоверных данных";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

export function ProgressSummary({ progress }: { progress: LearnerProgress }) {
  if (progress.finalizedRunCount === 0) {
    return (
      <IdentityEmpty
        title="Проведённых занятий пока нет"
        description="Здесь появятся только реальные итоги завершённых занятий — без выдуманных оценок и нулей вместо неизвестных данных."
      />
    );
  }

  const cards = [
    {
      label: "Проведений",
      value: progress.finalizedRunCount,
      icon: CalendarClock,
    },
    { label: "Посещено", value: progress.attendedRunCount, icon: CheckCircle2 },
    {
      label: "Рекомендован повтор",
      value: progress.repeatRecommendedCount,
      icon: RotateCcw,
    },
    {
      label: "Известное фактическое время",
      value: durationLabel(progress.knownActualDurationMinutes),
      icon: Clock3,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <card.icon
              className="h-5 w-5 text-neutral-500"
              aria-hidden="true"
            />
            <p className="mt-3 text-2xl font-black text-neutral-950">
              {card.value}
            </p>
            <p className="mt-1 text-sm text-neutral-600">{card.label}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-neutral-600">
        Последняя активность:{" "}
        <strong className="text-neutral-900">
          {formatIdentityDate(progress.lastActivityAt)}
        </strong>
        . Фактическое время известно для {progress.knownActualDurationRunCount}{" "}
        проведений; неизвестное время не считается нулём.
      </p>
      {progress.subjects.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">Прогресс по предметам</caption>
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3">Предмет</th>
                <th className="px-4 py-3">Проведений</th>
                <th className="px-4 py-3">Посещено</th>
                <th className="px-4 py-3">Повтор</th>
                <th className="px-4 py-3">Фактическое время</th>
              </tr>
            </thead>
            <tbody>
              {progress.subjects.map((subject) => (
                <tr
                  key={subject.subject}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <th className="px-4 py-3 font-semibold text-neutral-950">
                    {subject.subject}
                  </th>
                  <td className="px-4 py-3">{subject.completedRunCount}</td>
                  <td className="px-4 py-3">{subject.attendedRunCount}</td>
                  <td className="px-4 py-3">
                    {subject.repeatRecommendedCount}
                  </td>
                  <td className="px-4 py-3">
                    {durationLabel(subject.knownActualDurationMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
