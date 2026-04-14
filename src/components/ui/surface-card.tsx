import type { ElementType, ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

type SurfaceCardProps = {
  as?: ElementType;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function SurfaceCard({
  as: Component = "section",
  className,
  headerClassName,
  bodyClassName,
  title,
  description,
  actions,
  children,
}: SurfaceCardProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <Component className={classNames("surface-card", className)}>
      {hasHeader ? (
        <div className={classNames("surface-card-header", headerClassName)}>
          <div className="min-w-0">
            {title ? <h2 className="surface-card-title">{title}</h2> : null}
            {description ? (
              <p className="surface-card-description">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="surface-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children ? (
        <div className={classNames(hasHeader && "mt-4", bodyClassName)}>
          {children}
        </div>
      ) : null}
    </Component>
  );
}
