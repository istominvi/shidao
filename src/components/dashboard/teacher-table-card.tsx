import type { ReactNode } from "react";

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
    <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-neutral-950">{title}</h2>
        {headerAction}
      </div>
      {controls ? <div className="mt-4">{controls}</div> : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        {children}
      </div>
    </section>
  );
}

export function TeacherTableEmptyState({ text }: TeacherTableEmptyStateProps) {
  return <p className="px-4 py-4 text-sm text-neutral-500">{text}</p>;
}
