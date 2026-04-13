import type { ReactNode } from "react";
import { AppCard } from "@/components/app/app-card";
import { classNames } from "@/lib/ui/classnames";

type MethodologyEntityCardProps = {
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export const methodologyEntityActionClass =
  "landing-chip border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:-translate-y-0.5 hover:bg-neutral-50";

export function MethodologyEntityCard({
  title,
  description,
  badges,
  children,
  actions,
  className,
}: MethodologyEntityCardProps) {
  return (
    <AppCard as="article" className={classNames("w-full px-6 py-5", className)}>
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-neutral-950">{title}</h3>
          {description ? (
            <p className="text-sm text-neutral-700">{description}</p>
          ) : null}
        </div>

        {badges ? <div className="flex flex-wrap gap-2.5">{badges}</div> : null}

        {children}

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </AppCard>
  );
}
