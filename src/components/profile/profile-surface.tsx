import type { ElementType, ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";
import styles from "./profile-workspace.module.css";

type ProfileSurfaceProps = {
  as?: ElementType;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function ProfileSurface({
  as: Component = "section",
  className,
  headerClassName,
  bodyClassName,
  title,
  description,
  actions,
  children,
}: ProfileSurfaceProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <Component
      className={classNames(styles.card, className)}
      data-profile-surface="card"
    >
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
    </Component>
  );
}
