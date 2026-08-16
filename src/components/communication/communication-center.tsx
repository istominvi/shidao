"use client";

import {
  Archive,
  ArrowLeft,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSystemAssistant } from "@/components/assistant/system-assistant-provider";
import {
  AssistantConversationView,
  type AssistantConversationSummary,
} from "@/components/communication/assistant-conversation";
import {
  createAssistantConversation,
  loadAssistantConversation,
  loadInbox,
  openCommunicationThread,
  updateAssistantConversation,
} from "@/components/communication/communication-client";
import {
  useCommunicationCenter,
  type CommunicationCenterView,
} from "@/components/communication/communication-center-provider";
import { CommunicationInbox } from "@/components/communication/communication-inbox";
import { loadInboxRange } from "@/components/communication/inbox-pagination";
import {
  CommunicationAvatar,
  unreadLabel,
} from "@/components/communication/communication-presenters";
import {
  HumanConversation,
  type HumanThreadSummary,
} from "@/components/communication/human-conversation";
import { NewConversationView } from "@/components/communication/new-conversation-view";
import { SystemConversation } from "@/components/communication/system-conversation";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type {
  AssistantInboxItem,
  CourseMessageTarget,
  DirectMessageTarget,
  InboxItem,
} from "@/modules/communication/domain";

const PANEL_ID = "communication-center-panel";
const SYSTEM_CHANNEL_NOTE_ID = "communication-system-channel-note";
const MOBILE_MEDIA = "(max-width: 640px)";
const POLL_INTERVAL_MS = 30_000;

type AssistantDialog =
  | { type: "rename"; conversation: AssistantConversationSummary }
  | { type: "archive"; conversation: AssistantConversationSummary }
  | null;

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function humanSummary(item: InboxItem): HumanThreadSummary | null {
  if (item.kind !== "direct" && item.kind !== "course") return null;
  return {
    id: item.threadId,
    kind: item.kind,
    title: item.title,
    lastMessageId: item.lastMessageId,
    canSend: item.canSend,
  };
}

function assistantSummary(
  item: AssistantInboxItem,
): AssistantConversationSummary {
  return {
    id: item.conversationId,
    title: item.title,
    contextCourseId: item.contextCourseId,
    contextLessonId: item.contextLessonId,
  };
}

function assistantContext(page: ReturnType<typeof useSystemAssistant>["page"]) {
  if (page.courseId && page.lessonId) {
    return {
      kind: "lesson" as const,
      courseId: page.courseId,
      lessonId: page.lessonId,
    };
  }
  if (page.courseId) {
    return { kind: "course" as const, courseId: page.courseId };
  }
  return { kind: "global" as const };
}

function useMobileViewport() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

function SystemChannelInfo() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <span
      className="communication-system-info"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="communication-system-info-button"
        aria-label="О ленте ShiDao"
        aria-expanded={open}
        aria-controls={SYSTEM_CHANNEL_NOTE_ID}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open ? (
        <span
          id={SYSTEM_CHANNEL_NOTE_ID}
          className="communication-system-info-note"
          role="note"
        >
          ShiDao сообщает здесь только о подтверждённых событиях и результатах.
        </span>
      ) : null}
    </span>
  );
}

function ConversationHeader({
  view,
  thread,
  assistant,
  busy,
  onBack,
  onClose,
  onRename,
  onArchive,
}: {
  view: CommunicationCenterView;
  thread: HumanThreadSummary | null;
  assistant: AssistantConversationSummary | null;
  busy: boolean;
  onBack: () => void;
  onClose: () => void;
  onRename: () => void;
  onArchive: () => void;
}) {
  let title = "Сообщения";
  let subtitle = "Выберите диалог";
  let kind: InboxItem["kind"] = "system";

  if (view.type === "new") {
    title = "Новый диалог";
    subtitle = "ИИ, ученики и курсы";
  } else if (view.type === "system") {
    title = "ShiDao";
    subtitle = "Системные уведомления";
  } else if (view.type === "thread" && thread) {
    title = thread.title;
    subtitle = thread.kind === "course" ? "Чат курса" : "Личный диалог";
    kind = thread.kind;
  } else if (view.type === "assistant" && assistant) {
    title = assistant.title;
    subtitle = "ИИ · сохранённый диалог";
    kind = "assistant";
  } else if (view.type === "direct-target" || view.type === "course-target") {
    title = view.label ?? "Открываем диалог";
    subtitle = "Проверяем доступ…";
    kind = view.type === "course-target" ? "course" : "direct";
  }

  const assistantItems: ActionMenuItem[] = assistant
    ? [
        {
          id: "rename",
          label: "Переименовать",
          icon: Pencil,
          disabled: busy,
          onSelect: onRename,
        },
        {
          id: "archive",
          label: "Архивировать",
          icon: Archive,
          disabled: busy,
          onSelect: onArchive,
        },
      ]
    : [];

  return (
    <header className="communication-conversation-header">
      <button
        type="button"
        className="communication-center-icon-button communication-center-back"
        aria-label="Назад к сообщениям"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" />
      </button>
      {view.type !== "new" ? (
        <CommunicationAvatar kind={kind} title={title} />
      ) : (
        <span className="communication-avatar" aria-hidden="true">
          <Plus />
        </span>
      )}
      <div className="communication-conversation-heading">
        <div className="communication-conversation-title-row">
          <strong>{title}</strong>
          {view.type === "system" ? <SystemChannelInfo /> : null}
        </div>
        <span className="communication-conversation-subtitle">{subtitle}</span>
      </div>
      {view.type === "assistant" && assistant ? (
        <ActionMenu
          label={`Действия с диалогом «${assistant.title}»`}
          items={assistantItems}
          disabled={busy}
          triggerVariant="ghost"
          portal
        />
      ) : null}
      <button
        type="button"
        className="communication-center-icon-button"
        aria-label="Закрыть сообщения"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
    </header>
  );
}

export function CommunicationCenter() {
  const { open, view, openInbox, close, setView, setLauncherElement } =
    useCommunicationCenter();
  const { page } = useSystemAssistant();
  const mobile = useMobileViewport();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [nextCursor, setNextCursor] =
    useState<Awaited<ReturnType<typeof loadInbox>>["nextCursor"]>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, HumanThreadSummary>>(
    {},
  );
  const [assistants, setAssistants] = useState<
    Record<string, AssistantConversationSummary>
  >({});
  const [targetBusy, setTargetBusy] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [targetRetry, setTargetRetry] = useState(0);
  const [newBusy, setNewBusy] = useState(false);
  const [assistantDialog, setAssistantDialog] = useState<AssistantDialog>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const refreshSequenceRef = useRef(0);
  const paginationRevisionRef = useRef(0);
  const loadedPageCountRef = useRef(1);
  const loadingMoreRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const mergeInboxSummaries = useCallback((nextItems: InboxItem[]) => {
    setThreads((current) => {
      const next = { ...current };
      for (const item of nextItems) {
        const summary = humanSummary(item);
        if (summary) next[summary.id] = summary;
      }
      return next;
    });
    setAssistants((current) => {
      const next = { ...current };
      for (const item of nextItems) {
        if (item.kind === "assistant") {
          next[item.conversationId] = assistantSummary(item);
        }
      }
      return next;
    });
  }, []);

  const refreshInbox = useCallback(
    async (background = false) => {
      if (loadingMoreRef.current) return;
      const sequence = ++refreshSequenceRef.current;
      const paginationRevision = paginationRevisionRef.current;
      if (!background) setLoading(true);
      try {
        const pageResult = await loadInboxRange(
          loadInbox,
          loadedPageCountRef.current,
        );
        if (
          sequence !== refreshSequenceRef.current ||
          paginationRevision !== paginationRevisionRef.current
        ) {
          return;
        }
        loadedPageCountRef.current = pageResult.loadedPageCount;
        setItems(pageResult.items);
        setNextCursor(pageResult.nextCursor);
        setTotalUnread(pageResult.totalUnread);
        setInboxError(null);
        mergeInboxSummaries(pageResult.items);
      } catch (caught) {
        if (
          sequence !== refreshSequenceRef.current ||
          paginationRevision !== paginationRevisionRef.current
        ) {
          return;
        }
        setInboxError(errorMessage(caught, "Не удалось загрузить сообщения."));
      } finally {
        if (sequence === refreshSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [mergeInboxSummaries],
  );

  useEffect(() => {
    void refreshInbox();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshInbox(true);
    }, POLL_INTERVAL_MS);
    const onFocus = () => void refreshInbox(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshInbox]);

  useEffect(() => {
    if (!open || view.type !== "assistant" || assistants[view.conversationId]) {
      return;
    }
    let active = true;
    setTargetBusy(true);
    setTargetError(null);
    void loadAssistantConversation(view.conversationId)
      .then((found) => {
        if (!active) return;
        setAssistants((current) => ({
          ...current,
          [found.id]: found,
        }));
      })
      .catch((caught: unknown) => {
        if (active) {
          setTargetError(errorMessage(caught, "Не удалось открыть диалог."));
        }
      })
      .finally(() => {
        if (active) setTargetBusy(false);
      });
    return () => {
      active = false;
    };
  }, [assistants, open, targetRetry, view]);

  useEffect(() => {
    if (
      !open ||
      (view.type !== "direct-target" && view.type !== "course-target")
    ) {
      return;
    }
    let active = true;
    setTargetBusy(true);
    setTargetError(null);
    const request =
      view.type === "direct-target"
        ? openCommunicationThread({
            kind: "direct",
            learnerProfileId: view.learnerProfileId,
          })
        : openCommunicationThread({ kind: "course", courseId: view.courseId });
    void request
      .then((thread) => {
        if (!active) return;
        const summary: HumanThreadSummary = {
          id: thread.id,
          kind: thread.kind,
          title: thread.title,
          lastMessageId: thread.lastMessageId,
          canSend: thread.canSend,
        };
        setThreads((current) => ({ ...current, [thread.id]: summary }));
        setView({ type: "thread", threadId: thread.id });
        void refreshInbox(true);
      })
      .catch((caught: unknown) => {
        if (active) {
          setTargetError(
            errorMessage(caught, "Не удалось открыть этот диалог."),
          );
        }
      })
      .finally(() => {
        if (active) setTargetBusy(false);
      });
    return () => {
      active = false;
    };
  }, [open, refreshInbox, setView, targetRetry, view]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      panel.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (
          event.defaultPrevented ||
          document.querySelector(
            '[role="dialog"][aria-modal="true"]:not(#communication-center-panel)',
          )
        ) {
          return;
        }
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !mobile || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (mobile) document.body.style.overflow = previousOverflow;
    };
  }, [close, mobile, open]);

  const selectInboxItem = useCallback(
    (item: InboxItem) => {
      if (item.kind === "system") {
        setView({ type: "system" });
        return;
      }
      if (item.kind === "assistant") {
        setAssistants((current) => ({
          ...current,
          [item.conversationId]: assistantSummary(item),
        }));
        setView({ type: "assistant", conversationId: item.conversationId });
        return;
      }
      const summary = humanSummary(item);
      if (summary) {
        setThreads((current) => ({ ...current, [summary.id]: summary }));
        setView({ type: "thread", threadId: summary.id });
      }
    },
    [setView],
  );

  async function loadMoreInbox() {
    if (!nextCursor || loadingMoreRef.current) return;
    const cursor = nextCursor;
    loadingMoreRef.current = true;
    paginationRevisionRef.current += 1;
    setLoadingMore(true);
    try {
      const pageResult = await loadInbox(cursor);
      setItems((current) => {
        const known = new Set(current.map((item) => `${item.kind}:${item.id}`));
        return [
          ...current,
          ...pageResult.items.filter(
            (item) => !known.has(`${item.kind}:${item.id}`),
          ),
        ];
      });
      loadedPageCountRef.current += 1;
      mergeInboxSummaries(pageResult.items);
      setNextCursor(pageResult.nextCursor);
      setTotalUnread(pageResult.totalUnread);
      setInboxError(null);
    } catch (caught) {
      setInboxError(errorMessage(caught, "Не удалось загрузить ещё диалоги."));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  async function createAiConversation() {
    if (newBusy) return;
    setNewBusy(true);
    setTargetError(null);
    try {
      const conversation = await createAssistantConversation({
        title: "Новый диалог",
        context: assistantContext(page),
      });
      setAssistants((current) => ({
        ...current,
        [conversation.id]: conversation,
      }));
      setView({ type: "assistant", conversationId: conversation.id });
      setAnnouncement("Новый диалог с ИИ создан.");
      void refreshInbox(true);
    } catch (caught) {
      setTargetError(errorMessage(caught, "Не удалось создать диалог с ИИ."));
    } finally {
      setNewBusy(false);
    }
  }

  function openDirectTarget(target: DirectMessageTarget) {
    setView({
      type: "direct-target",
      learnerProfileId: target.learnerProfileId,
      label: target.title,
    });
  }

  function openCourseTarget(target: CourseMessageTarget) {
    setView({
      type: "course-target",
      courseId: target.courseId,
      label: target.title,
    });
  }

  function openAssistantDialog(type: "rename" | "archive") {
    if (view.type !== "assistant") return;
    const conversation = assistants[view.conversationId];
    if (!conversation) return;
    setDialogError(null);
    setDialogTitle(conversation.title);
    setAssistantDialog({ type, conversation });
  }

  async function submitAssistantDialog(event?: FormEvent) {
    event?.preventDefault();
    if (!assistantDialog || dialogBusy) return;
    const normalizedTitle = dialogTitle.trim();
    if (assistantDialog.type === "rename" && !normalizedTitle) return;
    setDialogBusy(true);
    setDialogError(null);
    try {
      const updated = await updateAssistantConversation(
        assistantDialog.conversation.id,
        assistantDialog.type === "rename"
          ? { action: "rename", title: normalizedTitle }
          : { action: "archive" },
      );
      if (assistantDialog.type === "rename") {
        setAssistants((current) => ({
          ...current,
          [updated.id]: updated,
        }));
        setAnnouncement("Диалог переименован.");
      } else {
        setAssistants((current) => {
          const next = { ...current };
          delete next[updated.id];
          return next;
        });
        setView({ type: "inbox" });
        setAnnouncement("Диалог перемещён в архив.");
      }
      setAssistantDialog(null);
      void refreshInbox(true);
    } catch (caught) {
      setDialogError(errorMessage(caught, "Не удалось изменить диалог."));
    } finally {
      setDialogBusy(false);
    }
  }

  const selectedThread =
    view.type === "thread" ? (threads[view.threadId] ?? null) : null;
  const selectedAssistant =
    view.type === "assistant"
      ? (assistants[view.conversationId] ?? null)
      : null;
  const systemRefreshKey =
    items.find((item) => item.kind === "system")?.lastNotificationId ?? null;

  const handleActivity = useCallback(() => {
    void refreshInbox(true);
  }, [refreshInbox]);

  const handleThreadAccessRevoked = useCallback(
    (threadId: string) => {
      setThreads((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      });
      setView({ type: "inbox" });
      setAnnouncement("Доступ к диалогу изменился.");
      void refreshInbox(true);
    },
    [refreshInbox, setView],
  );

  const detail = (() => {
    if (view.type === "new") {
      return (
        <NewConversationView
          contextLabel={page.label}
          busy={newBusy || targetBusy}
          actionError={targetError}
          onCreateAssistant={() => void createAiConversation()}
          onOpenDirect={openDirectTarget}
          onOpenCourse={openCourseTarget}
        />
      );
    }
    if (view.type === "system") {
      return (
        <SystemConversation
          refreshKey={systemRefreshKey}
          onActivity={handleActivity}
        />
      );
    }
    if (view.type === "thread" && selectedThread) {
      return (
        <HumanConversation
          thread={selectedThread}
          onActivity={handleActivity}
          onAnnouncement={setAnnouncement}
          onAccessRevoked={handleThreadAccessRevoked}
        />
      );
    }
    if (view.type === "assistant" && selectedAssistant) {
      return (
        <AssistantConversationView
          conversation={selectedAssistant}
          onActivity={handleActivity}
          onAnnouncement={setAnnouncement}
        />
      );
    }
    if (
      targetBusy ||
      view.type === "direct-target" ||
      view.type === "course-target" ||
      view.type === "assistant"
    ) {
      return targetError ? (
        <div className="communication-error" role="alert">
          <span>{targetError}</span>
          <Button
            variant="secondary"
            onClick={() => setTargetRetry((key) => key + 1)}
          >
            Повторить
          </Button>
        </div>
      ) : (
        <div className="communication-loading" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Открываем диалог…
        </div>
      );
    }
    return null;
  })();

  if (!mounted) return null;

  const inboxColumn = (
    <section className="communication-center-column" aria-label="Входящие">
      <header className="communication-center-header">
        <div className="communication-center-heading">
          <h2 id={`${PANEL_ID}-title`}>Сообщения</h2>
        </div>
        <button
          type="button"
          className="communication-center-icon-button"
          aria-label="Новый диалог"
          onClick={() => {
            setTargetError(null);
            setView({ type: "new" });
          }}
        >
          <Plus aria-hidden="true" />
        </button>
        <button
          type="button"
          className="communication-center-icon-button"
          aria-label="Закрыть сообщения"
          onClick={close}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <CommunicationInbox
        items={items}
        view={view}
        loading={loading}
        error={inboxError}
        hasMore={Boolean(nextCursor)}
        loadingMore={loadingMore}
        onSelect={selectInboxItem}
        onRetry={() => void refreshInbox()}
        onLoadMore={() => void loadMoreInbox()}
        onNewConversation={() => {
          setTargetError(null);
          setView({ type: "new" });
        }}
      />
    </section>
  );

  const detailColumn =
    view.type === "inbox" ? null : (
      <section className="communication-center-view">
        <ConversationHeader
          view={view}
          thread={selectedThread}
          assistant={selectedAssistant}
          busy={dialogBusy || targetBusy}
          onBack={openInbox}
          onClose={close}
          onRename={() => openAssistantDialog("rename")}
          onArchive={() => openAssistantDialog("archive")}
        />
        {detail}
      </section>
    );

  return createPortal(
    <div className="communication-center-layer">
      {open ? (
        <aside
          ref={panelRef}
          id={PANEL_ID}
          tabIndex={-1}
          className="communication-center-panel"
          role="dialog"
          aria-modal={mobile}
          aria-label="Сообщения"
        >
          <div className="communication-center-shell">
            {view.type === "inbox" ? inboxColumn : detailColumn}
          </div>
        </aside>
      ) : null}

      <div
        className={`communication-center-launcher-wrap ${open ? "is-open" : ""}`}
      >
        <button
          ref={setLauncherElement}
          type="button"
          className="communication-center-launcher"
          aria-label={open ? "Закрыть сообщения" : "Открыть сообщения"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          onClick={() => (open ? close() : openInbox())}
        >
          {open ? (
            <X aria-hidden="true" />
          ) : (
            <MessageCircle aria-hidden="true" />
          )}
        </button>
        {totalUnread > 0 ? (
          <span
            className="communication-center-badge"
            aria-label={`Непрочитанных сообщений: ${totalUnread}`}
          >
            {unreadLabel(totalUnread)}
          </span>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {assistantDialog ? (
        <DialogShell
          title={
            assistantDialog.type === "rename"
              ? "Переименовать диалог"
              : "Архивировать диалог?"
          }
          description={
            assistantDialog.type === "archive"
              ? "Диалог исчезнет из входящих, но его история сохранится."
              : undefined
          }
          onClose={dialogBusy ? undefined : () => setAssistantDialog(null)}
          closeLabel="Закрыть"
          panelClassName="max-w-md"
        >
          {assistantDialog.type === "rename" ? (
            <form onSubmit={(event) => void submitAssistantDialog(event)}>
              <label className="grid gap-2 text-sm font-semibold">
                Название
                <input
                  autoFocus
                  className="min-h-10 rounded-xl border border-neutral-300 bg-white px-3 font-normal outline-none focus:border-neutral-700 focus:ring-2 focus:ring-neutral-200"
                  maxLength={160}
                  value={dialogTitle}
                  disabled={dialogBusy}
                  onChange={(event) => setDialogTitle(event.target.value)}
                />
              </label>
              {dialogError ? (
                <p className="app-alert app-alert-error mt-4" role="alert">
                  {dialogError}
                </p>
              ) : null}
              <div className="dialog-shell-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={dialogBusy}
                  onClick={() => setAssistantDialog(null)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={dialogBusy || !dialogTitle.trim()}
                >
                  {dialogBusy ? "Сохраняем…" : "Сохранить"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              {dialogError ? (
                <p className="app-alert app-alert-error" role="alert">
                  {dialogError}
                </p>
              ) : null}
              <div className="dialog-shell-actions">
                <Button
                  variant="ghost"
                  disabled={dialogBusy}
                  onClick={() => setAssistantDialog(null)}
                >
                  Отмена
                </Button>
                <Button
                  disabled={dialogBusy}
                  onClick={() => void submitAssistantDialog()}
                >
                  {dialogBusy ? "Архивируем…" : "Архивировать"}
                </Button>
              </div>
            </>
          )}
        </DialogShell>
      ) : null}
    </div>,
    document.body,
  );
}
