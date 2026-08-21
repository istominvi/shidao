"use client";

import {
  CalendarClock,
  CheckCircle2,
  MinusCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProfileSurface } from "@/components/profile/profile-surface";
import { Button } from "@/components/ui/button";
import type {
  LearningRecommendationType,
  TeacherLearnerActivityProfile,
} from "@/modules/learning-activities";
import {
  activityStateLabel,
  formatActivityDate,
  recommendationTypeLabel,
} from "./activity-profile-sections";

type TeacherState = TeacherLearnerActivityProfile["states"][number];

function teacherStateKey(state: TeacherState) {
  return `${state.sourceCourseIdAtTime}:${state.sourceLearningObjectiveIdAtTime}`;
}

const recommendationOptions: ReadonlyArray<{
  value: LearningRecommendationType;
  label: string;
}> = [
  { value: "repeat", label: "Повторить" },
  { value: "try_without_support", label: "Попробовать без поддержки" },
  { value: "apply_in_new_context", label: "Применить в новом контексте" },
  { value: "move_forward", label: "Перейти дальше" },
  { value: "recheck_freshness", label: "Перепроверить" },
];

const directionLabels: Record<string, string> = {
  positive: "Положительное свидетельство",
  negative: "Нужна дальнейшая работа",
};

const supportLabels: Record<string, string> = {
  independent: "Самостоятельно",
  with_support: "С поддержкой",
};

function TeacherStateHeading({ state }: { state: TeacherState }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {state.subjectAtTime || "Без предмета"} · {state.courseTitleAtTime}
      </p>
      <h3 className="mt-1 text-base font-bold text-neutral-950">
        {state.objectiveTitleAtTime}
      </h3>
    </div>
  );
}

function TeacherStateStatus({ state }: { state: TeacherState }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
      {state.status === "confirmed" ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : state.status === "recheck_due" ? (
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {activityStateLabel(state.status)}
    </span>
  );
}

function TeacherRecommendationEditor({
  state,
  busy,
  onOverride,
}: {
  state: TeacherState;
  busy: boolean;
  onOverride: (
    state: TeacherState,
    action: "replace" | "dismiss" | "clear",
    recommendationType: LearningRecommendationType | null,
    privateReason: string | null,
  ) => Promise<void>;
}) {
  const [recommendationType, setRecommendationType] =
    useState<LearningRecommendationType>(
      state.recommendation?.effectiveType ?? "repeat",
    );
  const [privateReason, setPrivateReason] = useState("");
  const hasOverride = Boolean(state.recommendation?.override);
  const options = useMemo(() => recommendationOptions, []);
  useEffect(() => {
    setRecommendationType(state.recommendation?.effectiveType ?? "repeat");
    setPrivateReason("");
  }, [
    state.evaluatedAt,
    state.recommendation?.effectiveType,
    state.recommendation?.generatedAt,
    state.recommendation?.override?.updatedAt,
    state.stateId,
  ]);
  if (state.status === "no_data" || state.stateId === null) return null;
  return (
    <div className="mt-4 rounded-xl bg-neutral-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Решение преподавателя
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <label>
          <span className="sr-only">Следующий шаг</span>
          <select
            className="field-input"
            value={recommendationType}
            disabled={busy}
            onChange={(event) =>
              setRecommendationType(
                event.target.value as LearningRecommendationType,
              )
            }
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Личное основание преподавателя</span>
          <input
            className="field-input"
            maxLength={500}
            value={privateReason}
            disabled={busy}
            placeholder="Личное основание (видно только преподавателю)"
            onChange={(event) => setPrivateReason(event.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy || !privateReason.trim()}
          onClick={() =>
            void onOverride(
              state,
              "replace",
              recommendationType,
              privateReason.trim(),
            )
          }
        >
          Заменить рекомендацию
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !privateReason.trim()}
          onClick={() =>
            void onOverride(state, "dismiss", null, privateReason.trim())
          }
        >
          <MinusCircle className="h-4 w-4" aria-hidden="true" />
          Скрыть рекомендацию
        </Button>
        {hasOverride ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void onOverride(state, "clear", null, null)}
          >
            Вернуть правило
          </Button>
        ) : null}
      </div>
      {state.recommendation?.override?.privateReason ? (
        <p className="mt-2 text-xs text-neutral-500">
          Текущее личное основание:{" "}
          {state.recommendation.override.privateReason}
        </p>
      ) : null}
    </div>
  );
}

export function TeacherActivityProfileSections({
  profile,
  busy,
  onOverride,
}: {
  profile: TeacherLearnerActivityProfile;
  busy: boolean;
  onOverride: (
    state: TeacherState,
    action: "replace" | "dismiss" | "clear",
    recommendationType: LearningRecommendationType | null,
    privateReason: string | null,
  ) => Promise<void>;
}) {
  const recommendationStates = profile.states.filter(
    (state) => state.status !== "no_data" && state.stateId !== null,
  );
  return (
    <div className="space-y-5" data-teacher-activity-profile="true">
      <ProfileSurface
        title="Навыки"
        description="Перестраиваемые состояния по учебным целям. Одна отметка не подтверждает цель, а устаревание означает только, что её пора перепроверить."
      >
        {profile.states.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Подходящих завершённых наблюдений пока нет. Старые наблюдения без
            учебной цели остаются только в истории выше.
          </p>
        ) : (
          <ol className="space-y-3">
            {profile.states.map((state) => (
              <li
                key={teacherStateKey(state)}
                className="rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <TeacherStateHeading state={state} />
                  <TeacherStateStatus state={state} />
                </div>
                <p className="mt-3 text-sm text-neutral-700">
                  {state.reasonText}
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  Состояние на {formatActivityDate(state.evaluatedAt)} ·
                  свидетельств: {state.evidence.length}
                </p>
                {state.evidence.length > 0 ? (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-semibold">
                      Показать свидетельства
                    </summary>
                    <ol className="mt-2 space-y-2">
                      {state.evidence.map((evidence) => (
                        <li
                          key={evidence.id}
                          className="rounded-xl bg-neutral-50 p-3"
                        >
                          <p className="font-semibold">
                            {evidence.lessonTitleAtTime} ·{" "}
                            {evidence.componentLabelAtTime}
                          </p>
                          <p className="mt-1 text-xs text-neutral-600">
                            {directionLabels[evidence.direction] ??
                              evidence.direction}
                            {evidence.support
                              ? ` · ${supportLabels[evidence.support] ?? evidence.support}`
                              : ""}
                            {` · ${formatActivityDate(evidence.finalizedAt)}`}
                          </p>
                          <p className="mt-1 text-sm">
                            {evidence.criterionAtTime}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </ProfileSurface>

      <ProfileSurface
        title="Рекомендации"
        description="Следующие шаги по прозрачным правилам. Решение преподавателя сохраняется отдельно и не меняет порядок курса."
      >
        {recommendationStates.length === 0 ? (
          <p className="text-sm text-neutral-600">Рекомендаций пока нет.</p>
        ) : (
          <ol className="space-y-3">
            {recommendationStates.map((state) => {
              const recommendation = state.recommendation;
              return (
                <li
                  key={teacherStateKey(state)}
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <TeacherStateHeading state={state} />
                  {recommendation ? (
                    <>
                      <p className="mt-3 font-semibold text-neutral-950">
                        {recommendation.effectiveType
                          ? recommendationTypeLabel(
                              recommendation.effectiveType,
                            )
                          : "Рекомендация скрыта"}
                      </p>
                      {recommendation.effectiveReasonText ? (
                        <p className="mt-1 text-sm text-neutral-700">
                          {recommendation.effectiveReasonText}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-neutral-500">
                        Источник:{" "}
                        {recommendation.source === "teacher_override"
                          ? "решение преподавателя"
                          : "правило"}{" "}
                        · {recommendation.reasonCode}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-neutral-600">
                      Для этого состояния следующий шаг не требуется.
                    </p>
                  )}
                  <TeacherRecommendationEditor
                    state={state}
                    busy={busy}
                    onOverride={onOverride}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </ProfileSurface>
    </div>
  );
}
