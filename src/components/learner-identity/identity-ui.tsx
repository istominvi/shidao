import { AlertCircle, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AiConsentStatus,
  IdentityRequestStatus,
  LearnerIdentityState,
} from "@/modules/learner-identity/domain";

export function IdentityLoading({
  children = "Загружаем…",
}: {
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700"
      role="status"
    >
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      {children}
    </div>
  );
}

export function IdentityError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
      role="alert"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-rose-900">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {message}
      </span>
      {onRetry ? (
        <Button
          type="button"
          variant="secondary"
          className="product-btn-danger"
          onClick={onRetry}
        >
          Повторить
        </Button>
      ) : null}
    </div>
  );
}

export function IdentityEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
      <p className="font-semibold text-neutral-950">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-neutral-600">
        {description}
      </p>
    </div>
  );
}

const STATE_LABELS: Record<LearnerIdentityState, string> = {
  offline: "Без аккаунта",
  pending: "Ожидает ответа",
  claimed: "Аккаунт подключён",
  merged: "Объединён",
};

const REQUEST_LABELS: Record<IdentityRequestStatus, string> = {
  pending: "Ожидает ответа",
  bound: "Ожидает решения",
  accepted: "Принято",
  rejected: "Отклонено",
  cancelled: "Отменено",
  revoked: "Отозвано",
  expired: "Истекло",
};

const CONSENT_LABELS: Record<AiConsentStatus, string> = {
  pending: "Ожидает решения",
  active: "Разрешено",
  revoked: "Отозвано",
  expired: "Истекло",
  invalid: "Недоступно",
};

export function IdentityStateBadge({ state }: { state: LearnerIdentityState }) {
  const active = state === "claimed" || state === "merged";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-900" : state === "pending" ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-700"}`}
    >
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {STATE_LABELS[state]}
    </span>
  );
}

export function RequestStatusBadge({
  status,
}: {
  status: IdentityRequestStatus;
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
      {REQUEST_LABELS[status]}
    </span>
  );
}

export function AiConsentStatusBadge({ status }: { status: AiConsentStatus }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
      {CONSENT_LABELS[status]}
    </span>
  );
}

export function formatIdentityDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
