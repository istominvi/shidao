"use client";

import {
  BrainCircuit,
  Copy,
  Mail,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  LearnerInvitation,
  TeacherLearnerDirectoryItem,
} from "@/modules/learner-identity/domain";
import type { CourseSummary } from "@/modules/course-builder/domain";
import {
  createLearnerInvitation,
  loadOwnedCourses,
  loadLearnerInvitations,
  requestAiConsent,
  revokeLearnerInvitation,
} from "./identity-client";
import {
  formatIdentityDate,
  IdentityEmpty,
  IdentityError,
  IdentityLoading,
  IdentityStateBadge,
  RequestStatusBadge,
} from "./identity-ui";

export function LearnerIdentityPanel({
  learner,
}: {
  learner: TeacherLearnerDirectoryItem;
}) {
  const [invitations, setInvitations] = useState<LearnerInvitation[] | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<"claim" | "child_activation">("claim");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyLink, setCopyLink] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [courseId, setCourseId] = useState("");
  const [consentPurpose, setConsentPurpose] = useState(
    "Учитывать опубликованные результаты прошлых занятий при подготовке материалов этого курса.",
  );
  const [consentStatus, setConsentStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setInvitations(await loadLearnerInvitations(learner.learnerProfileId));
  }, [learner.learnerProfileId]);

  useEffect(() => {
    let active = true;
    void load().catch((caught) => {
      if (active)
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить приглашения.",
        );
    });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    void loadOwnedCourses()
      .then((items) => {
        if (!active) return;
        setCourses(items);
        setCourseId((current) => current || items[0]?.id || "");
      })
      .catch(() => {
        if (active) setCourses([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    setCopyLink(null);
    try {
      const created = await createLearnerInvitation(learner.learnerProfileId, {
        kind,
        recipientEmail: email.trim(),
      });
      setCopyLink(created.copyLink);
      setEmail("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось создать приглашение.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invitationId: string) {
    setBusy(true);
    setError(null);
    try {
      await revokeLearnerInvitation(invitationId);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось отозвать приглашение.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createConsentRequest() {
    if (!courseId || !consentPurpose.trim() || busy) return;
    setBusy(true);
    setError(null);
    setConsentStatus(null);
    try {
      await requestAiConsent(courseId, {
        learnerProfileId: learner.learnerProfileId,
        purpose: consentPurpose.trim(),
        expiresInDays: 90,
      });
      setConsentStatus(
        "Запрос отправлен. Разрешение начнёт действовать только после подтверждения владельцем учебного профиля.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось отправить запрос разрешения.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            Связь с аккаунтом
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
            Локальное имя остаётся только в вашем справочнике.
          </p>
        </div>
        <IdentityStateBadge state={learner.identityState} />
      </div>

      {learner.identityState === "offline" ||
      learner.identityState === "pending" ? (
        <form
          className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div>
            <h3 className="font-semibold text-neutral-950">
              Пригласить в ShiDao
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Получатель должен войти подтверждённым адресованным аккаунтом.
              Преподаватель не создаёт пароль.
            </p>
          </div>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Тип приглашения</legend>
            <label className="flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-sm">
              <input
                type="radio"
                name="invitation-kind"
                checked={kind === "claim"}
                onChange={() => setKind("claim")}
              />
              <span>
                <strong className="block">Подключить получателя</strong>
                <span className="text-neutral-600">
                  Перед объединением вы увидите состав и возможные ограничения.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-sm">
              <input
                type="radio"
                name="invitation-kind"
                checked={kind === "child_activation"}
                onChange={() => setKind("child_activation")}
              />
              <span>
                <strong className="block">Отдельный аккаунт учащегося</strong>
                <span className="text-neutral-600">
                  Получатель задаст логин и PIN; его текущий аккаунт не станет
                  профилем ученика.
                </span>
              </span>
            </label>
          </fieldset>
          <label className="block">
            <span className="field-label">Подтверждённый email получателя</span>
            <input
              className="field-input"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="recipient@example.com"
            />
          </label>
          <Button type="submit" disabled={busy || !email.trim()}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            {busy ? "Отправляем…" : "Создать приглашение"}
          </Button>
          {copyLink ? (
            <div
              className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
              role="status"
            >
              <p>
                Сохраните резервную одноразовую ссылку сейчас — повторно секрет
                не показывается.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-2"
                onClick={() => void navigator.clipboard.writeText(copyLink)}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Копировать
              </Button>
            </div>
          ) : null}
        </form>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <ShieldCheck className="mb-2 h-5 w-5" aria-hidden="true" />
          Аккаунт подключён. Вы по-прежнему видите личные комментарии только к
          собственным занятиям, а доступ наблюдателя не появляется
          автоматически.
        </div>
      )}

      {learner.identityState === "claimed" ||
      learner.identityState === "merged" ? (
        <form
          className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createConsentRequest();
          }}
        >
          <div className="flex items-start gap-3">
            <BrainCircuit className="mt-0.5 h-5 w-5" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-neutral-950">
                Запросить разрешение для помощника
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                Учащийся решит сам. Разрешение относится только к выбранному
                курсу и открывает помощнику ограниченную сводку опубликованных
                результатов — не личные заметки преподавателей.
              </p>
            </div>
          </div>
          {courses && courses.length > 0 ? (
            <>
              <label className="block">
                <span className="field-label">Курс</span>
                <select
                  className="field-input"
                  required
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Для чего нужна история</span>
                <textarea
                  className="field-input min-h-24 resize-y"
                  required
                  maxLength={400}
                  value={consentPurpose}
                  onChange={(event) => setConsentPurpose(event.target.value)}
                />
              </label>
              <Button
                type="submit"
                disabled={busy || !courseId || !consentPurpose.trim()}
              >
                <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                {busy ? "Отправляем…" : "Отправить запрос"}
              </Button>
            </>
          ) : courses === null ? (
            <IdentityLoading>Загружаем ваши курсы…</IdentityLoading>
          ) : (
            <IdentityEmpty
              title="Сначала создайте курс"
              description="Разрешение всегда привязано к одному вашему курсу."
            />
          )}
          {consentStatus ? (
            <p
              className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950"
              role="status"
            >
              {consentStatus}
            </p>
          ) : null}
        </form>
      ) : null}

      {error ? (
        <IdentityError message={error} onRetry={() => void load()} />
      ) : null}
      {invitations === null && !error ? (
        <IdentityLoading>Загружаем приглашения…</IdentityLoading>
      ) : null}
      {invitations?.length === 0 ? (
        <IdentityEmpty
          title="Приглашений нет"
          description="Новое приглашение будет одноразовым, адресованным и ограниченным по времени."
        />
      ) : null}
      {invitations && invitations.length > 0 ? (
        <ul className="space-y-2" aria-label="Приглашения ученика">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>
                    {invitation.kind === "child_activation"
                      ? "Отдельный аккаунт"
                      : "Подключение аккаунта"}
                  </strong>
                  <RequestStatusBadge status={invitation.status} />
                </div>
                <p className="mt-1 text-xs text-neutral-600">
                  Создано {formatIdentityDate(invitation.createdAt)} · действует
                  до {formatIdentityDate(invitation.expiresAt)}
                </p>
              </div>
              {invitation.status === "pending" ||
              invitation.status === "bound" ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void revoke(invitation.id)}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Отозвать
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void load()}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Обновить
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
