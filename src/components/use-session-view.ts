"use client";

import { useContext } from "react";
import { SessionViewContext } from "@/components/session-view-context";

export function useSessionView() {
  const context = useContext(SessionViewContext);

  if (!context) {
    throw new Error("useSessionView must be used inside SessionViewProvider.");
  }

  return context;
}
