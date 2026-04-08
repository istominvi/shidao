import type { ReactNode } from "react";
import { AppCard } from "@/components/app/app-card";

type TeacherTableCardProps = {
  title: string;
  controls?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
};

type TeacherTableEmptyStateProps = {
  text: string;
};

export function TeacherTableCard({
  title,
  controls,
  headerAction,
  children,
}: TeacherTableCardProps) {
  return (
    <AppCard className="p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-neutral-950">{title}</h2>
        {headerAction}
      </div>
      {controls ? <div className="mt-4">{controls}</div> : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95">
        {children}
      </div>
    </AppCard>
  );
}

export function TeacherTableEmptyState({ text }: TeacherTableEmptyStateProps) {
  return <p className="px-4 py-4 text-sm text-neutral-500">{text}</p>;
}
