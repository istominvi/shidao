"use client";

import { LoaderCircle, Send } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  AssistantActionCard,
  confirmationIntent,
  verifiedMessage,
  type AssistantActionState,
} from "@/components/assistant/system-assistant";
import {
  applySystemAssistantAction,
  SystemAssistantClientError,
} from "@/components/assistant/system-assistant-client";
import { useSystemAssistant } from "@/components/assistant/system-assistant-provider";
import {
  loadAssistantMonthlyQuota,
  loadAssistantTurns,
  markAssistantConversationRead,
  sendAssistantTurn,
} from "@/components/communication/communication-client";
import { CommunicationMarkdown } from "@/components/communication/communication-markdown";
import { fullCommunicationTime } from "@/components/communication/communication-presenters";
import { usePageVisible } from "@/components/communication/use-page-visible";
import type {
  SystemAssistantActionProposal,
  SystemAssistantQuickReply,
} from "@/modules/ai/system-assistant-contracts";
import type {
  AssistantConversation,
  AssistantMonthlyQuota,
  AssistantTurn,
} from "@/modules/communication/domain";
import type { PersistedAssistantReplyPayload } from "@/modules/communication/output-contracts";

type PendingTurn = {
  clientTurnId: string;
  body: string;
  status: "sending" | "failed";
};

export type AssistantConversationSummary = Pick<
  AssistantConversation,
  "id" | "title" | "contextCourseId" | "contextLessonId"
>;

type AssistantTurnMetadata = {
  proposedAction: SystemAssistantActionProposal | null;
  quickReplies: SystemAssistantQuickReply[];
};

const EMPTY_METADATA: AssistantTurnMetadata = {
  proposedAction: null,
  quickReplies: [],
};

function metadata(turn: AssistantTurn): AssistantTurnMetadata {
  if (turn.role !== "assistant") return EMPTY_METADATA;
  const reply = (turn.payload as Partial<PersistedAssistantReplyPayload>).reply;
  if (!reply) return EMPTY_METADATA;
  return {
    proposedAction: reply.proposedAction,
    quickReplies: reply.quickReplies,
  };
}

function AssistantQuotaBar({ quota }: { quota: AssistantMonthlyQuota }) {
  const remainingRatio = Math.max(
    0,
    Math.min(1, quota.remainingTokens / quota.limitTokens),
  );
  const remainingPercent = Math.round(remainingRatio * 100);

  return (
    <div
      className="communication-assistant-quota"
      role="progressbar"
      aria-label="Месячный запас ИИ"
      aria-valuemin={0}
      aria-valuemax={quota.limitTokens}
      aria-valuenow={quota.remainingTokens}
      aria-valuetext={`Осталось ${remainingPercent}% месячного объёма ИИ`}
    >
      <span style={{ width: `${remainingRatio * 100}%` }} />
    </div>
  );
}

function latestPendingProposal(
  turns: AssistantTurn[],
  states: Record<string, AssistantActionState>,
) {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const proposal = metadata(turns[index]!).proposedAction;
    if (!proposal) continue;
    const state = states[proposal.idempotencyKey];
    if (!state || state.status === "failed") return proposal;
  }
  return null;
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function assistantPrompts(conversation: AssistantConversationSummary) {
  if (conversation.contextLessonId) {
    return [
      "Что важно в этом уроке?",
      "Проверь структуру урока",
      "Что увидит ученик?",
      "Покажи результаты урока",
      "Дополни этот урок",
      "Создай следующий урок",
      "Запланируй этот урок",
      "Перенеси этот урок",
      "Удали этот урок",
    ];
  }
  if (conversation.contextCourseId) {
    return [
      "Проверь структуру курса",
      "Что улучшить в курсе?",
      "Кто учится на курсе?",
      "Покажи последние результаты",
      "Кому нужно повторение?",
      "Какие материалы прикреплены?",
      "Создай пустой урок",
      "Создай готовый урок",
      "Дополни урок содержанием",
      "Запланируй урок",
      "Перенеси урок",
      "Удали урок",
    ];
  }
  return [
    "Расскажи о моих курсах",
    "Сравни мои курсы",
    "Создай новый курс",
    "Добавь пустой урок в курс",
    "Создай готовый урок в курсе",
  ];
}

export function AssistantConversationView({
  conversation,
  onActivity,
  onAnnouncement,
}: {
  conversation: AssistantConversationSummary;
  onActivity: () => void;
  onAnnouncement: (message: string) => void;
}) {
  const { page } = useSystemAssistant();
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<AssistantMonthlyQuota | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [actionStates, setActionStates] = useState<
    Record<string, AssistantActionState>
  >({});
  const [liveProposalKey, setLiveProposalKey] = useState<string | null>(null);
  const [hiddenQuickRepliesForTurnId, setHiddenQuickRepliesForTurnId] =
    useState<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const quotaRequestRef = useRef(0);
  const pageVisible = usePageVisible();
  const applying = Object.values(actionStates).some(
    (state) => state.status === "applying",
  );
  const latestTurn = turns.at(-1) ?? null;
  const latestTurnId = latestTurn?.id ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTurns([]);
    setNextCursor(null);
    setPending(null);
    setActionStates({});
    setLiveProposalKey(null);
    setHiddenQuickRepliesForTurnId(null);
    setError(null);
    setQuota(null);
    const quotaRequest = ++quotaRequestRef.current;
    void loadAssistantMonthlyQuota()
      .then((nextQuota) => {
        if (active && quotaRequest === quotaRequestRef.current) {
          setQuota(nextQuota);
        }
      })
      .catch(() => null);
    void loadAssistantTurns(conversation.id)
      .then((payload) => {
        if (!active) return;
        const loadedTurns = [...payload.turns.items].sort(
          (left, right) => left.id - right.id,
        );
        const loadedProposals = loadedTurns.flatMap((turn) => {
          const proposal = metadata(turn).proposedAction;
          return proposal ? [proposal] : [];
        });
        setTurns(loadedTurns);
        setActionStates(
          Object.fromEntries(
            loadedProposals.map((proposal) => [
              proposal.idempotencyKey,
              {
                status: "stale" as const,
                message:
                  "Подготовьте это предложение заново перед применением.",
              },
            ]),
          ),
        );
        setNextCursor(payload.turns.nextCursor);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(errorMessage(caught, "Не удалось загрузить диалог с ИИ."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [conversation.id]);

  useEffect(() => {
    if (loading) return;
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "nearest" });
      composerRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, turns.length]);

  useEffect(() => {
    if (!latestTurnId || !pageVisible) return;
    void markAssistantConversationRead(conversation.id, latestTurnId)
      .then(onActivity)
      .catch(() => undefined);
  }, [conversation.id, latestTurnId, onActivity, pageVisible]);

  const proposals = useMemo(
    () =>
      turns.flatMap((turn) => {
        const proposal = metadata(turn).proposedAction;
        return proposal ? [proposal] : [];
      }),
    [turns],
  );

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    setError(null);
    try {
      const payload = await loadAssistantTurns(conversation.id, nextCursor);
      setTurns((current) => {
        const known = new Set(current.map((turn) => turn.id));
        return [
          ...payload.turns.items.filter((turn) => !known.has(turn.id)),
          ...current,
        ].sort((left, right) => left.id - right.id);
      });
      setActionStates((current) => {
        const next = { ...current };
        for (const turn of payload.turns.items) {
          const proposal = metadata(turn).proposedAction;
          if (!proposal || next[proposal.idempotencyKey]) continue;
          next[proposal.idempotencyKey] = {
            status: "stale",
            message: "Подготовьте это предложение заново перед применением.",
          };
        }
        return next;
      });
      setNextCursor(payload.turns.nextCursor);
    } catch (caught) {
      setError(errorMessage(caught, "Не удалось загрузить предыдущие ответы."));
    } finally {
      setLoadingOlder(false);
    }
  }

  function cancelAction(proposal: SystemAssistantActionProposal) {
    setLiveProposalKey((current) =>
      current === proposal.idempotencyKey ? null : current,
    );
    setActionStates((current) => ({
      ...current,
      [proposal.idempotencyKey]: { status: "cancelled" },
    }));
    onAnnouncement("Действие не применено.");
  }

  async function applyAction(proposal: SystemAssistantActionProposal) {
    const key = proposal.idempotencyKey;
    setActionStates((current) => ({
      ...current,
      [key]: { status: "applying" },
    }));
    setError(null);
    try {
      const result = await applySystemAssistantAction(proposal);
      setActionStates((current) => ({
        ...current,
        [key]: { status: "applied", result },
      }));
      const message = verifiedMessage(result);
      setLiveProposalKey((current) => (current === key ? null : current));
      onAnnouncement(message);
      try {
        await page.onActionApplied?.(result);
      } catch {
        // The server mutation is already verified; the result link remains usable.
      }
      onActivity();
    } catch (caught) {
      const message = errorMessage(caught, "Не удалось применить действие.");
      const terminal =
        caught instanceof SystemAssistantClientError &&
        [
          "ai_action_proposal_invalid",
          "ai_action_stale",
          "ai_plan_stale",
          "ai_consent_stale",
        ].includes(caught.code ?? "");
      setActionStates((current) => ({
        ...current,
        [key]: terminal
          ? {
              status: "stale",
              message: `${message} Попросите ИИ подготовить новое предложение.`,
            }
          : { status: "failed", message },
      }));
    }
  }

  async function send(body: string, clientTurnId = crypto.randomUUID()) {
    const normalized = body.trim();
    if (!normalized || pending?.status === "sending" || applying) return;
    setHiddenQuickRepliesForTurnId(latestTurnId);

    const proposal = latestPendingProposal(turns, actionStates);
    const intent = proposal ? confirmationIntent(normalized) : null;
    if (proposal && intent === "confirm") {
      setDraft("");
      await applyAction(proposal);
      return;
    }
    if (proposal && intent === "cancel") {
      setDraft("");
      cancelAction(proposal);
      return;
    }
    if (proposal) cancelAction(proposal);

    setPending({ clientTurnId, body: normalized, status: "sending" });
    setDraft("");
    setError(null);
    try {
      const exchange = await sendAssistantTurn(
        conversation.id,
        normalized,
        clientTurnId,
      );
      setTurns((current) => {
        const known = new Set(current.map((turn) => turn.id));
        return [
          ...current,
          ...[exchange.userTurn, exchange.assistantTurn].filter(
            (turn) => !known.has(turn.id),
          ),
        ].sort((left, right) => left.id - right.id);
      });
      if (exchange.proposedAction) {
        setLiveProposalKey(exchange.proposedAction.idempotencyKey);
        setActionStates((current) => {
          const next = { ...current };
          for (const prior of proposals) {
            if (
              prior.idempotencyKey === exchange.proposedAction?.idempotencyKey
            ) {
              continue;
            }
            const state = next[prior.idempotencyKey];
            if (!state || state.status === "failed") {
              next[prior.idempotencyKey] = { status: "cancelled" };
            }
          }
          return next;
        });
      } else {
        setLiveProposalKey(null);
      }
      setPending(null);
      onAnnouncement("Ответ ИИ получен.");
      onActivity();
      const quotaRequest = ++quotaRequestRef.current;
      void loadAssistantMonthlyQuota()
        .then((nextQuota) => {
          if (quotaRequest === quotaRequestRef.current) setQuota(nextQuota);
        })
        .catch(() => null);
    } catch (caught) {
      setPending((current) =>
        current?.clientTurnId === clientTurnId
          ? { ...current, status: "failed" }
          : current,
      );
      setError(errorMessage(caught, "Не удалось получить ответ ИИ."));
    } finally {
      window.requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    void send(draft);
  }

  return (
    <div className="communication-conversation communication-assistant-conversation">
      <div
        className="communication-message-log"
        role="log"
        aria-label={`Диалог с ИИ: ${conversation.title}`}
      >
        {nextCursor ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="communication-load-older"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? "Загружаем…" : "Предыдущие сообщения"}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="communication-loading" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Загружаем диалог…
          </div>
        ) : turns.length === 0 && !pending && !error ? (
          <section
            className="communication-assistant-empty"
            aria-labelledby={`communication-assistant-capabilities-${conversation.id}`}
          >
            <h3 id={`communication-assistant-capabilities-${conversation.id}`}>
              Что может делать ИИ
            </h3>
            <div role="group" aria-label="Что можно попросить ИИ">
              {assistantPrompts(conversation).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={Boolean(pending) || applying}
                  onClick={() => void send(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        ) : (
          turns.map((turn) => {
            const turnMetadata = metadata(turn);
            return (
              <article
                key={turn.id}
                className={`communication-message ${turn.role === "user" ? "is-own" : ""}`}
              >
                {turn.role === "assistant" ? (
                  <span className="communication-message-sender">ИИ</span>
                ) : null}
                <div className="communication-message-bubble">
                  {turn.role === "assistant" ? (
                    <CommunicationMarkdown body={turn.body} />
                  ) : (
                    turn.body
                  )}
                </div>
                <time
                  className="communication-message-meta communication-message-time"
                  dateTime={turn.createdAt}
                >
                  {fullCommunicationTime(turn.createdAt)}
                </time>
                {turnMetadata.quickReplies.length > 0 &&
                turn.id === latestTurnId &&
                turn.id !== hiddenQuickRepliesForTurnId ? (
                  <div
                    className="system-assistant-quick-replies"
                    role="group"
                    aria-label="Варианты ответа"
                  >
                    {turnMetadata.quickReplies.map((reply) => (
                      <button
                        key={`${turn.id}:${reply.message}`}
                        type="button"
                        disabled={Boolean(pending) || applying}
                        onClick={() => void send(reply.message)}
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {turnMetadata.proposedAction ? (
                  <AssistantActionCard
                    proposal={turnMetadata.proposedAction}
                    state={
                      actionStates[
                        turnMetadata.proposedAction.idempotencyKey
                      ] ??
                      (turnMetadata.proposedAction.idempotencyKey !==
                      liveProposalKey
                        ? {
                            status: "stale",
                            message:
                              "Подготовьте это предложение заново перед применением.",
                          }
                        : undefined)
                    }
                    busy={applying}
                    onApply={() =>
                      void applyAction(turnMetadata.proposedAction!)
                    }
                    onCancel={() => cancelAction(turnMetadata.proposedAction!)}
                  />
                ) : null}
              </article>
            );
          })
        )}

        {pending ? (
          <article className="communication-message is-own">
            <div className="communication-message-bubble">{pending.body}</div>
            <span
              className={`communication-message-meta ${pending.status === "failed" ? "communication-message-error" : ""}`}
            >
              {pending.status === "sending"
                ? "ИИ готовит и сохраняет ответ…"
                : "Не отправлено"}
            </span>
            {pending.status === "failed" ? (
              <button
                type="button"
                className="communication-load-older mt-1"
                onClick={() => void send(pending.body, pending.clientTurnId)}
              >
                Повторить
              </button>
            ) : null}
          </article>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="communication-composer-footer">
        {error ? (
          <p className="communication-composer-error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="communication-composer" onSubmit={submit}>
          <label
            className="sr-only"
            htmlFor={`communication-assistant-${conversation.id}`}
          >
            Сообщение ИИ
          </label>
          <textarea
            ref={composerRef}
            id={`communication-assistant-${conversation.id}`}
            rows={1}
            maxLength={6_000}
            value={draft}
            disabled={pending?.status === "sending" || applying}
            placeholder="Спросите или поручите…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            aria-label="Отправить ИИ"
            disabled={
              pending?.status === "sending" || applying || !draft.trim()
            }
          >
            {pending?.status === "sending" || applying ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </form>

        {quota ? <AssistantQuotaBar quota={quota} /> : null}
      </div>
    </div>
  );
}
