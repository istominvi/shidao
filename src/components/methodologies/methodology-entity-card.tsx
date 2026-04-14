import type { ReactNode } from "react";
import { SurfaceCard } from "@/components/ui/surface-card";
import { classNames } from "@/lib/ui/classnames";

type MethodologyEntityCardProps = {
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function MethodologyEntityCard({
  title,
  description,
  badges,
  children,
  actions,
  className,
}: MethodologyEntityCardProps) {
  return (
    <SurfaceCard
      as="article"
      title={title}
      description={description}
      className={classNames("w-full", className)}
    >
      <div className="space-y-4">
        {badges ? <div className="flex flex-wrap gap-2.5">{badges}</div> : null}
        {children}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </SurfaceCard>
  );
}
