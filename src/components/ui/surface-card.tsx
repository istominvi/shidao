import type { ElementType, ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

export type SurfaceCardContentProps = {
  headerClassName?: string;
  bodyClassName?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function SurfaceCardContent({
  headerClassName,
  bodyClassName,
  title,
  description,
  actions,
  children,
}: SurfaceCardContentProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <>
      {hasHeader ? (
        <div className={classNames("surface-card-header", headerClassName)}>
          <div className="min-w-0">
            {title ? <h2 className="surface-card-title">{title}</h2> : null}
            {description ? (
              <p className="surface-card-description">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="surface-card-actions">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children ? (
        <div className={classNames(hasHeader && "mt-4", bodyClassName)}>
          {children}
        </div>
      ) : null}
    </>
  );
}

type SurfaceCardProps = SurfaceCardContentProps & {
  as?: ElementType;
  className?: string;
};

export function SurfaceCard({
  as: Component = "section",
  className,
  ...contentProps
}: SurfaceCardProps) {
  return (
    <Component className={classNames("surface-card", className)}>
      <SurfaceCardContent {...contentProps} />
    </Component>
  );
}
