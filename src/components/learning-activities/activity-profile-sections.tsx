"use client";

import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { ProfileSurface } from "@/components/profile/profile-surface";
import type {
  LearnerObjectiveStateStatus,
  LearnerSafeActivityProfile,
  LearningRecommendationType,
} from "@/modules/learning-activities";

type SafeState = LearnerSafeActivityProfile["states"][number];

export type ActivityProfileSection = "skills" | "recommendations";

const recommendationLabels: Record<LearningRecommendationType, string> = {
  repeat: "Повторить",
  try_without_support: "Попробовать без поддержки",
  apply_in_new_context: "Применить в новом контексте",
  move_forward: "Перейти дальше",
  recheck_freshness: "Перепроверить",
};

const statusLabels: Record<LearnerObjectiveStateStatus | "no_data", string> = {
  no_data: "Нет данных",
  forming: "Формируется",
  confirmed: "Подтверждено",
  recheck_due: "Пора перепроверить",
};

const directionLabels: Record<string, string> = {
  positive: "Положительное свидетельство",
  negative: "Нужна дальнейшая работа",
};

const supportLabels: Record<string, string> = {
  independent: "Самостоятельно",
  with_support: "С поддержкой",
  not_yet: "Пока не получилось",
};

export function formatActivityDate(value: string | null) {
  if (!value) return "Дата не зафиксирована";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не зафиксирована";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function activityStateLabel(
  value: LearnerObjectiveStateStatus | "no_data",
) {
  return statusLabels[value];
}

export function recommendationTypeLabel(value: LearningRecommendationType) {
  return recommendationLabels[value];
}

function StateHeading({ state }: { state: SafeState }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {state.subject || "Без предмета"} · {state.courseTitle}
      </p>
      <h3 className="mt-1 text-base font-bold text-neutral-950">
        {state.objectiveTitle}
      </h3>
    </div>
  );
}

function StateStatus({ state }: { state: SafeState }) {
  const status = state.state;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
      {status === "confirmed" ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : status === "recheck_due" ? (
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {activityStateLabel(status)}
    </span>
  );
}

function SafeSkills({ profile }: { profile: LearnerSafeActivityProfile }) {
  if (profile.states.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Навыки появятся после нескольких завершённых наблюдений по учебной цели.
        Одна отметка не подтверждает навык.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {profile.states.map((state) => (
        <li
          key={state.key}
          className="rounded-2xl border border-neutral-200 bg-white p-4"
          data-activity-objective-state={state.state}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <StateHeading state={state} />
            <StateStatus state={state} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">
            {state.reasonText}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Состояние на {formatActivityDate(state.evaluatedAt)}
            {state.lastEvidenceAt
              ? ` · последнее свидетельство ${formatActivityDate(state.lastEvidenceAt)}`
              : ""}
          </p>
          {state.evidenceReferences.length > 0 ? (
            <details className="mt-3 text-sm text-neutral-700">
              <summary className="cursor-pointer font-semibold">
                Свидетельства: {state.evidenceReferences.length}
              </summary>
              <ol className="mt-2 space-y-2">
                {state.evidenceReferences.map((evidence) => (
                  <li
                    key={evidence.key}
                    className="rounded-xl bg-neutral-50 p-3"
                  >
                    <p className="font-semibold">
                      {evidence.lessonTitle} · {evidence.componentLabel}
                    </p>
                    <p className="mt-1 text-xs text-neutral-600">
                      {directionLabels[evidence.direction] ??
                        evidence.direction}
                      {evidence.support
                        ? ` · ${supportLabels[evidence.support] ?? evidence.support}`
                        : ""}
                      {` · ${formatActivityDate(evidence.evidenceAt)}`}
                    </p>
                    <p className="mt-1 text-sm">{evidence.criterion}</p>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function SafeRecommendations({
  profile,
}: {
  profile: LearnerSafeActivityProfile;
}) {
  const states = profile.states.filter((state) => state.recommendation);
  if (states.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Рекомендаций пока нет. Они появятся после объяснимого состояния навыка и
        не меняют порядок урока или компонентов.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {states.map((state) => {
        const recommendation = state.recommendation;
        if (!recommendation) return null;
        return (
          <li
            key={state.key}
            className="rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <StateHeading state={state} />
            <p className="mt-3 font-semibold text-neutral-950">
              {recommendationTypeLabel(recommendation.type)}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-700">
              {recommendation.reasonText}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Основано на состоянии и разрешённых свидетельствах · обновлено{" "}
              {formatActivityDate(recommendation.generatedAt)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function SafeActivityProfileSection({
  profile,
  section,
}: {
  profile: LearnerSafeActivityProfile;
  section: ActivityProfileSection;
}) {
  return (
    <ProfileSurface
      title={
        <span className="inline-flex items-center gap-2">
          {section === "skills" ? (
            <BookOpenCheck
              className="h-5 w-5 text-sky-700"
              aria-hidden="true"
            />
          ) : (
            <Lightbulb className="h-5 w-5 text-amber-600" aria-hidden="true" />
          )}
          {section === "skills" ? "Навыки" : "Рекомендации"}
        </span>
      }
      description={
        section === "skills"
          ? "Объяснимые состояния учебных целей по завершённым наблюдениям. Здесь нет процента освоения."
          : "Простые следующие шаги. Они не переставляют уроки и не запускают скрытое расписание."
      }
    >
      {section === "skills" ? (
        <SafeSkills profile={profile} />
      ) : (
        <SafeRecommendations profile={profile} />
      )}
    </ProfileSurface>
  );
}
