"use client";

import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";

type AppPageHeaderActionsProps = {
  primary?: ReactNode;
  overflowLabel: string;
  overflowItems?: ReadonlyArray<ActionMenuItem>;
  overflowDisabled?: boolean;
};

export function AppPageHeaderActions({
  primary,
  overflowLabel,
  overflowItems = [],
  overflowDisabled = false,
}: AppPageHeaderActionsProps) {
  return (
    <>
      {primary}
      {overflowItems.length > 0 ? (
        <ActionMenu
          label={overflowLabel}
          items={overflowItems}
          disabled={overflowDisabled}
          className="app-page-overflow-menu"
          triggerIcon={MoreVertical}
          triggerVariant="secondary"
          portal
        />
      ) : null}
    </>
  );
}
