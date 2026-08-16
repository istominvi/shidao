"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CommunicationCenterView =
  | { type: "inbox" }
  | { type: "new" }
  | { type: "system" }
  | { type: "thread"; threadId: string }
  | { type: "assistant"; conversationId: string }
  | {
      type: "direct-target";
      learnerProfileId: string;
      label?: string;
    }
  | { type: "course-target"; courseId: string; label?: string };

type CommunicationCenterContextValue = {
  open: boolean;
  expanded: boolean;
  view: CommunicationCenterView;
  openInbox: () => void;
  openNewConversation: () => void;
  openSystem: () => void;
  openThread: (threadId: string) => void;
  openAssistant: (conversationId: string) => void;
  openDirect: (learnerProfileId: string, label?: string) => void;
  openCourse: (courseId: string, label?: string) => void;
  close: () => void;
  setView: (view: CommunicationCenterView) => void;
  toggleExpanded: () => void;
  setLauncherElement: (element: HTMLButtonElement | null) => void;
  restoreFocus: () => void;
};

const CommunicationCenterContext =
  createContext<CommunicationCenterContextValue | null>(null);

function focusedElement() {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}

export function CommunicationCenterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<CommunicationCenterView>({ type: "inbox" });
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

  const openView = useCallback(
    (nextView: CommunicationCenterView) => {
      if (!open) returnFocusRef.current = focusedElement();
      setView(nextView);
      setOpen(true);
    },
    [open],
  );

  const restoreFocus = useCallback(() => {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
      else launcherRef.current?.focus();
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    restoreFocus();
  }, [restoreFocus]);

  const value = useMemo<CommunicationCenterContextValue>(
    () => ({
      open,
      expanded,
      view,
      openInbox: () => openView({ type: "inbox" }),
      openNewConversation: () => openView({ type: "new" }),
      openSystem: () => openView({ type: "system" }),
      openThread: (threadId) => openView({ type: "thread", threadId }),
      openAssistant: (conversationId) =>
        openView({ type: "assistant", conversationId }),
      openDirect: (learnerProfileId, label) =>
        openView({ type: "direct-target", learnerProfileId, label }),
      openCourse: (courseId, label) =>
        openView({ type: "course-target", courseId, label }),
      close,
      setView,
      toggleExpanded: () => setExpanded((current) => !current),
      setLauncherElement: (element) => {
        launcherRef.current = element;
      },
      restoreFocus,
    }),
    [close, expanded, open, openView, restoreFocus, view],
  );

  return (
    <CommunicationCenterContext.Provider value={value}>
      {children}
    </CommunicationCenterContext.Provider>
  );
}

export function useCommunicationCenter() {
  const value = useContext(CommunicationCenterContext);
  if (!value) {
    throw new Error(
      "useCommunicationCenter must be used inside CommunicationCenterProvider.",
    );
  }
  return value;
}

export function useCommunicationCenterActions() {
  const {
    openInbox,
    openNewConversation,
    openSystem,
    openThread,
    openAssistant,
    openDirect,
    openCourse,
  } = useCommunicationCenter();
  return useMemo(
    () => ({
      openInbox,
      openNewConversation,
      openSystem,
      openThread,
      openAssistant,
      openDirect,
      openCourse,
    }),
    [
      openAssistant,
      openCourse,
      openDirect,
      openInbox,
      openNewConversation,
      openSystem,
      openThread,
    ],
  );
}
