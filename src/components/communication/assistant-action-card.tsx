"use client";

import { Check, ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import type { AiLessonComponentPlan } from "@/modules/ai/course-builder-contracts";
import type {
  SystemAssistantActionProposal,
  SystemAssistantActionResult,
} from "@/modules/ai/system-assistant-contracts";

export type AssistantActionState =
  | { status: "applying" }
  | { status: "cancelled" }
  | { status: "stale"; message: string }
  | { status: "failed"; message: string }
  | { status: "applied"; result: SystemAssistantActionResult };

const CONFIRM_WORDS = new Set([
  "да",
  "верно",
  "всё верно",
  "подтверждаю",
  "подтверждаю действие",
  "согласен",
  "согласна",
  "выполняй",
  "применяй",
  "да, выполняй",
  "да, применяй",
  "да, подтверждаю",
  "да, всё верно",
]);

const CANCEL_WORDS = new Set([
  "нет",
  "нет, отмени",
  "отмена",
  "отмени",
  "не надо",
  "не нужно",
]);

const scheduledAtFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
});

export function confirmationIntent(value: string) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/[.!?]+$/u, "")
    .trim();
  if (CONFIRM_WORDS.has(normalized)) return "confirm" as const;
  if (CANCEL_WORDS.has(normalized)) return "cancel" as const;
  return null;
}

export function actionTitle(proposal: SystemAssistantActionProposal) {
  switch (proposal.action.type) {
    case "course.create_draft":
      return "Создать курс";
    case "course.add_lesson":
      return "Добавить пустой урок";
    case "course.add_lesson_with_plan":
      return "Создать наполненный урок";
    case "lesson.fill":
      return "Дополнить урок";
    case "lesson.delete":
      return "Удалить урок";
    case "lesson.schedule_run":
      return proposal.action.existingLessonRunId
        ? "Перенести урок"
        : "Назначить урок";
  }
}

export function verifiedMessage(result: SystemAssistantActionResult) {
  switch (result.type) {
    case "course.create_draft":
      return `Готово: курс «${result.courseTitle}» создан.`;
    case "course.add_lesson":
    case "course.add_lesson_with_plan":
      return `Готово: урок «${result.lessonTitle}» добавлен в курс «${result.courseTitle}».`;
    case "lesson.fill":
      return `Готово: в урок «${result.lessonTitle}» добавлено ${result.componentIds.length} блоков.`;
    case "lesson.delete":
      return `Готово: урок «${result.lessonTitle}» удалён из курса «${result.courseTitle}».`;
    case "lesson.schedule_run":
      return `Готово: урок «${result.lessonTitle}» назначен на ${scheduledAtFormatter.format(new Date(result.scheduledAt))}.`;
  }
}

function lessonComponentPreview(component: AiLessonComponentPlan) {
  switch (component.typeKey) {
    case "rich_text":
      return {
        label: "Текст",
        content: [component.payload.title, component.payload.content]
          .filter(Boolean)
          .join(": "),
      };
    case "callout":
      return {
        label: "Акцент",
        content: component.payload.title
          ? `${component.payload.title}: ${component.payload.text}`
          : component.payload.text,
      };
    case "single_choice_poll":
      return {
        label: "Опрос",
        content: `${component.payload.question} — ${component.payload.options
          .map((option) => option.label)
          .join(" / ")}`,
      };
    case "matching_game":
      return {
        label: "Сопоставление",
        content: `${component.payload.instruction} — ${component.payload.pairs
          .map((pair) => `${pair.left} ↔ ${pair.right}`)
          .join("; ")}`,
      };
    case "choice_quiz":
      return {
        label: "Тест с выбором ответа",
        content: `${component.payload.question} — ${component.payload.options
          .map((option) => option.label)
          .join(" / ")}`,
      };
  }
}

export function AssistantActionCard({
  proposal,
  state,
  busy,
  onApply,
  onCancel,
}: {
  proposal: SystemAssistantActionProposal;
  state: AssistantActionState | undefined;
  busy: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const action = proposal.action;
  const pending = !state || state.status === "failed";

  return (
    <article className="communication-assistant-action-card">
      <div className="communication-assistant-action-title">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <strong>Предлагаемое действие</strong>
      </div>
      {action.type === "course.create_draft" ? (
        <dl>
          <div>
            <dt>Курс</dt>
            <dd>{action.input.title}</dd>
          </div>
          <div>
            <dt>Предмет и уровень</dt>
            <dd>
              {action.input.subject} · {action.input.level}
            </dd>
          </div>
          <div>
            <dt>Цель</dt>
            <dd>{action.input.goal}</dd>
          </div>
          <div>
            <dt>Уроков</dt>
            <dd>{action.input.targetLessonCount}</dd>
          </div>
          {action.input.audienceDescription ? (
            <div>
              <dt>Аудитория</dt>
              <dd>{action.input.audienceDescription}</dd>
            </div>
          ) : null}
          {action.input.teacherPreferences ? (
            <div>
              <dt>Пожелания</dt>
              <dd>{action.input.teacherPreferences}</dd>
            </div>
          ) : null}
        </dl>
      ) : action.type === "lesson.delete" ? (
        <>
          <dl>
            <div>
              <dt>Курс</dt>
              <dd>{action.courseTitle}</dd>
            </div>
            <div>
              <dt>Будет удалён урок</dt>
              <dd>{action.lessonTitle}</dd>
            </div>
          </dl>
          <p className="communication-assistant-action-warning">
            План, назначения и история проведений урока будут удалены.
            Завершённые индивидуальные результаты учеников сохранятся.
          </p>
        </>
      ) : action.type === "lesson.schedule_run" ? (
        <dl>
          <div>
            <dt>Курс</dt>
            <dd>{action.courseTitle}</dd>
          </div>
          <div>
            <dt>Урок</dt>
            <dd>{action.lessonTitle}</dd>
          </div>
          <div>
            <dt>
              {action.existingLessonRunId ? "Новое время" : "Дата и время"}
            </dt>
            <dd>{scheduledAtFormatter.format(new Date(action.scheduledAt))}</dd>
          </div>
          <div>
            <dt>Продолжительность</dt>
            <dd>{action.plannedDurationMinutes} мин.</dd>
          </div>
          <div>
            <dt>Участники</dt>
            <dd>{action.participantCount}</dd>
          </div>
        </dl>
      ) : (
        <dl>
          <div>
            <dt>Курс</dt>
            <dd>{action.courseTitle}</dd>
          </div>
          <div>
            <dt>Урок</dt>
            <dd>
              {action.type === "lesson.fill"
                ? action.lessonTitle
                : action.input.title}
            </dd>
          </div>
          {action.type === "course.add_lesson" && action.input.summary ? (
            <div>
              <dt>Комментарий</dt>
              <dd>{action.input.summary}</dd>
            </div>
          ) : null}
          {action.type === "course.add_lesson_with_plan" ||
          action.type === "lesson.fill" ? (
            <>
              <div>
                <dt>
                  {action.type === "lesson.fill"
                    ? "Комментарий преподавателя"
                    : "Содержание"}
                </dt>
                <dd>
                  {action.type === "lesson.fill" ? "Заменится на: " : null}
                  {action.input.plan.summary}
                </dd>
              </div>
              <div>
                <dt>Блоки ({action.input.plan.components.length})</dt>
                <dd>
                  <ol className="communication-assistant-plan-preview">
                    {action.input.plan.components.map((component, index) => {
                      const preview = lessonComponentPreview(component);
                      return (
                        <li key={`${component.typeKey}-${index}`}>
                          <strong>{preview.label}</strong>
                          <span>{preview.content}</span>
                        </li>
                      );
                    })}
                  </ol>
                </dd>
              </div>
              {action.type === "lesson.fill" ? (
                <div>
                  <dt>Существующий план</dt>
                  <dd>Сохранится; новые блоки будут добавлены в конец.</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>
      )}

      {state?.status === "applied" ? (
        <div className="communication-assistant-action-result">
          <span>
            <Check className="h-4 w-4" aria-hidden="true" /> Применено
          </span>
          <a href={state.result.href}>
            Открыть <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      ) : state?.status === "cancelled" ? (
        <p className="communication-assistant-action-note">
          Действие не применено.
        </p>
      ) : state?.status === "stale" ? (
        <p className="communication-assistant-action-error" role="alert">
          {state.message}
        </p>
      ) : (
        <div className="communication-assistant-action-buttons">
          <button
            type="button"
            className="communication-assistant-secondary-button"
            disabled={busy}
            onClick={onCancel}
          >
            Отменить
          </button>
          <button
            type="button"
            className={
              action.type === "lesson.delete"
                ? "communication-assistant-danger-button"
                : "communication-assistant-primary-button"
            }
            disabled={!pending || busy}
            onClick={onApply}
          >
            {state?.status === "applying" ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {actionTitle(proposal)}
          </button>
        </div>
      )}
      {state?.status === "failed" ? (
        <p className="communication-assistant-action-error" role="alert">
          {state.message}
        </p>
      ) : null}
    </article>
  );
}
